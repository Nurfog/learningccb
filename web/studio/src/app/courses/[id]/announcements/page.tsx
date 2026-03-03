"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, AnnouncementWithAuthor, Cohort } from "@/lib/api";
import { Megaphone, Plus, Search, Loader2, ArrowLeft, Pin, Trash2, Users } from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function AnnouncementsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showNewModal, setShowNewModal] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [annData, cohortData] = await Promise.all([
                lmsApi.listAnnouncements(id),
                lmsApi.getCohorts()
            ]);
            setAnnouncements(annData);
            setCohorts(cohortData.filter((c: any) => c.course_id === id));
        } catch (error) {
            console.error("Error fetching announcements:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleDelete = async (announcementId: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este anuncio?")) return;
        try {
            await lmsApi.deleteAnnouncement(announcementId);
            fetchData();
        } catch (error) {
            console.error("Error deleting announcement:", error);
            alert("Error al eliminar el anuncio");
        }
    };

    const filteredAnnouncements = announcements.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <CourseEditorLayout
                activeTab="announcements"
                pageTitle="Anuncios"
                pageDescription="Gestiona las comunicaciones del curso y segmentos de cohortes."
                pageActions={
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md shadow-orange-500/20 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Nuevo Anuncio
                    </button>
                }
            >
                <div className="space-y-8">
                    <h2 className="section-title">
                        <Megaphone className="text-orange-500" />
                        Comunicados del Curso
                    </h2>
                    {/* Search Bar */}
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] flex items-center gap-4 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                            <input
                                type="text"
                                placeholder="Find an announcement..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 font-bold shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Announcements List */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                            <p className="text-gray-400">Loading announcements...</p>
                        </div>
                    ) : filteredAnnouncements.length > 0 ? (
                        <div className="grid gap-8">
                            {filteredAnnouncements.map((a) => (
                                <div key={a.id} className={`relative p-8 rounded-[2.5rem] border transition-all duration-300 shadow-sm ${a.is_pinned ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'}`}>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-black overflow-hidden shadow-lg shadow-orange-500/20 border-2 border-white dark:border-white/10">
                                                {a.author_avatar ? (
                                                    <img src={a.author_avatar} alt={a.author_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    a.author_name.charAt(0)
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{a.author_name}</h4>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                    <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es })}</span>
                                                    {a.cohort_ids && a.cohort_ids.length > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <div className="flex items-center gap-1 text-blue-400 font-medium">
                                                                <Users className="w-3 h-3" />
                                                                <span>{a.cohort_ids.length} Cohorts</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {a.is_pinned && <Pin className="w-4 h-4 text-orange-400 fill-current" />}
                                            <button
                                                onClick={() => handleDelete(a.id)}
                                                className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight leading-tight">{a.title}</h3>
                                    <p className="text-slate-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-medium italic">{a.content}</p>

                                    {/* Display Target Cohort Names if segmented */}
                                    {a.cohort_ids && a.cohort_ids.length > 0 && (
                                        <div className="mt-8 flex flex-wrap gap-2 pt-6 border-t border-slate-100 dark:border-white/5">
                                            {a.cohort_ids.map(cid => {
                                                const cohort = cohorts.find(c => c.id === cid);
                                                return (
                                                    <span key={cid} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                                        {cohort?.name || 'Unknown Cohort'}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] p-24 text-center shadow-inner">
                            <div className="w-20 h-20 rounded-3xl bg-white dark:bg-white/5 flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <Megaphone className="w-10 h-10 text-slate-400 dark:text-gray-600 opacity-40" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">No announcements yet</h3>
                            <p className="text-xs text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest italic">Start communicating with your student body today.</p>
                        </div>
                    )}
                </div>
            </CourseEditorLayout>

            {
                showNewModal && (
                    <NewAnnouncementModal
                        courseId={id}
                        cohorts={cohorts}
                        onClose={() => setShowNewModal(false)}
                        onSuccess={() => {
                            setShowNewModal(false);
                            fetchData();
                        }}
                    />
                )}
        </>
    );
}

// Inline NewAnnouncementModal for simplicity, or move to its own file if it grows
function NewAnnouncementModal({ courseId, cohorts, onClose, onSuccess }: { courseId: string, cohorts: Cohort[], onClose: () => void, onSuccess: () => void }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [isPinned, setIsPinned] = useState(false);
    const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await lmsApi.createAnnouncement(courseId, {
                title,
                content,
                is_pinned: isPinned,
                cohort_ids: selectedCohorts.length > 0 ? selectedCohorts : undefined
            });
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("Failed to create announcement");
        } finally {
            setLoading(false);
        }
    };

    const toggleCohort = (id: string) => {
        setSelectedCohorts(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1a1c1e] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-10 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white uppercase tracking-tight">
                            <Megaphone className="w-6 h-6 text-orange-500" />
                            New Announcement
                        </h2>
                        <p className="text-xs text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Share news and updates with your course</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all group active:scale-95">
                        <Plus size={20} className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors rotate-45" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-1">Topic Title</label>
                        <input
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 font-bold shadow-inner"
                            placeholder="What's this announcement about?"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-1">Message Body</label>
                        <textarea
                            required
                            rows={5}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 font-medium italic shadow-inner"
                            placeholder="Type your detailed message here..."
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 flex items-center gap-2 ml-1">
                            <Users className="w-4 h-4 text-blue-500" />
                            Target Segments (Optional)
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 custom-scrollbar">
                            {cohorts.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleCohort(c.id)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 ${selectedCohorts.includes(c.id) ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-gray-500 hover:border-blue-500/30'}`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 p-5 bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-[2rem] shadow-sm">
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="pin"
                                checked={isPinned}
                                onChange={(e) => setIsPinned(e.target.checked)}
                                className="w-6 h-6 rounded-lg border-slate-300 dark:border-white/10 bg-white dark:bg-black/40 text-orange-600 focus:ring-orange-500/50 shadow-inner"
                            />
                        </div>
                        <label htmlFor="pin" className="text-xs font-black uppercase tracking-widest text-orange-800/80 dark:text-orange-400/80 cursor-pointer">
                            Pin this announcement to the top of the course feed
                        </label>
                    </div>
                    <div className="flex justify-end gap-4 pt-6">
                        <button type="button" onClick={onClose} className="px-8 py-3 font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-gray-500 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95">
                            Discard
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !title || !content}
                            className="px-10 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-200 dark:disabled:bg-white/5 text-white disabled:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20 transition-all active:scale-95 disabled:shadow-none group flex items-center gap-3"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                            Publish Announcement
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
