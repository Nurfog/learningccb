"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    Mic, 
    Play, 
    Pause, 
    CheckCircle, 
    AlertCircle, 
    BrainCircuit, 
    User, 
    Calendar,
    BookOpen,
    Filter,
    Download,
    RefreshCcw
} from "lucide-react";
import { lmsApi, type AudioResponse, type AudioResponseFilters } from "@/lib/api";
import PageLayout from "@/components/PageLayout";
import AuthGuard from "@/components/AuthGuard";

export default function AudioEvaluationsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<AudioResponse[]>([]);
    const [selectedEvaluation, setSelectedEvaluation] = useState<AudioResponse | null>(null);
    const [teacherScore, setTeacherScore] = useState<number>(50);
    const [teacherFeedback, setTeacherFeedback] = useState<string>("");
    const [filters, setFilters] = useState<AudioResponseFilters>({});
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const fetchEvaluations = async () => {
        setLoading(true);
        try {
            const data = await lmsApi.getAudioResponses(filters);
            setEvaluations(data);
        } catch (error) {
            console.error("Error fetching audio evaluations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvaluations();
    }, [filters]);

    const handlePlayAudio = async (id: string) => {
        if (playingId === id) {
            // Stop playing
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
            setPlayingId(null);
            setAudioUrl(null);
        } else {
            try {
                const audioBlob = await lmsApi.getAudioResponseAudio(id);
                const url = URL.createObjectURL(audioBlob);
                
                if (audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                }
                
                setAudioUrl(url);
                setPlayingId(id);
                
                const audio = new Audio(url);
                audio.onended = () => {
                    setPlayingId(null);
                    setAudioUrl(null);
                };
                audio.play();
            } catch (error) {
                console.error("Error playing audio:", error);
                alert("Error al reproducir el audio");
            }
        }
    };

    const handleSubmitEvaluation = async () => {
        if (!selectedEvaluation) return;

        try {
            await lmsApi.evaluateAudioResponse(
                selectedEvaluation.id,
                teacherScore,
                teacherFeedback
            );
            alert("Evaluación guardada exitosamente");
            setSelectedEvaluation(null);
            fetchEvaluations();
        } catch (error) {
            console.error("Error submitting evaluation:", error);
            alert("Error al guardar la evaluación");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs font-bold text-yellow-600 dark:text-yellow-400">Pendiente</span>;
            case 'ai_evaluated':
                return <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400">IA Evaluada</span>;
            case 'teacher_evaluated':
                return <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-bold text-purple-600 dark:text-purple-400">Profesor Evaluó</span>;
            case 'both_evaluated':
                return <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-bold text-green-600 dark:text-green-400">Completa</span>;
            default:
                return null;
        }
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return 'text-gray-400';
        if (score >= 70) return 'text-green-600 dark:text-green-400';
        if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    return (
        <PageLayout title="Evaluaciones de Audio">
            <div className="space-y-6">
                {/* Filters */}
                <div className="p-6 glass border-black/5 dark:border-white/5 rounded-3xl bg-black/[0.02] dark:bg-black/20">
                    <div className="flex items-center gap-3 mb-4">
                        <Filter className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Filtros</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</label>
                            <select
                                value={filters.status || ''}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                                className="w-full mt-1 px-4 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20"
                            >
                                <option value="">Todos</option>
                                <option value="pending">Pendiente</option>
                                <option value="ai_evaluated">Solo IA</option>
                                <option value="teacher_evaluated">Solo Profesor</option>
                                <option value="both_evaluated">Completa</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Curso ID</label>
                            <input
                                type="text"
                                value={filters.course_id || ''}
                                onChange={(e) => setFilters({ ...filters, course_id: e.target.value || undefined })}
                                placeholder="UUID del curso"
                                className="w-full mt-1 px-4 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lección ID</label>
                            <input
                                type="text"
                                value={filters.lesson_id || ''}
                                onChange={(e) => setFilters({ ...filters, lesson_id: e.target.value || undefined })}
                                placeholder="UUID de la lección"
                                className="w-full mt-1 px-4 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setFilters({});
                            fetchEvaluations();
                        }}
                        className="mt-4 flex items-center gap-2 px-4 py-2 glass hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-sm font-bold text-purple-600 dark:text-purple-400 transition-all"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Limpiar filtros
                    </button>
                </div>

                {/* Evaluations Table */}
                <div className="glass border-black/5 dark:border-white/5 rounded-3xl bg-black/[0.02] dark:bg-black/20 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-b border-black/5 dark:border-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Estudiante</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Curso / Lección</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Prompt</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Transcripción</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">IA</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Profesor</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Estado</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Fecha</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center">
                                            <div className="flex items-center justify-center gap-3 text-gray-400">
                                                <RefreshCcw className="w-6 h-6 animate-spin" />
                                                <span className="text-sm font-medium">Cargando evaluaciones...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : evaluations.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                                            <Mic className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm font-medium">No hay evaluaciones de audio</p>
                                        </td>
                                    </tr>
                                ) : (
                                    evaluations.map((eval_) => (
                                        <tr key={eval_.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                        {eval_.student_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{eval_.student_name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{eval_.student_email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-[200px]">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={eval_.course_title}>{eval_.course_title}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={eval_.lesson_title}>{eval_.lesson_title}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={eval_.prompt}>{eval_.prompt}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={eval_.transcript || ''}>
                                                    {eval_.transcript || <span className="text-gray-400 italic">Sin transcripción</span>}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {eval_.ai_score !== null ? (
                                                    <div className="space-y-1">
                                                        <p className={`text-lg font-black ${getScoreColor(eval_.ai_score)}`}>{eval_.ai_score}%</p>
                                                        {eval_.ai_found_keywords && eval_.ai_found_keywords.length > 0 && (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                Keywords: {eval_.ai_found_keywords.join(', ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {eval_.teacher_score !== null ? (
                                                    <p className={`text-lg font-black ${getScoreColor(eval_.teacher_score)}`}>{eval_.teacher_score}%</p>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(eval_.status)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(eval_.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handlePlayAudio(eval_.id)}
                                                        className="p-2 glass hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all"
                                                        title="Reproducir audio"
                                                    >
                                                        {playingId === eval_.id ? (
                                                            <Pause className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                        ) : (
                                                            <Play className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedEvaluation(eval_)}
                                                        className="p-2 glass hover:bg-purple-500/10 rounded-lg transition-all"
                                                        title="Evaluar"
                                                    >
                                                        <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Evaluation Modal */}
                {selectedEvaluation && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="glass border-black/5 dark:border-white/5 rounded-3xl bg-white dark:bg-gray-900 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">Evaluar Respuesta de Audio</h3>
                                    <button
                                        onClick={() => setSelectedEvaluation(null)}
                                        className="p-2 glass hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all"
                                    >
                                        <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                    </button>
                                </div>

                                {/* Student Info */}
                                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20">
                                    <div className="flex items-center gap-3 mb-2">
                                        <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{selectedEvaluation.student_name}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <BookOpen className="w-4 h-4 text-gray-500" />
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{selectedEvaluation.course_title} → {selectedEvaluation.lesson_title}</p>
                                    </div>
                                </div>

                                {/* Prompt */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prompt</label>
                                    <p className="mt-1 text-lg font-medium text-gray-900 dark:text-gray-100">{selectedEvaluation.prompt}</p>
                                </div>

                                {/* Transcript */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transcripción</label>
                                    <p className="mt-1 p-4 bg-black/5 dark:bg-white/5 rounded-xl text-gray-700 dark:text-gray-300">
                                        {selectedEvaluation.transcript || <span className="italic text-gray-400">Sin transcripción disponible</span>}
                                    </p>
                                </div>

                                {/* AI Evaluation */}
                                {selectedEvaluation.ai_score !== null && (
                                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <BrainCircuit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Evaluación de IA</label>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{selectedEvaluation.ai_score}%</p>
                                        </div>
                                        {selectedEvaluation.ai_feedback && (
                                            <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{selectedEvaluation.ai_feedback}"</p>
                                        )}
                                    </div>
                                )}

                                {/* Teacher Evaluation */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Puntuación (0-100)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={teacherScore}
                                            onChange={(e) => setTeacherScore(parseInt(e.target.value))}
                                            className="w-full mt-1 px-4 py-3 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feedback</label>
                                        <textarea
                                            value={teacherFeedback}
                                            onChange={(e) => setTeacherFeedback(e.target.value)}
                                            placeholder="Escribe tu feedback para el estudiante..."
                                            rows={4}
                                            className="w-full mt-1 px-4 py-3 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setSelectedEvaluation(null)}
                                        className="flex-1 py-3 glass hover:bg-black/5 dark:hover:bg-white/10 rounded-xl font-bold text-gray-600 dark:text-gray-300 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSubmitEvaluation}
                                        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-bold text-white shadow-lg shadow-purple-500/30 transition-all"
                                    >
                                        Guardar Evaluación
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageLayout>
    );
}
