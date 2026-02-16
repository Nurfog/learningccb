"use client";

import { useState } from "react";

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
                    <div className="space-y-2 p-6 glass border-white/5 bg-white/5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Final Project Submission..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    <h3 className="text-xl font-bold border-l-4 border-purple-500 pl-4 py-1 tracking-tight text-white flex items-center gap-2">
                        <span>👥</span> {title || "Peer Assessment"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Assignment Instructions</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onChange({ prompt: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-lg font-medium focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="Describe what the student needs to submit (e.g. 'Write a 500-word essay about...')"
                        />
                    </div>

                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Review Criteria (Rubric)</label>
                        <textarea
                            value={reviewCriteria || ""}
                            onChange={(e) => onChange({ reviewCriteria: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-sm font-medium focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="Guide the reviewer on how to evaluate the submission..."
                        />
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Instructions for the student who will review this work.</p>
                    </div>
                </div>
            ) : (
                <div className="p-8 glass border-white/5 rounded-3xl space-y-8">
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Instructions</h4>
                        <p className="text-lg text-gray-200 leading-relaxed whitespace-pre-wrap">{prompt || "Submit your work below."}</p>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                                📤
                            </div>
                            <div>
                                <h5 className="font-bold text-sm">Student Submission Area</h5>
                                <p className="text-xs text-gray-500">Students will see a text area here to submit their work.</p>
                            </div>
                        </div>
                        <div className="h-32 bg-black/20 rounded-xl border border-white/5 flex items-center justify-center text-gray-600 text-sm italic">
                            [Submission Interface Preview]
                        </div>
                    </div>

                    {reviewCriteria && (
                        <div className="space-y-2 border-t border-white/5 pt-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Review Criteria</h4>
                            <p className="text-sm text-gray-400 whitespace-pre-wrap">{reviewCriteria}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
