'use client';

import React, { useState } from 'react';
import { Edit2, Trash2, Volume2, Sparkles, Globe } from 'lucide-react';

interface QuestionBankCardProps {
    question: any;
    onEdit: () => void;
    onDelete: () => void;
}

export default function QuestionBankCard({ question, onEdit, onDelete }: QuestionBankCardProps): React.JSX.Element {
    const [isPlaying, setIsPlaying] = useState(false);
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
    const safeQuestionText: React.ReactNode =
        typeof question.question_text === 'string' ? question.question_text : '';

    const getQuestionTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'multiple-choice': 'Opción Múltiple',
            'true-false': 'Verdadero/Falso',
            'short-answer': 'Respuesta Corta',
            'essay': 'Ensayo',
            'matching': 'Emparejamiento',
            'ordering': 'Ordenar',
            'fill-in-the-blanks': 'Completar',
            'audio-response': 'Respuesta Audio',
            'hotspot': 'Hotspot',
            'code-lab': 'Código',
        };
        return labels[type] || type;
    };

    const getDifficultyColor = (difficulty?: string) => {
        switch (difficulty) {
            case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
        }
    };

    const handlePlayAudio = () => {
        if (!question.audio_url) return;

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

    const handleStopAudio = () => {
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        setIsPlaying(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                            {getQuestionTypeLabel(question.question_type)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty || 'Medium'}
                        </span>
                        {question.skill_assessed && (
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded capitalize">
                                📊 {question.skill_assessed}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {question.audio_url && (
                        <button
                            onClick={isPlaying ? handleStopAudio : handlePlayAudio}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title={isPlaying ? 'Detener audio' : 'Reproducir audio'}
                        >
                            <Volume2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onEdit}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Editar"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Question Text */}
            <p className="text-gray-900 dark:text-white font-medium mb-3 line-clamp-3">
                {safeQuestionText as any}
            </p>

            {/* Matching Pairs Preview */}
            {question.question_type === 'matching' && (
                <div className="mb-3 space-y-2">
                    {(() => {
                        // Try to get pairs from different possible locations
                        let pairs = question.pairs || 
                                   (question.correct_answer && Array.isArray(question.correct_answer) ? question.correct_answer : null) ||
                                   (question.correct_answer && question.correct_answer.pairs ? question.correct_answer.pairs : null);
                        
                        if (!Array.isArray(pairs) || pairs.length === 0) {
                            return <div className="text-xs text-gray-400">Sin pares definidos</div>;
                        }
                        
                        return pairs.slice(0, 3).map((pair: any, idx: number) => (
                            <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-700/50 p-2 rounded flex items-center gap-2">
                                <span className="flex-1 text-gray-700 dark:text-gray-300">{pair.left || pair[0]}</span>
                                <span className="text-gray-400">→</span>
                                <span className="flex-1 text-gray-600 dark:text-gray-400 line-clamp-1">{pair.right || pair[1]}</span>
                            </div>
                        ));
                    })()}
                    {(() => {
                        let pairs = question.pairs || 
                                   (question.correct_answer && Array.isArray(question.correct_answer) ? question.correct_answer : null) ||
                                   (question.correct_answer && question.correct_answer.pairs ? question.correct_answer.pairs : null);
                        return Array.isArray(pairs) && pairs.length > 3 ? (
                            <div className="text-xs text-gray-400">+{pairs.length - 3} pares más</div>
                        ) : null;
                    })()}
                </div>
            )}

            {/* Audio Player */}
            {question.audio_url && (
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Volume2 className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Audio disponible</span>
                    </div>
                    <audio controls src={question.audio_url} className="w-full h-8" />
                </div>
            )}

            {/* Options Preview */}
            {question.options && (
                <div className="mb-3 space-y-1">
                    {Array.isArray(question.options) && question.options.slice(0, 3).map((opt: string, idx: number) => (
                        <div key={idx} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-[10px]">
                                {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="line-clamp-1">{opt}</span>
                        </div>
                    ))}
                    {Array.isArray(question.options) && question.options.length > 3 && (
                        <div className="text-xs text-gray-400">+{question.options.length - 3} opciones más</div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {question.points} pts
                    </span>
                    {question.source && (
                        <div className="flex items-center gap-1">
                            {question.source === 'imported-mysql' && (
                                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                    <Globe className="w-3 h-3" /> MySQL
                                </span>
                            )}
                            {question.source === 'ai-generated' && (
                                <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                                    <Sparkles className="w-3 h-3" /> IA
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Usage Stats */}
            {question.usage_count && question.usage_count > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Usada {question.usage_count} veces
                    </span>
                </div>
            )}
        </div>
    );
}
