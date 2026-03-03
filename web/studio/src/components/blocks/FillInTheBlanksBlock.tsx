"use client";

import { useState, useMemo } from "react";

interface FillInTheBlanksBlockProps {
    id: string;
    title?: string;
    content: string;
    editMode: boolean;
    onChange: (updates: { title?: string; content?: string }) => void;
}

export default function FillInTheBlanksBlock({ id, title, content, editMode, onChange }: FillInTheBlanksBlockProps) {
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [submitted, setSubmitted] = useState(false);

    // Parse content to find blanks
    const parsed = useMemo(() => {
        const parts: { type: 'text' | 'blank'; value?: string; index?: number; answer?: string }[] = [];
        const answers: string[] = [];
        let lastIndex = 0;
        const regex = /\[\[(.*?)\]\]/g;
        let match;

        while ((match = regex.exec(content)) !== null) {
            // Push text before the blank
            parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
            // Push the blank
            const answer = match[1];
            parts.push({ type: 'blank', index: answers.length, answer });
            answers.push(answer);
            lastIndex = regex.lastIndex;
        }
        // Push remaining text
        parts.push({ type: 'text', value: content.substring(lastIndex) });

        return { parts, answers };
    }, [content]);

    const handleReset = () => {
        setSubmitted(false);
        setUserAnswers([]);
    };

    const isCorrect = (index: number) => {
        return userAnswers[index]?.trim().toLowerCase() === parsed.answers[index]?.trim().toLowerCase();
    };

    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-4 p-8 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] mb-6 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/40"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Fill the gaps, Quote..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-blue-600 pl-6 py-1">
                        {title || "Fill in the Blanks"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-8">
                    <div className="p-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Semantic Matrix (use [[answer]])</label>
                        <textarea
                            value={content}
                            onChange={(e) => onChange({ content: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-6 min-h-[150px] text-lg font-black tracking-tight text-slate-800 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300 resize-none shadow-inner"
                            placeholder="Example: The [[capital]] of France is [[Paris]]."
                        />
                        <p className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-black italic pl-1 leading-relaxed">Neural Protocol: Encapsulate target markers within double square brackets.</p>
                    </div>
                </div>
            ) : (
                <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[3rem] space-y-10 shadow-sm hover:shadow-xl transition-all duration-700 relative overflow-hidden group/fbitem">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/fbitem:bg-indigo-500/10 transition-colors"></div>
                    <div className="text-2xl font-black text-slate-800 dark:text-gray-100 uppercase tracking-tight leading-loose relative z-10">
                        {parsed.parts.map((part, i) => (
                            part.type === 'text' ? (
                                <span key={i} className="mx-0.5">{part.value}</span>
                            ) : (
                                <input
                                    key={i}
                                    type="text"
                                    value={userAnswers[part.index!] || ""}
                                    onChange={(e) => {
                                        const newAnswers = [...userAnswers];
                                        newAnswers[part.index!] = e.target.value;
                                        setUserAnswers(newAnswers);
                                    }}
                                    disabled={submitted}
                                    className={`mx-2 px-4 py-1 border-b-4 bg-slate-50 dark:bg-black/20 transition-all focus:outline-none text-center rounded-t-xl font-black uppercase tracking-widest placeholder:text-slate-300 ${submitted
                                        ? (isCorrect(part.index!) ? "border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10" : "border-red-500 text-red-700 dark:text-red-100 bg-red-50 dark:bg-red-500/10")
                                        : "border-blue-500/40 focus:border-blue-600 text-blue-600 dark:text-blue-400 focus:bg-blue-500/5"
                                        }`}
                                    style={{ width: `${Math.max((part.answer?.length || 5) * 16, 120)}px` }}
                                    placeholder="?"
                                />
                            )
                        ))}
                    </div>

                    {!submitted && parsed.answers.length > 0 && (
                        <button
                            onClick={() => setSubmitted(true)}
                            className="w-full py-6 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-[2rem] flex items-center justify-center gap-4 relative z-10"
                        >
                            Execute Linguistic Validation
                        </button>
                    )}

                    {submitted && (
                        <button
                            onClick={handleReset}
                            className="w-full py-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 transition-all rounded-[2rem] active:scale-[0.98] shadow-sm relative z-10"
                        >
                            Reset Semantic Chain
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
