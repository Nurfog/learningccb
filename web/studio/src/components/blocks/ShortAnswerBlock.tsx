"use client";

import { useState } from "react";

interface ShortAnswerBlockProps {
    id: string;
    title?: string;
    prompt: string;
    correctAnswers: string[];
    editMode: boolean;
    onChange: (updates: { title?: string; prompt?: string; correctAnswers?: string[] }) => void;
}

export default function ShortAnswerBlock({ id, title, prompt, correctAnswers, editMode, onChange }: ShortAnswerBlockProps) {
    const [userAnswer, setUserAnswer] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleReset = () => {
        setSubmitted(false);
        setUserAnswer("");
    };

    const isCorrect = correctAnswers.some(ans => ans.trim().toLowerCase() === userAnswer.trim().toLowerCase());

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
                            placeholder="e.g. Critical Thinking, Quick Response..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-blue-600 pl-6 py-1">
                        {title || "Short Answer"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-8">
                    <div className="p-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Inquiry Vector (Question Prompt)</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onChange({ prompt: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-6 min-h-[120px] text-lg font-black tracking-tight text-slate-800 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300 resize-none shadow-inner"
                            placeholder="Type the synaptic trigger for the student..."
                        />
                    </div>

                    <div className="p-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Target Response Matrix (One per line)</label>
                        <textarea
                            value={correctAnswers ? correctAnswers.join("\n") : ""}
                            onChange={(e) => onChange({ correctAnswers: e.target.value.split("\n").filter(a => a.trim() !== "") })}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-6 min-h-[120px] text-sm font-bold text-green-700 dark:text-green-400 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all outline-none shadow-inner"
                            placeholder="Primary Solution&#10;Secondary Vector (Alternative)"
                        />
                        <p className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-black italic pl-1 leading-relaxed">Validation employs case-insensitive string matching across all vectors.</p>
                    </div>
                </div>
            ) : (
                <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[3rem] space-y-10 shadow-sm hover:shadow-xl transition-all duration-700 relative overflow-hidden group/saitem">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/saitem:bg-blue-500/10 transition-colors"></div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight relative z-10">{prompt || "Please formulate your response vector:"}</p>

                    <div className="space-y-6 relative z-10">
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            disabled={submitted}
                            className={`w-full bg-slate-50 dark:bg-black/40 border-2 rounded-[2rem] px-8 py-6 text-xl font-black tracking-tight transition-all focus:outline-none shadow-inner ${submitted
                                ? (isCorrect ? "border-green-500 text-green-700 dark:text-green-400 ring-4 ring-green-500/5" : "border-red-500 text-red-700 dark:text-red-100 ring-4 ring-red-500/5")
                                : "border-slate-100 dark:border-white/10 focus:border-blue-600 text-slate-800 dark:text-white focus:ring-8 focus:ring-blue-500/5"
                                }`}
                            placeholder="Ingest solution..."
                        />

                        {submitted && !isCorrect && (
                            <div className="p-6 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-500">
                                <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase font-black tracking-[0.2em]">Validated Synaptic Marker:</p>
                                <p className="text-lg font-black text-slate-700 dark:text-gray-300 mt-2 italic">"{correctAnswers && correctAnswers[0]}"</p>
                            </div>
                        )}
                    </div>

                    {!submitted && (
                        <button
                            onClick={() => setSubmitted(true)}
                            disabled={!userAnswer.trim()}
                            className="w-full py-6 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-[2rem] flex items-center justify-center gap-4 disabled:opacity-20 disabled:hover:scale-100"
                        >
                            Execute Validation
                        </button>
                    )}

                    {submitted && (
                        <button
                            onClick={handleReset}
                            className="w-full py-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 transition-all rounded-[2rem] active:scale-[0.98] shadow-sm"
                        >
                            Reset Response Vector
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
