'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, MessageSquare, RefreshCw, Send, Trash2 } from 'lucide-react';
import { FaqEntry, FaqReviewItem, lmsApi } from '@/lib/api';

type QueueStatus = 'pending' | 'answered' | 'published' | 'dismissed';

const statusOptions: Array<{ value: QueueStatus | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'answered', label: 'Respondidas' },
    { value: 'published', label: 'Publicadas en FAQ' },
    { value: 'dismissed', label: 'Descartadas' },
];

export default function AdminFaqReviewPage() {
    const [status, setStatus] = useState<QueueStatus | ''>('pending');
    const [items, setItems] = useState<FaqReviewItem[]>([]);
    const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [formState, setFormState] = useState<Record<string, { answer: string; note: string; tags: string }>>({});

    const pendingCount = useMemo(() => items.filter((i) => i.status === 'pending').length, [items]);

    const loadData = async (selectedStatus: QueueStatus | '' = status) => {
        setLoading(true);
        try {
            const [queue, entries] = await Promise.all([
                lmsApi.getFaqReviewQueue(selectedStatus || undefined, 100, 0),
                lmsApi.listFaqEntries(undefined, 20, 0),
            ]);
            setItems(queue.items);
            setFaqEntries(entries);
        } catch (err) {
            console.error('Error loading FAQ moderation data', err);
            alert('No se pudo cargar la cola de FAQ.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleImportCandidates = async () => {
        setImporting(true);
        try {
            const result = await lmsApi.importFaqCandidates(100);
            alert(`Importadas: ${result.imported}. Omitidas: ${result.skipped}.`);
            await loadData();
        } catch (err) {
            console.error('Error importing FAQ candidates', err);
            alert('No se pudieron importar candidatos desde chats.');
        } finally {
            setImporting(false);
        }
    };

    const setLocalForm = (itemId: string, field: 'answer' | 'note' | 'tags', value: string) => {
        setFormState((prev) => ({
            ...prev,
            [itemId]: {
                answer: prev[itemId]?.answer ?? '',
                note: prev[itemId]?.note ?? '',
                tags: prev[itemId]?.tags ?? '',
                [field]: value,
            },
        }));
    };

    const submitAnswer = async (item: FaqReviewItem, publishToFaq: boolean) => {
        const local = formState[item.id] ?? { answer: '', note: '', tags: '' };
        const answer = local.answer.trim();
        if (!answer) {
            alert('Debes escribir una respuesta humana.');
            return;
        }

        const tags = local.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

        setWorkingId(item.id);
        try {
            await lmsApi.answerFaqReviewItem(item.id, {
                human_answer: answer,
                reviewer_note: local.note.trim() || undefined,
                publish_to_faq: publishToFaq,
                tags: tags.length ? tags : undefined,
            });
            await loadData();
        } catch (err) {
            console.error('Error answering FAQ review item', err);
            alert('No se pudo guardar la respuesta.');
        } finally {
            setWorkingId(null);
        }
    };

    const dismissItem = async (item: FaqReviewItem) => {
        const local = formState[item.id] ?? { answer: '', note: '', tags: '' };
        setWorkingId(item.id);
        try {
            await lmsApi.dismissFaqReviewItem(item.id, local.note.trim() || undefined);
            await loadData();
        } catch (err) {
            console.error('Error dismissing FAQ review item', err);
            alert('No se pudo descartar la consulta.');
        } finally {
            setWorkingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-indigo-600 p-2 text-white">
                            <MessageSquare size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Moderación FAQ desde IA</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Revisa consultas de alumnos sin buen contexto RAG, responde manualmente y publícalas al FAQ.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadData()}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                            <RefreshCw size={16} /> Refrescar
                        </button>
                        <button
                            onClick={handleImportCandidates}
                            disabled={importing}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {importing ? 'Importando...' : 'Importar desde chats'}
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Clock3 size={14} /> Pendientes: {pendingCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 size={14} /> FAQ publicadas: {faqEntries.length}
                    </span>
                    <select
                        value={status}
                        onChange={(e) => {
                            const next = e.target.value as QueueStatus | '';
                            setStatus(next);
                            loadData(next);
                        }}
                        className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-800"
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value || 'all'} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                    Cargando cola de revisión...
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 dark:border-white/20 dark:bg-slate-900 dark:text-slate-300">
                    No hay consultas para revisar con el filtro actual.
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => {
                        const local = formState[item.id] ?? {
                            answer: item.human_answer ?? '',
                            note: item.reviewer_note ?? '',
                            tags: '',
                        };

                        const isWorking = workingId === item.id;

                        return (
                            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-full bg-slate-100 px-2 py-1 font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        Estado: {item.status}
                                    </span>
                                    <span className={`rounded-full px-2 py-1 font-bold uppercase tracking-wide ${
                                        item.rag_context_found
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    }`}>
                                        {item.rag_context_found ? 'con RAG' : 'sin RAG útil'}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Alumno: {item.student_name || 'N/D'} ({item.student_email || 'sin email'})
                                    </span>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <h3 className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">Pregunta del alumno</h3>
                                        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100">
                                            {item.question_text}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">Respuesta actual IA</h3>
                                        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                                            {item.ai_response || 'Sin respuesta registrada'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Respuesta humana</label>
                                    <textarea
                                        value={local.answer}
                                        onChange={(e) => setLocalForm(item.id, 'answer', e.target.value)}
                                        rows={4}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-800"
                                        placeholder="Escribe la respuesta validada por un humano..."
                                    />

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <input
                                            value={local.tags}
                                            onChange={(e) => setLocalForm(item.id, 'tags', e.target.value)}
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-800"
                                            placeholder="Tags para FAQ (coma separada): grammar, pronunciation"
                                        />
                                        <input
                                            value={local.note}
                                            onChange={(e) => setLocalForm(item.id, 'note', e.target.value)}
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-800"
                                            placeholder="Nota interna del revisor"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => submitAnswer(item, false)}
                                        disabled={isWorking}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
                                    >
                                        <Send size={15} /> Guardar respuesta
                                    </button>
                                    <button
                                        onClick={() => submitAnswer(item, true)}
                                        disabled={isWorking}
                                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={15} /> Publicar en FAQ
                                    </button>
                                    <button
                                        onClick={() => dismissItem(item)}
                                        disabled={isWorking}
                                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        <Trash2 size={15} /> Descartar
                                    </button>
                                    {item.faq_entry_id && (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                            FAQ ID: {item.faq_entry_id}
                                        </span>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <h2 className="mb-3 text-lg font-black text-slate-900 dark:text-white">Ultimas FAQ publicadas</h2>
                {faqEntries.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Todavia no hay entradas publicadas.</p>
                ) : (
                    <ul className="space-y-3">
                        {faqEntries.map((entry) => (
                            <li key={entry.id} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.question}</p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{entry.answer}</p>
                                {entry.tags && entry.tags.length > 0 && (
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Tags: {entry.tags.join(', ')}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    Recomendacion: antes de publicar, valida que la respuesta aplique transversalmente y no dependa de una sesion individual.
                </div>
            </section>
        </div>
    );
}
