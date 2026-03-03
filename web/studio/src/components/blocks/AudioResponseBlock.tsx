"use client";

import { Mic, Clock, Tag } from "lucide-react";

interface AudioResponseBlockProps {
    id: string;
    title?: string;
    prompt: string;
    keywords?: string[];
    timeLimit?: number; // in seconds
    editMode: boolean;
    onChange: (updates: { title?: string; prompt?: string; keywords?: string[]; timeLimit?: number }) => void;
}

export default function AudioResponseBlock({
    id,
    title,
    prompt,
    keywords = [],
    timeLimit,
    editMode,
    onChange
}: AudioResponseBlockProps) {
    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-4 p-8 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] mb-6 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/40"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Speaking Practice, Pronunciation Test..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-purple-600 pl-6 py-1">
                        {title || "Audio Response"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    <div className="p-8 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm relative overflow-hidden group/prompt">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Mic className="w-4 h-4 text-purple-600" />
                            Phonetic Inquiry (Prompt)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onChange({ prompt: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl p-6 min-h-[120px] text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition-all shadow-inner placeholder:opacity-20"
                            placeholder="WHAT IS THE ENIGMA TO BE SPOKEN?..."
                        />
                    </div>

                    <div className="p-8 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Tag className="w-4 h-4 text-purple-600" />
                            Lexical Anchors (Expected Keywords)
                        </label>
                        <textarea
                            value={keywords.join("\n")}
                            onChange={(e) => onChange({ keywords: e.target.value.split("\n").filter(k => k.trim() !== "") })}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl p-6 min-h-[100px] text-sm font-bold text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition-all shadow-inner"
                            placeholder="Keyword Alpha&#10;Keyword Beta..."
                        />
                        <p className="text-[9px] text-slate-400 dark:text-gray-600 uppercase font-black italic pl-1 italic">
                            Singular entry per line. Syntactic scan for automatic validation.
                        </p>
                    </div>

                    <div className="p-8 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Clock className="w-4 h-4 text-purple-600" />
                            Temporal Ceiling (Seconds)
                        </label>
                        <input
                            type="number"
                            value={timeLimit || ""}
                            onChange={(e) => onChange({ timeLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                            placeholder="60"
                            min="10"
                            max="300"
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 dark:text-white focus:ring-4 focus:ring-purple-500/10 transition-all outline-none"
                        />
                        <p className="text-[9px] text-slate-400 dark:text-gray-600 uppercase font-black italic pl-1 italic">
                            Maximum temporal window (10-300). Null for unconstrained stream.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[3rem] space-y-10 shadow-sm relative overflow-hidden group/audioplay">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/audioplay:bg-purple-500/10 transition-colors"></div>

                    <div className="flex items-start gap-8 relative z-10">
                        <div className="p-5 bg-purple-100 dark:bg-purple-500/10 rounded-2xl shadow-inner border border-purple-200 dark:border-purple-500/20">
                            <Mic className="w-8 h-8 text-purple-700 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <p className="text-2xl font-black text-slate-800 dark:text-gray-100 tracking-tight uppercase italic leading-tight">{prompt || "Awaiting phonetic capture..."}</p>

                            <div className="flex flex-wrap items-center gap-6">
                                {keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {keywords.slice(0, 5).map((kw, i) => (
                                            <span key={i} className="px-3 py-1 bg-slate-50 dark:bg-purple-500/5 border border-slate-100 dark:border-purple-500/20 rounded-lg text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-widest shadow-sm">
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {timeLimit && (
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-purple-500" />
                                        Temporal Window: {timeLimit}s
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-10 bg-purple-50/50 dark:bg-purple-500/5 border-2 border-dashed border-purple-200 dark:border-purple-500/20 rounded-[2.5rem] text-center space-y-3 relative z-10 group-hover/audioplay:border-purple-400 transition-colors duration-500">
                        <div className="w-16 h-1 w-1 bg-purple-200 dark:bg-purple-500/20 mx-auto rounded-full mb-4"></div>
                        <p className="text-[10px] font-black text-purple-900 dark:text-purple-400 uppercase tracking-[0.3em]">
                            Phonetic Engine Interface
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-gray-600 uppercase font-black italic">
                            Capture node will manifest within the Experience stream
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
