'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { questionBankApi, QuestionBank, QuestionBankFilters } from '@/lib/api';
import {
    Plus, Search, Filter,
    Upload, BookOpen
} from 'lucide-react';
import QuestionBankEditor from '@/components/QuestionBank/QuestionBankEditor';
import QuestionBankCard from '@/components/QuestionBank/QuestionBankCard';
import MySQLImportModal from '@/components/QuestionBank/MySQLImportModal';

const isMySqlOrigin = (source?: string) => source === 'imported-mysql' || source === 'sam-diagnostico';
const isMaterialsOrigin = (source?: string) => source === 'imported-material';
const isAiOrigin = (source?: string) => source === 'ai-generated';

const toSafeText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map((v) => toSafeText(v)).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (typeof obj.answer === 'string') return obj.answer;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.label === 'string') return obj.label;
        try {
            return JSON.stringify(obj);
        } catch {
            return '';
        }
    }
    return '';
};

const sanitizeQuestion = (q: QuestionBank): QuestionBank => {
    const safeTags = Array.isArray(q.tags)
        ? q.tags.map((t) => toSafeText(t)).filter(Boolean)
        : [];

    const safeOptions = Array.isArray(q.options)
        ? q.options.map((opt) => {
            if (typeof opt === 'object' && opt !== null) {
                const item = opt as Record<string, unknown>;
                if ('answer' in item || 'keywords' in item) {
                    return toSafeText(item.answer ?? item.text ?? item.label ?? item);
                }
            }
            return opt;
        })
        : q.options;

    const safeCorrectAnswer = (() => {
        const raw = q.correct_answer;
        if (Array.isArray(raw)) {
            return raw.map((item) => toSafeText(item));
        }
        if (raw && typeof raw === 'object') {
            const item = raw as Record<string, unknown>;
            if ('answer' in item || 'keywords' in item || 'text' in item || 'label' in item) {
                return toSafeText(item);
            }
        }
        return raw;
    })();

    return {
        ...q,
        question_text: toSafeText(q.question_text),
        tags: safeTags,
        options: safeOptions,
        correct_answer: safeCorrectAnswer,
    };
};

export default function QuestionBankPage() {
    const [questions, setQuestions] = useState<QuestionBank[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<QuestionBankFilters>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<QuestionBank | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const loadQuestions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await questionBankApi.list(filters);
            setQuestions(data.map(sanitizeQuestion));
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to load questions:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadQuestions();
    }, [loadQuestions]);

    const handleCreate = () => {
        setEditingQuestion(null);
        setShowEditor(true);
    };

    const handleEdit = (question: QuestionBank) => {
        setEditingQuestion(question);
        setShowEditor(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta pregunta?')) return;

        try {
            await questionBankApi.delete(id);
            await loadQuestions();
        } catch (error) {
            console.error('Failed to delete question:', error);
            alert('Error al eliminar la pregunta');
        }
    };

    const handleImportSuccess = async () => {
        setShowImportModal(false);
        await loadQuestions();
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Banco de Preguntas
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Gestiona preguntas reutilizables con audio para tus evaluaciones
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Importar desde MySQL
                            </button>
                            <button
                                onClick={handleCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Nueva Pregunta
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{questions.length}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Preguntas</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <div className="text-2xl font-bold text-blue-600">
                            {questions.filter(q => isMySqlOrigin(q.source)).length}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Importadas MySQL</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <div className="text-2xl font-bold text-emerald-600">
                            {questions.filter(q => isMaterialsOrigin(q.source)).length}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Materiales ZIP</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <div className="text-2xl font-bold text-purple-600">
                            {questions.filter(q => isAiOrigin(q.source)).length}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Generadas IA</div>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="mb-6 flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar preguntas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && loadQuestions()}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                            showFilters ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                    </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tipo de Pregunta
                            </label>
                            <select
                                value={filters.question_type || ''}
                                onChange={(e) => setFilters({ ...filters, question_type: (e.target.value || undefined) as QuestionBankFilters['question_type'] })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Todos los tipos</option>
                                <option value="multiple-choice">Opción Múltiple</option>
                                <option value="true-false">Verdadero/Falso</option>
                                <option value="short-answer">Respuesta Corta</option>
                                <option value="essay">Ensayo</option>
                                <option value="matching">Emparejamiento</option>
                                <option value="ordering">Ordenar</option>
                                <option value="fill-in-the-blanks">Completar</option>
                                <option value="audio-response">Respuesta Audio</option>
                                <option value="hotspot">Hotspot</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Dificultad
                            </label>
                            <select
                                value={filters.difficulty || ''}
                                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value || undefined })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Todas</option>
                                <option value="easy">Fácil</option>
                                <option value="medium">Media</option>
                                <option value="hard">Difícil</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Origen
                            </label>
                            <select
                                value={filters.source || ''}
                                onChange={(e) => setFilters({ ...filters, source: e.target.value || undefined })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Todos</option>
                                <option value="mysql">Importadas MySQL</option>
                                <option value="materials">Importadas desde Materiales ZIP</option>
                                <option value="ai">Generadas por IA</option>
                                <option value="manual">Creadas manualmente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Audio
                            </label>
                            <select
                                value={filters.has_audio ? 'true' : filters.has_audio === false ? 'false' : ''}
                                onChange={(e) => setFilters({ ...filters, has_audio: e.target.value === '' ? undefined : e.target.value === 'true' })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Todos</option>
                                <option value="true">Con Audio</option>
                                <option value="false">Sin Audio</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Questions Grid */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando preguntas...</p>
                    </div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                        <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No hay preguntas</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Crea preguntas manualmente o impórtalas desde MySQL
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-3">
                            <button
                                onClick={handleCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Nueva Pregunta
                            </button>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Importar desde MySQL
                            </button>
                        </div>
                    </div>
                ) : (() => {
                    const totalPages = Math.ceil(questions.length / pageSize);
                    const paginated = questions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                    return (
                        <>
                            {/* Page size + info */}
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, questions.length)} de {questions.length} preguntas
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Por página:</span>
                                    {[20, 50, 100].map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => { setPageSize(size); setCurrentPage(1); }}
                                            className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                                                pageSize === size
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {paginated.map((question) => (
                                    <QuestionBankCard
                                        key={question.id}
                                        question={question}
                                        onEdit={() => handleEdit(question)}
                                        onDelete={() => handleDelete(question.id)}
                                    />
                                ))}
                            </div>

                            {/* Pagination controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-8">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed"
                                    >
                                        «
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed"
                                    >
                                        ‹
                                    </button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, idx) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => setCurrentPage(p as number)}
                                                    className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                                                        currentPage === p
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        )}

                                    <button
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed"
                                    >
                                        ›
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed"
                                    >
                                        »
                                    </button>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Editor Modal */}
            {showEditor && (
                <QuestionBankEditor
                    question={editingQuestion}
                    onSuccess={() => {
                        setShowEditor(false);
                        loadQuestions();
                    }}
                    onCancel={() => setShowEditor(false)}
                />
            )}

            {/* Import Modal */}
            {showImportModal && (
                <MySQLImportModal
                    onSuccess={handleImportSuccess}
                    onCancel={() => setShowImportModal(false)}
                />
            )}
        </div>
    );
}
