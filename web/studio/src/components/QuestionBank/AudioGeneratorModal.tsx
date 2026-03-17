'use client';

import React, { useState, useEffect } from 'react';
import { questionBankApi, QuestionBank } from '@/lib/api';
import { X, Volume2, Check, AlertCircle, Play, Pause } from 'lucide-react';

interface AudioGeneratorModalProps {
    questionId: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function AudioGeneratorModal({ questionId, onSuccess, onCancel }: AudioGeneratorModalProps) {
    const [question, setQuestion] = useState<QuestionBank | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

    const [voice, setVoice] = useState('v2/en_speaker_1');
    const [speed, setSpeed] = useState(1.0);
    const [customText, setCustomText] = useState('');

    const voices = [
        { id: 'v2/en_speaker_0', name: 'English Speaker 0', language: 'en' },
        { id: 'v2/en_speaker_1', name: 'English Speaker 1', language: 'en' },
        { id: 'v2/en_speaker_6', name: 'English Speaker 6', language: 'en' },
        { id: 'v2/es_speaker_0', name: 'Spanish Speaker 0', language: 'es' },
        { id: 'v2/es_speaker_1', name: 'Spanish Speaker 1', language: 'es' },
        { id: 'v2/es_speaker_3', name: 'Spanish Speaker 3', language: 'es' },
    ];

    useEffect(() => {
        loadQuestion();
    }, [questionId]);

    const loadQuestion = async () => {
        try {
            const data = await questionBankApi.get(questionId);
            setQuestion(data);
            setCustomText(data.question_text);
        } catch (error) {
            console.error('Failed to load question:', error);
            setError('No se pudo cargar la pregunta');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            setError(null);
            
            await questionBankApi.generateAudio(questionId, customText, voice, speed);
            
            // Poll for completion
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max
            
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const updated = await questionBankApi.get(questionId);
                
                if (updated.audio_status === 'ready') {
                    setGenerated(true);
                    setQuestion(updated);
                    break;
                } else if (updated.audio_status === 'failed') {
                    setError('Error al generar el audio');
                    break;
                }
                
                attempts++;
            }
            
            if (attempts >= maxAttempts) {
                setError('Tiempo de espera agotado. El audio puede estar generándose aún.');
            }
        } catch (error: any) {
            console.error('Audio generation failed:', error);
            setError(error.message || 'Error al generar audio');
        } finally {
            setGenerating(false);
        }
    };

    const handlePlay = () => {
        if (!question?.audio_url) return;

        if (audio) {
            audio.remove();
        }

        const audioEl = new Audio(question.audio_url);
        audioEl.onended = () => setIsPlaying(false);
        audioEl.onerror = () => {
            setIsPlaying(false);
            alert('Error al reproducir el audio');
        };
        
        setAudio(audioEl);
        setIsPlaying(true);
        audioEl.play();
    };

    const handleStop = () => {
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        setIsPlaying(false);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando pregunta...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <Volume2 className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Generar Audio con Bark
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Convierte el texto de la pregunta a audio
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Question Preview */}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Texto de la pregunta
                        </label>
                        <p className="text-gray-900 dark:text-white text-sm">
                            {question?.question_text}
                        </p>
                    </div>

                    {/* Custom Text */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Texto para audio (opcional)
                        </label>
                        <textarea
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Deja en blanco para usar el texto de la pregunta"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Puedes personalizar el texto si quieres una pronunciación diferente
                        </p>
                    </div>

                    {/* Voice Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Voz
                        </label>
                        <select
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                            {voices.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.name} ({v.language === 'en' ? 'Inglés' : 'Español'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Speed */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Velocidad
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={speed}
                                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                className="flex-1"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12 text-right">
                                {speed.toFixed(1)}x
                            </span>
                        </div>
                    </div>

                    {/* Audio Preview */}
                    {question?.audio_status === 'ready' && question.audio_url && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                                        <Volume2 className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                            Audio generado
                                        </p>
                                        <p className="text-xs text-green-700 dark:text-green-300">
                                            Haz click para escuchar
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={isPlaying ? handleStop : handlePlay}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    {isPlaying ? 'Detener' : 'Reproducir'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Generating Status */}
                    {generating && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                <div>
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                        Generando audio...
                                    </p>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        Esto puede tomar unos segundos
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <div>
                                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                                    Error
                                </p>
                                <p className="text-xs text-red-700 dark:text-red-300">
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {generated && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                            <Check className="w-5 h-5 text-green-600" />
                            <div>
                                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                    ¡Audio generado exitosamente!
                                </p>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                    El audio está disponible para los estudiantes
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={generating}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        {generated ? 'Cerrar' : 'Cancelar'}
                    </button>
                    {!question?.audio_url && (
                        <button
                            onClick={handleGenerate}
                            disabled={generating || generated}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Volume2 className="w-4 h-4" />
                            {generating ? 'Generando...' : 'Generar Audio'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
