"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, X, CheckCircle2, XCircle, Clock } from "lucide-react";

interface OrderingBlockProps {
    id: string;
    title?: string;
    items: string[];
    editMode: boolean;
    onChange: (updates: { title?: string; items?: string[] }) => void;
}

export default function OrderingBlock({ id, title, items, editMode, onChange }: OrderingBlockProps) {
    const [userOrder, setUserOrder] = useState<number[]>([]); // Array of original indices in user-selected order
    const [submitted, setSubmitted] = useState(false);

    // Shuffled items for the start
    const shuffledItems = useMemo(() => {
        return items
            .map((item, i) => ({ value: item, originalIdx: i }))
            .sort(() => Math.random() - 0.5);
    }, [items]);

    const handlePick = (originalIdx: number) => {
        if (submitted) return;
        if (userOrder.includes(originalIdx)) {
            setUserOrder(userOrder.filter(i => i !== originalIdx));
        } else {
            setUserOrder([...userOrder, originalIdx]);
        }
    };

    const handleReset = () => {
        setSubmitted(false);
        setUserOrder([]);
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
                            placeholder="e.g. Sequence of Events..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-blue-600 pl-6 py-1 flex items-center gap-3">
                        <Clock className="w-6 h-6 text-blue-600" /> {title || "Sequence Ordering"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-[0.2em] pl-1">Target Chronology (Define items in CORRECT order):</p>
                    {items.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-center bg-white dark:bg-white/5 p-4 rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm animate-in slide-in-from-left-4 duration-300 group/ord">
                            <span className="text-blue-600 font-black w-8 text-center italic">{idx + 1}.</span>
                            <input
                                value={item}
                                onChange={(e) => {
                                    const newItems = [...items];
                                    newItems[idx] = e.target.value;
                                    onChange({ items: newItems });
                                }}
                                className="flex-1 bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-bold text-slate-700 dark:text-gray-200 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-inner"
                                placeholder={`Event Marker ${idx + 1}`}
                            />
                            <div className="flex gap-1">
                                <button
                                    disabled={idx === 0}
                                    onClick={() => {
                                        const newItems = [...items];
                                        [newItems[idx], newItems[idx - 1]] = [newItems[idx - 1], newItems[idx]];
                                        onChange({ items: newItems });
                                    }}
                                    className="p-3 bg-slate-50 dark:bg-white/5 hover:bg-blue-600 hover:text-white rounded-xl text-slate-400 dark:text-gray-500 transition-all disabled:opacity-5 disabled:hover:bg-transparent"
                                >
                                    <ChevronUp size={16} strokeWidth={3} />
                                </button>
                                <button
                                    disabled={idx === items.length - 1}
                                    onClick={() => {
                                        const newItems = [...items];
                                        [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
                                        onChange({ items: newItems });
                                    }}
                                    className="p-3 bg-slate-50 dark:bg-white/5 hover:bg-blue-600 hover:text-white rounded-xl text-slate-400 dark:text-gray-500 transition-all disabled:opacity-5 disabled:hover:bg-transparent"
                                >
                                    <ChevronDown size={16} strokeWidth={3} />
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    const newItems = items.filter((_, i) => i !== idx);
                                    onChange({ items: newItems });
                                }}
                                className="p-3 bg-red-50 dark:bg-red-500/5 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all opacity-0 group-hover/ord:opacity-100"
                            >
                                <X size={18} strokeWidth={3} />
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => onChange({ items: [...items, ""] })}
                        className="w-full py-6 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 hover:bg-white dark:hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-[0.3em] rounded-[2rem] shadow-inner"
                    >
                        + Append Temporal Marker
                    </button>
                </div>
            ) : (
                <div className="space-y-12 p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[3rem] shadow-sm relative overflow-hidden group/ordplay">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/ordplay:bg-indigo-500/10 transition-colors"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
                        <div className="space-y-8">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-8 block pl-1 italic">Synaptic Shards (Available Items)</label>
                            <div className="flex flex-wrap gap-4">
                                {shuffledItems.map((item, i) => {
                                    const isPicked = userOrder.includes(item.originalIdx);
                                    return (
                                        <button
                                            key={i}
                                            disabled={isPicked || submitted}
                                            onClick={() => handlePick(item.originalIdx)}
                                            className={`px-8 py-4 rounded-full border-2 text-[11px] font-black uppercase tracking-widest transition-all duration-500 shadow-sm ${isPicked ? "opacity-10 grayscale border-slate-100 bg-slate-50 -translate-y-1" :
                                                "border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-gray-300 hover:border-blue-600 hover:bg-blue-600 hover:text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1"
                                                }`}
                                        >
                                            {item.value}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-8 block pl-1 italic">Reconstructed Timeline</label>
                            <div className="space-y-4">
                                {userOrder.length === 0 && (
                                    <div className="bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 p-12 rounded-[2.5rem] text-center">
                                        <p className="text-[9px] text-slate-400 dark:text-gray-600 uppercase font-black tracking-widest italic pt-2">Sequencing standby: Capture shards to proceed...</p>
                                    </div>
                                )}
                                {userOrder.map((idx, i) => {
                                    const isItemCorrect = submitted && idx === i;
                                    const isItemWrong = submitted && idx !== i;

                                    return (
                                        <div
                                            key={i}
                                            onClick={() => !submitted && handlePick(idx)}
                                            className={`flex items-center gap-6 p-6 rounded-[1.5rem] border-2 text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-500 cursor-pointer shadow-sm ${isItemCorrect ? "border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 shadow-xl shadow-green-500/20" :
                                                isItemWrong ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-100 shadow-xl shadow-red-500/20 translate-x-1" :
                                                    "border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-2xl hover:shadow-blue-500/30"
                                                }`}
                                        >
                                            <span className="opacity-40 text-xs italic">MARK {i + 1}</span>
                                            <span className="flex-1">{items[idx]}</span>
                                            {!submitted && <span className="text-[10px] opacity-30 hover:opacity-100 transition-opacity">SCRAPE</span>}
                                            {isItemCorrect && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                                            {isItemWrong && <XCircle className="w-6 h-6 text-red-500 animate-pulse" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="pt-10 border-t border-slate-50 dark:border-white/5 relative z-10">
                        {!submitted && userOrder.length === items.length && (
                            <button
                                onClick={() => setSubmitted(true)}
                                className="w-full py-6 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-[2rem] flex items-center justify-center gap-4 animate-in fade-in zoom-in duration-500"
                            >
                                Validate Temporal Cohesion
                            </button>
                        )}
                        {submitted && (
                            <button
                                onClick={handleReset}
                                className="w-full py-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 transition-all rounded-[2rem] active:scale-[0.98] shadow-sm"
                            >
                                Deconstruct Sequence
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
