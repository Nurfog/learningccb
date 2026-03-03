"use client";

import FileUpload from "../FileUpload";
import { getImageUrl } from "@/lib/api";
import { FileText, Download, Eye } from "lucide-react";

interface DocumentBlockProps {
    id: string;
    title?: string;
    url: string;
    editMode: boolean;
    onChange: (updates: { title?: string; url?: string }) => void;
}

export default function DocumentBlock({ title, url, editMode, onChange }: DocumentBlockProps) {
    const isPdf = url.toLowerCase().endsWith(".pdf");
    const displayUrl = getImageUrl(url);

    return (
        <div className="space-y-6">
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-4 p-8 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] mb-6 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40"></div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Document Activity Title</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Course Syllabus, Reading Guide..."
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                ) : (
                    title && <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-indigo-600 pl-6 py-1">{title}</h3>
                )}
            </div>

            {editMode && (
                <div className="p-10 bg-white dark:bg-white/5 border border-indigo-500/10 dark:border-indigo-500/20 mb-10 rounded-[2.5rem] shadow-xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-6 block pl-1 relative z-10">Asset Pipeline (PDF, DOCX, PPTX)</label>
                    <FileUpload
                        currentUrl={url}
                        onUploadComplete={(newUrl) => onChange({ url: newUrl })}
                    />
                    <p className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-black italic mt-6 px-2 leading-relaxed relative z-10">
                        Standards: PDF (Native Rendering), DOCX/PPTX (Direct Retrieval).
                    </p>
                </div>
            )}

            {!editMode && (
                <div className="relative">
                    {url ? (
                        <div className="space-y-4">
                            {isPdf ? (
                                <div className="bg-white dark:bg-white/5 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-white/10 shadow-2xl relative">
                                    <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-black/20">
                                        <iframe
                                            src={`${displayUrl}#toolbar=0`}
                                            className="w-full h-full border-none"
                                            title={title || "Document Preview"}
                                        />
                                    </div>
                                    <div className="p-6 border-t border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-black/40">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                            <Eye size={16} className="text-indigo-600 dark:text-indigo-400" /> Neural Vision Enabled
                                        </span>
                                        <a
                                            href={displayUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all shadow-lg shadow-indigo-500/30"
                                        >
                                            <Download size={16} /> Asset Extraction
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-white/5 p-16 rounded-[3rem] border border-slate-100 dark:border-white/10 shadow-sm flex flex-col items-center text-center gap-8 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
                                    <div className="w-24 h-24 rounded-[2rem] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                                        <FileText size={48} />
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Legacy Container</p>
                                        <p className="text-[10px] text-slate-400 dark:text-gray-500 max-w-xs mx-auto uppercase tracking-[0.2em] font-black leading-loose">
                                            Source material requires local decompression for full synaptic ingestion.
                                        </p>
                                    </div>
                                    <a
                                        href={displayUrl}
                                        download
                                        className="flex items-center gap-4 px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-2xl shadow-indigo-500/40 active:scale-95 group"
                                    >
                                        <Download size={20} className="group-hover:translate-y-1 transition-transform" /> Trigger Download
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 p-20 rounded-[3rem] flex flex-col items-center gap-6 text-slate-300 dark:text-gray-700">
                            <FileText size={64} className="opacity-10" />
                            <p className="font-black uppercase tracking-[0.3em] text-[10px]">No Neural Data Linked</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
