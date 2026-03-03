"use client";

import { useState } from "react";
import { Users, Send, CheckCircle2, ClipboardList, Info } from "lucide-react";

interface PeerReviewBlockProps {
    id: string;
    title?: string;
    prompt: string;
    reviewCriteria?: string;
    editMode: boolean;
    onChange: (updates: { title?: string; prompt?: string; reviewCriteria?: string }) => void;
}

export default function PeerReviewBlock({ id, title, prompt, reviewCriteria, editMode, onChange }: PeerReviewBlockProps) {
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
                            placeholder="e.g. Final Project Submission..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-purple-600 pl-6 py-1 flex items-center gap-3">
                        <Users className="w-6 h-6 text-purple-600" /> {title || "Peer Assessment"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-8">
                    <div className="p-8 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm relative overflow-hidden group/instr">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] pl-1">Assignment Directive (Instructions)</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onChange({ prompt: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl p-6 min-h-[120px] text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner placeholder:opacity-20"
                            placeholder="DESCRIBE THE CORE SUBMISSION PARAMETERS..."
                        />
                    </div>

                    <div className="p-8 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] space-y-4 shadow-sm relative overflow-hidden group/rubric">
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] pl-1">Evaluative Matrix (Rubric)</label>
                        <textarea
                            value={reviewCriteria || ""}
                            onChange={(e) => onChange({ reviewCriteria: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl p-6 min-h-[120px] text-sm font-bold text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition-all shadow-inner"
                            placeholder="Guide the peer reviewers on evaluative heuristics..."
                        />
                        <p className="text-[9px] text-slate-400 dark:text-gray-600 uppercase font-black italic pl-1 italic">Structural guidance for cross-student validation.</p>
                    </div>
                </div>
            ) : (
                <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[3rem] space-y-12 shadow-sm relative overflow-hidden group/peerplay">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 group-hover/peerplay:bg-purple-500/10 transition-colors"></div>

                    <div className="space-y-6 relative z-10">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-slate-300 dark:text-gray-600" />
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-gray-600 italic">Instructional Directive</label>
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-gray-100 leading-tight uppercase italic tracking-tight">{prompt || "Awaiting submission parameters..."}</p>
                    </div>

                    <div className="p-10 bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] relative z-10 hover:border-blue-500 transition-colors duration-500">
                        <div className="flex items-start gap-8 mb-8">
                            <div className="p-5 rounded-2xl bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-xl ring-4 ring-blue-500/10 animate-bounce">
                                <Send className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">Submission Terminal Interface</h5>
                                <p className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-widest italic pt-1">Active node for student document upload and textual stream.</p>
                            </div>
                        </div>
                        <div className="h-40 bg-white dark:bg-black/40 rounded-[2rem] border border-slate-100 dark:border-white/10 flex flex-col items-center justify-center text-slate-400 dark:text-gray-600 text-[10px] font-black uppercase tracking-[0.4em] italic shadow-inner">
                            <div className="w-12 h-1 bg-slate-100 dark:bg-white/5 rounded-full mb-6"></div>
                            [ Simulation: Subjunctive Flux ]
                        </div>
                    </div>

                    {reviewCriteria && (
                        <div className="space-y-6 border-t border-slate-50 dark:border-white/5 pt-10 relative z-10">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-slate-300 dark:text-gray-600" />
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-gray-600 italic">Heuristic Evaluative Metrics (Rubric)</label>
                            </div>
                            <p className="text-sm font-bold text-slate-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{reviewCriteria}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
