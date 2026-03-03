"use client";

import { useState } from "react";
import MediaPlayer from "../MediaPlayer";
import FileUpload from "../FileUpload";
import { getImageUrl } from "@/lib/api";

export interface Marker {
    timestamp: number;
    question: string;
    options: string[];
    correctIndex: number;
}

interface MediaBlockProps {
    id: string;
    title?: string;
    url: string;
    type: 'video' | 'audio';
    config: {
        maxPlays?: number;
        currentPlays?: number;
        show_transcript?: boolean;
        markers?: Marker[];
    };
    editMode: boolean;
    onChange: (updates: {
        title?: string;
        url?: string;
        config?: {
            maxPlays?: number;
            currentPlays?: number;
            show_transcript?: boolean;
            markers?: Marker[];
        }
    }) => void;
    transcription?: {
        en?: string;
        es?: string;
        cues?: { start: number; end: number; text: string }[];
    } | null;
    isGraded?: boolean;
}

export default function MediaBlock({ title, url, type, config, editMode, onChange, transcription, isGraded }: MediaBlockProps) {
    const [localPlays, setLocalPlays] = useState(config.currentPlays || 0);
    const [sourceType, setSourceType] = useState<"url" | "upload">(url.startsWith("/assets/") ? "upload" : "url");
    const maxPlays = config.maxPlays || 0;
    const isLocked = maxPlays > 0 && localPlays >= maxPlays;

    const handleEnded = () => {
        if (maxPlays > 0) {
            const nextPlays = localPlays + 1;
            setLocalPlays(nextPlays);
            onChange({ config: { ...config, currentPlays: nextPlays } });
        }
    };

    // Full URL for display (handles relative paths from server)
    const displayUrl = getImageUrl(url);

    return (
        <div className="space-y-6">
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
                            placeholder="e.g. Masterclass Stream, Acoustic Analysis..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    title && <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-blue-600 pl-6 py-1">{title}</h3>
                )}
            </div>

            {editMode && (
                <div className="space-y-8 p-10 bg-white dark:bg-white/5 border border-blue-500/10 dark:border-blue-500/20 mb-10 rounded-[2.5rem] shadow-xl shadow-blue-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <button
                            onClick={() => setSourceType("url")}
                            className={`px-6 py-2 text-[10px] uppercase font-black tracking-[0.2em] rounded-xl transition-all border ${sourceType === "url" ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30" : "bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 border-slate-100 hover:border-slate-200"}`}
                        >
                            External Stream
                        </button>
                        <button
                            onClick={() => setSourceType("upload")}
                            className={`px-6 py-2 text-[10px] uppercase font-black tracking-[0.2em] rounded-xl transition-all border ${sourceType === "upload" ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30" : "bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 border-slate-100 hover:border-slate-200"}`}
                        >
                            Direct Asset
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            {sourceType === "url" ? (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Media Source Locator</label>
                                    <input
                                        type="text"
                                        value={url.startsWith("/") ? "" : url}
                                        onChange={(e) => onChange({ url: e.target.value })}
                                        placeholder="YouTube, Vimeo or static link"
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-inner"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Asset Pipeline</label>
                                    <FileUpload
                                        currentUrl={url.startsWith("/") ? url : undefined}
                                        onUploadComplete={(newUrl) => onChange({ url: newUrl })}
                                    />
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Play Capacity (0 = Inf)</label>
                                <input
                                    type="number"
                                    value={maxPlays}
                                    onChange={(e) => onChange({ config: { ...config, maxPlays: parseInt(e.target.value) || 0 } })}
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-inner h-14"
                                />
                                <p className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-black italic pl-1 leading-relaxed">Throttle cognitive load by limiting session repetition.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Modalities</label>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 h-14 shadow-inner">
                                    <input
                                        type="checkbox"
                                        id={`show-transcript-${title}`} // Unique ID
                                        checked={config.show_transcript !== false} // Default to true
                                        onChange={(e) => onChange({ config: { ...config, show_transcript: e.target.checked } })}
                                        className="w-6 h-6 rounded-lg border-2 border-slate-200 dark:border-white/10 appearance-none checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer shadow-sm"
                                    />
                                    <label htmlFor={`show-transcript-${title}`} className="text-sm text-slate-600 dark:text-gray-300 font-black uppercase tracking-tight select-none cursor-pointer">
                                        Interactive Subtitles
                                    </label>
                                </div>
                                <p className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-black italic pl-1 leading-relaxed">Enable for accessibility; disable for auditory tests.</p>
                            </div>
                        </div>
                    </div>

                    {/* Markers Editor */}
                    <div className="space-y-6 pt-10 border-t border-slate-100 dark:border-white/10 relative z-10">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] block pl-1">Neural Interactivity Markers (Timestamps)</label>

                        <div className="space-y-4">
                            {(config.markers || []).map((marker, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-black/40 p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 space-y-6 shadow-inner group/marker">
                                    <div className="flex items-center gap-6">
                                        <div className="px-5 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black italic shadow-lg shadow-blue-500/30">
                                            {Math.floor(marker.timestamp / 60)}:{String(marker.timestamp % 60).padStart(2, '0')}
                                        </div>
                                        <input
                                            value={marker.question}
                                            onChange={(e) => {
                                                const newMarkers = [...(config.markers || [])];
                                                newMarkers[idx].question = e.target.value;
                                                onChange({ config: { ...config, markers: newMarkers } });
                                            }}
                                            placeholder="Question for this timestamp..."
                                            className="flex-1 bg-transparent border-b border-slate-200 dark:border-white/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-700 dark:text-white py-2"
                                        />
                                        <button
                                            onClick={() => {
                                                const newMarkers = [...(config.markers || [])];
                                                // Change order safely
                                                if (idx > 0) {
                                                    [newMarkers[idx], newMarkers[idx - 1]] = [newMarkers[idx - 1], newMarkers[idx]];
                                                    newMarkers[idx].timestamp = newMarkers[idx - 1].timestamp; // Keep timestamp (?) No, we sort by timestamp usually.
                                                    // Simpler delete logic only for now. Reordering happens automatically by sort on Add.
                                                }
                                            }}
                                            className="text-gray-500 hover:text-white hidden"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newMarkers = [...(config.markers || [])];
                                                newMarkers.splice(idx, 1);
                                                onChange({ config: { ...config, markers: newMarkers } });
                                            }}
                                            className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                        </button>
                                    </div>

                                    {/* Options Management */}
                                    <div className="pl-24 space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Response Vectors</label>
                                        {marker.options.map((opt, optIdx) => (
                                            <div key={optIdx} className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name={`correct-${idx}`}
                                                    checked={marker.correctIndex === optIdx}
                                                    onChange={() => {
                                                        const newMarkers = [...(config.markers || [])];
                                                        newMarkers[idx].correctIndex = optIdx;
                                                        onChange({ config: { ...config, markers: newMarkers } });
                                                    }}
                                                    className="w-5 h-5 accent-green-500 cursor-pointer"
                                                />
                                                <input
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newMarkers = [...(config.markers || [])];
                                                        newMarkers[idx].options[optIdx] = e.target.value;
                                                        onChange({ config: { ...config, markers: newMarkers } });
                                                    }}
                                                    className={`flex-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm ${marker.correctIndex === optIdx ? 'text-green-600 dark:text-green-400 border-green-500/30' : 'text-slate-700 dark:text-gray-300'}`}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newMarkers = [...(config.markers || [])];
                                                        newMarkers[idx].options.splice(optIdx, 1);
                                                        if (newMarkers[idx].correctIndex >= optIdx) {
                                                            newMarkers[idx].correctIndex = Math.max(0, newMarkers[idx].correctIndex - 1);
                                                        }
                                                        onChange({ config: { ...config, markers: newMarkers } });
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newMarkers = [...(config.markers || [])];
                                                newMarkers[idx].options.push(`Option ${newMarkers[idx].options.length + 1}`);
                                                onChange({ config: { ...config, markers: newMarkers } });
                                            }}
                                            className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 uppercase font-black tracking-widest mt-2 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                                        >
                                            + Add Response Vector
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-4 gap-4 p-6 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner">
                            <input
                                type="number"
                                placeholder="Sec"
                                id="new-marker-time"
                                className="col-span-1 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm"
                            />
                            <input
                                type="text"
                                placeholder="Question?"
                                id="new-marker-question"
                                className="col-span-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm"
                            />
                            <button
                                onClick={() => {
                                    const timeInput = document.getElementById('new-marker-time') as HTMLInputElement;
                                    const questionInput = document.getElementById('new-marker-question') as HTMLInputElement;
                                    const time = parseInt(timeInput.value);
                                    const question = questionInput.value;

                                    if (time >= 0 && question) {
                                        const newMarker: Marker = {
                                            timestamp: time,
                                            question,
                                            options: ["Yes", "No"], // Default options
                                            correctIndex: 0
                                        };
                                        const newMarkers = [...(config.markers || []), newMarker].sort((a, b) => a.timestamp - b.timestamp);
                                        onChange({ config: { ...config, markers: newMarkers } });
                                        timeInput.value = "";
                                        questionInput.value = "";
                                    }
                                }}
                                className="col-span-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all"
                            >
                                Add
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black italic leading-relaxed pl-1">
                            Questions will pause the video at the specified second. Only simple Yes/No questions supported currently.
                        </p>
                    </div>
                </div>
            )}

            <div className="relative">
                <MediaPlayer
                    src={displayUrl}
                    type={type}
                    transcription={transcription}
                    locked={isLocked}
                    isGraded={isGraded}
                    showInteractive={config.show_transcript !== false}
                    onEnded={handleEnded}
                />

                {!editMode && maxPlays > 0 && (
                    <div className="mt-6 flex items-center justify-between px-8 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-widest">Cognitive Reserve Remaining</span>
                        </div>
                        <span className={`text-sm font-black italic ${maxPlays - localPlays <= 1 ? 'text-orange-500' : 'text-blue-600 dark:text-blue-400'}`}>
                            {Math.max(0, maxPlays - localPlays)} / {maxPlays} Access Vectors
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
