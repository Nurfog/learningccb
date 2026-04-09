"use client";

import { useState } from "react";
import { Check, CheckCircle2, Plus, Target } from "lucide-react";

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct: number[];
    type?: 'multiple-choice' | 'true-false' | 'multiple-select';
}

interface QuizBlockProps {
    id: string;
    title?: string;
    quizData: {
        questions: QuizQuestion[];
    };
    editMode: boolean;
    onChange: (data: { title?: string; quiz_data?: { questions: QuizQuestion[] } }) => void;
}

export default function QuizBlock({ id, title, quizData, editMode, onChange }: QuizBlockProps) {
    const [userAnswers, setUserAnswers] = useState<Record<string, number[]>>({});
    const [submitted, setSubmitted] = useState(false);

    const toDisplayText = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value.map((v) => toDisplayText(v)).filter(Boolean).join(', ');
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

    const questions = quizData.questions || [];

    const addQuestion = () => {
        const newQuestion: QuizQuestion = {
            id: Math.random().toString(36).substr(2, 9),
            question: "New Question?",
            options: ["Option 1", "Option 2"],
            correct: [0],
            type: 'multiple-choice'
        };
        onChange({ quiz_data: { questions: [...questions, newQuestion] } });
    };

    const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], ...updates };
        onChange({ quiz_data: { questions: newQuestions } });
    };

    const toggleCorrectOption = (qIdx: number, optIdx: number, isMulti: boolean) => {
        const current = questions[qIdx].correct || [];
        if (isMulti) {
            const next = current.includes(optIdx)
                ? current.filter(i => i !== optIdx)
                : [...current, optIdx].sort((a, b) => a - b);
            updateQuestion(qIdx, { correct: next.length ? next : [0] });
        } else {
            updateQuestion(qIdx, { correct: [optIdx] });
        }
    };

    const handleAnswer = (qId: string, optionIndex: number, isMulti: boolean) => {
        if (submitted) return;
        setUserAnswers(prev => {
            const current = prev[qId] || [];
            if (isMulti) {
                const next = current.includes(optionIndex)
                    ? current.filter(i => i !== optionIndex)
                    : [...current, optionIndex].sort((a, b) => a - b);
                return { ...prev, [qId]: next };
            } else {
                return { ...prev, [qId]: [optionIndex] };
            }
        });
    };

    return (
        <div className="space-y-8" id={id}>
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-4 p-8 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] mb-6 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/40"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Mastery Challenge, Knowledge Synthesis..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-blue-600 pl-6 py-1">
                        {title || "Knowledge Synthesis"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    {questions.map((q, idx) => (
                        <div key={q.id} className="p-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-8 rounded-[2.5rem] relative group/question animate-in slide-in-from-bottom-4 duration-500 shadow-sm hover:shadow-xl hover:border-blue-500/20 transition-all">
                            <div className="flex items-center justify-between gap-6">
                                <div className="flex bg-slate-100 dark:bg-white/5 rounded-2xl p-1.5 border border-slate-200 dark:border-white/5 shadow-inner">
                                    <button
                                        onClick={() => updateQuestion(idx, { type: 'multiple-choice', correct: [q.correct?.[0] || 0] })}
                                        className={`px-4 py-2 text-[9px] uppercase font-black tracking-widest rounded-xl transition-all ${q.type === 'multiple-choice' ? "bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                        Choice
                                    </button>
                                    <button
                                        onClick={() => updateQuestion(idx, { type: 'multiple-select', correct: [q.correct?.[0] || 0] })}
                                        className={`px-4 py-2 text-[9px] uppercase font-black tracking-widest rounded-xl transition-all ${q.type === 'multiple-select' ? "bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                        Multi
                                    </button>
                                    <button
                                        onClick={() => updateQuestion(idx, { type: 'true-false', options: ["True", "False"], correct: [0] })}
                                        className={`px-4 py-2 text-[9px] uppercase font-black tracking-widest rounded-xl transition-all ${q.type === 'true-false' ? "bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                        Binary
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        const newQuestions = questions.filter((_, i) => i !== idx);
                                        onChange({ quiz_data: { questions: newQuestions } });
                                    }}
                                    className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-100 dark:border-transparent active:scale-90"
                                >
                                    <span className="text-xl">×</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Inquiry Description</label>
                                <textarea
                                    value={toDisplayText(q.question)}
                                    onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-lg font-black tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300 resize-none shadow-inner h-24"
                                    placeholder="What is the core problem being evaluated?"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Configuration Matrix</label>
                                {q.type === 'true-false' ? (
                                    <div className="flex gap-4">
                                        {["True", "False"].map((opt, oIdx) => (
                                            <button
                                                key={oIdx}
                                                onClick={() => updateQuestion(idx, { correct: [oIdx] })}
                                                className={`flex-1 py-5 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-sm ${q.correct?.includes(oIdx) ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 scale-[1.02] shadow-blue-500/10" : "border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 hover:border-slate-200"}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {q.options?.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex gap-4 items-center group/opt">
                                                <div className="relative flex items-center justify-center">
                                                    <input
                                                        type={q.type === 'multiple-select' ? "checkbox" : "radio"}
                                                        checked={q.correct?.includes(oIdx)}
                                                        onChange={() => toggleCorrectOption(idx, oIdx, q.type === 'multiple-select')}
                                                        className="w-6 h-6 rounded-lg border-2 border-slate-200 dark:border-white/10 appearance-none checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer shadow-sm"
                                                    />
                                                    {q.correct?.includes(oIdx) && (
                                                        <div className="absolute pointer-events-none text-white text-[10px]">
                                                            <Check size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    value={toDisplayText(opt)}
                                                    onChange={(e) => {
                                                        const newOpts = [...q.options];
                                                        newOpts[oIdx] = e.target.value;
                                                        updateQuestion(idx, { options: newOpts });
                                                    }}
                                                    className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none shadow-inner"
                                                    placeholder={`Option Vector ${String.fromCharCode(65 + oIdx)}`}
                                                />
                                                {q.options.length > 2 && (
                                                    <button
                                                        onClick={() => {
                                                            const newOpts = q.options.filter((_, i) => i !== oIdx);
                                                            const newCorrect = q.correct?.filter(i => i !== oIdx).map(i => i > oIdx ? i - 1 : i);
                                                            updateQuestion(idx, { options: newOpts, correct: newCorrect?.length ? newCorrect : [0] });
                                                        }}
                                                        className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-300 hover:text-red-500 transition-all border border-slate-200 dark:border-transparent flex items-center justify-center active:scale-90"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {q.type !== 'true-false' && (
                                    <button
                                        onClick={() => updateQuestion(idx, { options: [...q.options, `Option ${q.options.length + 1}`] })}
                                        className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 hover:text-blue-700 transition-all flex items-center gap-2 pl-10 mt-4 active:scale-95"
                                    >
                                        <Plus size={14} /> Add Theoretical Vector
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={addQuestion}
                        className="w-full py-6 bg-white dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-400 dark:text-gray-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all font-black text-[10px] uppercase tracking-[0.3em] rounded-[2rem] active:scale-[0.98] shadow-sm"
                    >
                        + Expand Assessment Vector
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {questions.map((q) => (
                        <div key={q.id} className="space-y-6 p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-700 group/qitem relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover/qitem:bg-indigo-500/10 transition-colors"></div>
                            <h4 className="font-black text-2xl text-slate-900 dark:text-white leading-tight uppercase tracking-tight relative z-10">{toDisplayText(q.question)}</h4>
                            <div className="grid gap-3">
                                {q.options && q.options.length > 0 ? (
                                    q.options.map((opt, oIdx) => {
                                        const isSelected = userAnswers[q.id]?.includes(oIdx);
                                        const isCorrect = q.correct?.includes(oIdx);
                                        const isActuallyCorrect = isCorrect && isSelected;
                                        const isWrongSelection = !isCorrect && isSelected;
                                        const missedCorrect = isCorrect && !isSelected;

                                        const style = submitted
                                            ? (isActuallyCorrect ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 shadow-green-500/5 shadow-inner"
                                                : isWrongSelection ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 shadow-red-500/5 shadow-inner"
                                                    : missedCorrect ? "border-orange-500/50 bg-orange-50 dark:bg-orange-500/5 text-orange-700 dark:text-orange-400 border-dashed animate-pulse"
                                                        : "opacity-40 grayscale border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5")
                                            : isSelected ? "bg-blue-50 dark:bg-blue-500/10 border-blue-600 text-blue-700 dark:text-blue-400 shadow-xl shadow-blue-500/10 ring-4 ring-blue-500/5"
                                                : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-500 dark:text-gray-400 hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-blue-500/5 shadow-sm";

                                        return (
                                            <button
                                                key={oIdx}
                                                onClick={() => handleAnswer(q.id, oIdx, q.type === 'multiple-select')}
                                                className={`p-6 rounded-2xl border transition-all text-left text-sm font-black uppercase tracking-tight relative overflow-hidden group/optans ${style}`}
                                            >
                                                <div className="flex items-center justify-between relative z-10">
                                                    <span>{toDisplayText(opt)}</span>
                                                    {submitted ? (
                                                        <div className="flex items-center gap-2">
                                                            {isActuallyCorrect && <span className="text-green-600 dark:text-green-400"><CheckCircle2 size={18} /></span>}
                                                            {isWrongSelection && <span className="text-red-600 dark:text-red-400">❌</span>}
                                                            {missedCorrect && <span className="text-[8px] uppercase font-black tracking-widest bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full">Recall target</span>}
                                                        </div>
                                                    ) : (
                                                        <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/40 text-white' : 'border-slate-200 dark:border-white/10'}`}>
                                                            {isSelected && <Check size={14} />}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-orange-400/50 font-medium italic p-4 border border-dashed border-orange-500/20 rounded-xl">
                                        No options generated for this question.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {!submitted && questions.length > 0 && (
                        <button
                            onClick={() => setSubmitted(true)}
                            className="w-full py-6 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-[2rem] flex items-center justify-center gap-4"
                        >
                            <Target size={18} />
                            Validate Synaptic Map
                        </button>
                    )}
                    {submitted && (
                        <button
                            onClick={() => { setSubmitted(false); setUserAnswers({}); }}
                            className="w-full py-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 transition-all rounded-[2rem] active:scale-[0.98] shadow-sm"
                        >
                            Reset Neural Chain
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
