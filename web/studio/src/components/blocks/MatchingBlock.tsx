"use client";

import { useState, useMemo } from "react";

interface MatchingPair {
    left: string;
    right: string;
}

interface MatchingBlockProps {
    id: string;
    title?: string;
    pairs: MatchingPair[];
    editMode: boolean;
    onChange: (updates: { title?: string; pairs?: MatchingPair[] }) => void;
}

export default function MatchingBlock({ id, title, pairs, editMode, onChange }: MatchingBlockProps) {
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    const [matches, setMatches] = useState<Record<number, number>>({}); // leftIdx -> rightIdx
    const [submitted, setSubmitted] = useState(false);

    // Shuffled right items for the game
    const shuffledRight = useMemo(() => {
        return pairs
            .map((p, i) => ({ value: p.right, originalIdx: i }))
            .sort(() => Math.random() - 0.5);
    }, [pairs]);

    const handleMatch = (leftIdx: number, rightIdx: number) => {
        if (submitted) return;
        setMatches(prev => ({ ...prev, [leftIdx]: rightIdx }));
        setSelectedLeft(null);
    };

    const handleReset = () => {
        setSubmitted(false);
        setMatches({});
        setSelectedLeft(null);
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
                            placeholder="e.g. Match the concepts..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-blue-600 pl-6 py-1">
                        {title || "Concept Matching"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    {pairs.map((pair, idx) => (
                        <div key={idx} className="flex gap-4 items-center bg-white dark:bg-white/5 p-4 rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm animate-in slide-in-from-left-4 duration-300 group/pair">
                            <input
                                value={pair.left}
                                onChange={(e) => {
                                    const newPairs = [...pairs];
                                    newPairs[idx].left = e.target.value;
                                    onChange({ pairs: newPairs });
                                }}
                                className="flex-1 bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-xl px-5 py-3 text-sm font-bold text-slate-700 dark:text-gray-200 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-inner"
                                placeholder="Synaptic Origin"
                            />
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 font-black shadow-inner">↔</div>
                            <input
                                value={pair.right}
                                onChange={(e) => {
                                    const newPairs = [...pairs];
                                    newPairs[idx].right = e.target.value;
                                    onChange({ pairs: newPairs });
                                }}
                                className="flex-1 bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-xl px-5 py-3 text-sm font-bold text-slate-700 dark:text-gray-200 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-inner"
                                placeholder="Semantic Destination"
                            />
                            <button
                                onClick={() => {
                                    const newPairs = pairs.filter((_, i) => i !== idx);
                                    onChange({ pairs: newPairs });
                                }}
                                className="p-3 bg-red-50 dark:bg-red-500/5 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all active:scale-90 opacity-0 group-hover/pair:opacity-100"
                            >
                                <span className="text-xl">×</span>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => onChange({ pairs: [...pairs, { left: "", right: "" }] })}
                        className="w-full py-6 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 hover:bg-white dark:hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-[0.3em] rounded-[2rem] shadow-inner"
                    >
                        + Integrate New Synaptic Pair
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[3rem] shadow-sm relative overflow-hidden group/match">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/match:bg-blue-500/10 transition-colors"></div>

                    <div className="space-y-6 relative z-10">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-6 block pl-1 italic">Synaptic Origin (Term)</label>
                        {pairs.map((pair, i) => (
                            <button
                                key={i}
                                onClick={() => !submitted && setSelectedLeft(i)}
                                className={`w-full p-6 h-20 rounded-[1.5rem] border-2 text-left text-sm font-black uppercase tracking-tight transition-all duration-500 flex items-center shadow-sm ${selectedLeft === i ? "border-blue-600 bg-blue-600 text-white shadow-2xl shadow-blue-500/40 -translate-y-1 scale-[1.02]" :
                                    matches[i] !== undefined ? "border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-4 ring-blue-500/5 scale-[0.98] opacity-60" :
                                        "border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-gray-300 hover:border-blue-400 hover:bg-white dark:hover:bg-white/5"
                                    }`}
                            >
                                <span className="truncate">{pair.left}</span>
                                {matches[i] !== undefined && <span className="ml-auto text-xs opacity-40">✓</span>}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-6 relative z-10">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-6 block pl-1 italic">Semantic Target (Definition)</label>
                        {shuffledRight.map((item, i) => {
                            const matchedLeftIdx = Object.keys(matches).find(k => matches[parseInt(k)] === item.originalIdx);
                            const isCorrect = submitted && matchedLeftIdx !== undefined && parseInt(matchedLeftIdx) === item.originalIdx;
                            const isWrong = submitted && matchedLeftIdx !== undefined && parseInt(matchedLeftIdx) !== item.originalIdx;

                            return (
                                <button
                                    key={i}
                                    disabled={selectedLeft === null || submitted}
                                    onClick={() => handleMatch(selectedLeft!, item.originalIdx)}
                                    className={`w-full p-6 min-h-20 rounded-[1.5rem] border-2 text-left text-[11px] font-bold uppercase tracking-wider leading-relaxed transition-all duration-500 shadow-sm ${selectedLeft !== null && matchedLeftIdx === undefined ? "hover:border-blue-500/50 hover:bg-white dark:hover:bg-white/5 hover:-translate-y-0.5" : ""
                                        } ${isCorrect ? "border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 shadow-xl shadow-green-500/20" :
                                            isWrong ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-100 shadow-xl shadow-red-500/20" :
                                                matchedLeftIdx !== undefined ? "border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-4 ring-blue-500/5 scale-[0.98] opacity-60" :
                                                    "border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-gray-300"
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="flex-1">{item.value}</span>
                                        {isCorrect && <span className="text-xl rotate-12 transition-transform duration-700 group-hover/match:rotate-0">✅</span>}
                                        {isWrong && <span className="text-xl animate-pulse">❌</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="md:col-span-2 pt-10 border-t border-slate-50 dark:border-white/5 relative z-10">
                        {!submitted && Object.keys(matches).length === pairs.length && (
                            <button
                                onClick={() => setSubmitted(true)}
                                className="w-full py-6 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-[2rem] flex items-center justify-center gap-4 animate-in fade-in zoom-in duration-500"
                            >
                                Reconcile Semantic Network
                            </button>
                        )}
                        {submitted && (
                            <button
                                onClick={handleReset}
                                className="w-full py-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 transition-all rounded-[2rem] active:scale-[0.98] shadow-sm"
                            >
                                Reset Synaptic Grid
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
