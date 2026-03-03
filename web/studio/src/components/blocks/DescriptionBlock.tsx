"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Bold, Italic, Link as LinkIcon, Image as ImageIcon, FileText, Eye, PenLine, Sparkles, Wand2, Check, X as CloseIcon } from "lucide-react";
import AssetPickerModal from "../AssetPickerModal";
import { Asset, getImageUrl, cmsApi } from "@/lib/api";

interface DescriptionBlockProps {
    id: string;
    title?: string;
    content: string;
    editMode: boolean;
    courseId: string;
    onChange: (updates: { title?: string; content?: string }) => void;
}

export default function DescriptionBlock({ id, title, content, editMode, courseId, onChange }: DescriptionBlockProps) {
    const [showPreview, setShowPreview] = useState(false);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const [pickerType, setPickerType] = useState<"image" | "file">("image");
    const [isReviewing, setIsReviewing] = useState(false);
    const [suggestion, setSuggestion] = useState<{ suggestion: string, comments: string } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleReviewText = async () => {
        if (!content.trim() || isReviewing) return;
        setIsReviewing(true);
        try {
            const data = await cmsApi.reviewText(content);
            setSuggestion(data);
        } catch (err) {
            console.error("Content review failed", err);
            alert("Failed to review content");
        } finally {
            setIsReviewing(false);
        }
    };

    const applySuggestion = () => {
        if (!suggestion) return;
        onChange({ content: suggestion.suggestion });
        setSuggestion(null);
    };

    const insertMarkdown = (prefix: string, suffix: string = "") => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        const before = text.substring(0, start);
        const after = text.substring(end);

        const newContent = before + prefix + selectedText + suffix + after;
        onChange({ content: newContent });

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleAssetSelect = (asset: Asset) => {
        const url = asset.storage_path.replace('uploads/', '/assets/');
        if (asset.mimetype.startsWith('image/')) {
            insertMarkdown(`![${asset.filename}](${url})`);
        } else {
            insertMarkdown(`[${asset.filename}](${url})`);
        }
    };

    return (
        <div className="space-y-6" id={id}>
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Fundamental Concepts, Learning Objectives..."
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                ) : (
                    title && <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase border-l-4 border-blue-600 pl-6 py-1">{title}</h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Instructional Canvas</label>
                                <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-2" />
                                {/* Toolbar */}
                                {!showPreview && (
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => insertMarkdown("**", "**")} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white shadow-sm border border-transparent hover:border-slate-200" title="Bold"><Bold size={16} /></button>
                                        <button onClick={() => insertMarkdown("*", "*")} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white shadow-sm border border-transparent hover:border-slate-200" title="Italic"><Italic size={16} /></button>
                                        <button onClick={() => insertMarkdown("[", "](url)")} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white shadow-sm border border-transparent hover:border-slate-200" title="Link"><LinkIcon size={16} /></button>
                                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-2" />
                                        <button
                                            onClick={() => { setPickerType("image"); setIsAssetPickerOpen(true); }}
                                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all text-blue-600 dark:text-blue-400 hover:text-blue-700 shadow-sm border border-transparent hover:border-blue-200"
                                            title="Insert Image"
                                        >
                                            <ImageIcon size={16} />
                                        </button>
                                        <button
                                            onClick={() => { setPickerType("file"); setIsAssetPickerOpen(true); }}
                                            className="p-2 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-all text-purple-600 dark:text-purple-400 hover:text-purple-700 shadow-sm border border-transparent hover:border-purple-200"
                                            title="Insert File Link"
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-2" />
                                        <button
                                            onClick={handleReviewText}
                                            disabled={isReviewing}
                                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border ${isReviewing ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-400 border-indigo-200 animate-pulse shadow-inner' : 'bg-indigo-50 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95'}`}
                                            title="AI Suggest Improvements"
                                        >
                                            <Sparkles size={14} className={isReviewing ? 'animate-spin' : ''} />
                                            {isReviewing ? 'Synthesizing...' : 'AI Refine'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex bg-slate-100 dark:bg-white/5 rounded-2xl p-1.5 border border-slate-200 dark:border-white/5 shadow-inner">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className={`px-5 py-2 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all ${!showPreview ? "bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    <PenLine size={12} /> Composition
                                </button>
                                <button
                                    onClick={() => setShowPreview(true)}
                                    className={`px-5 py-2 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all ${showPreview ? "bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    <Eye size={12} /> Rendering
                                </button>
                            </div>
                        </div>
                    </div>

                    {showPreview ? (
                        <div className="min-h-[250px] p-10 rounded-[2.5rem] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="prose dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-lg prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-3xl prose-img:shadow-2xl relative z-10">
                                <ReactMarkdown urlTransform={getImageUrl}>{content || "Draft empty. Initiate composition above..."}</ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="relative group/canvas">
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => onChange({ content: e.target.value })}
                                placeholder="Unfold your vision. Markdown architectural syntax supported..."
                                className="w-full h-[400px] bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-[2rem] p-10 text-lg tracking-tight focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500/50 focus:outline-none transition-all resize-none shadow-inner custom-scrollbar relative z-10 font-medium leading-relaxed"
                            />
                            <div className="absolute bottom-6 right-8 text-[10px] text-slate-300 dark:text-gray-600 font-black uppercase tracking-[0.3em] pointer-events-none z-20 group-hover/canvas:text-blue-400/50 transition-colors">
                                Structural Markdown Mode
                            </div>
                        </div>
                    )}
                    {suggestion && (
                        <div className="bg-white dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-[2.5rem] p-10 space-y-8 animate-in fade-in slide-in-from-top-6 duration-700 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                        <Wand2 size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase">Neural Refinement Suggestions</h4>
                                        <p className="text-[10px] text-slate-400 dark:text-gray-400 mt-1 uppercase tracking-[0.2em] font-black">AI-optimized pedagogical structure</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSuggestion(null)}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-400 transition-colors"
                                >
                                    <CloseIcon size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                                <div className="space-y-4">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Proposed Architecture</span>
                                    <div className="p-8 bg-slate-50 dark:bg-black/40 rounded-[2rem] border border-slate-200 dark:border-white/5 text-sm text-slate-600 dark:text-gray-300 leading-relaxed italic shadow-inner">
                                        &quot;{suggestion.suggestion}&quot;
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Pedagogical Insights</span>
                                    <div className="text-sm text-slate-500 dark:text-gray-400 font-medium leading-relaxed pl-1 whitespace-pre-line border-l-2 border-indigo-100 pl-6 py-2">
                                        {suggestion.comments}
                                    </div>
                                    <div className="pt-6 flex gap-4">
                                        <button
                                            onClick={applySuggestion}
                                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-500/30 flex items-center gap-3 active:scale-95"
                                        >
                                            <Check size={16} />
                                            Update Syllabus
                                        </button>
                                        <button
                                            onClick={() => setSuggestion(null)}
                                            className="px-8 py-4 bg-white dark:bg-white/5 hover:bg-slate-50 text-slate-400 dark:text-gray-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-slate-200 dark:border-white/10 transition-all active:scale-95 shadow-sm"
                                        >
                                            Discard
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="prose dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-lg prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-3xl prose-img:shadow-xl">
                    <ReactMarkdown urlTransform={getImageUrl}>{content || "Conceptual flow not established yet."}</ReactMarkdown>
                </div>
            )}

            <AssetPickerModal
                isOpen={isAssetPickerOpen}
                onClose={() => setIsAssetPickerOpen(false)}
                courseId={courseId}
                filterType={pickerType}
                onSelect={handleAssetSelect}
            />
        </div>
    );
}
