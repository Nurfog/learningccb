"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { lmsApi, cmsApi, Course, Meeting } from "@/lib/api";
import {
    Video,
    Plus,
    Calendar as CalendarIcon,
    Clock,
    Trash2,
    Loader2,
    Globe,
    Link as LinkIcon,
    X
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function LiveSessionsPage() {
    const { id } = useParams() as { id: string };
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newMeeting, setNewMeeting] = useState({
        title: "",
        description: "",
        start_at: new Date().toISOString().slice(0, 16),
        duration_minutes: 60,
        provider: "jitsi"
    });

    const loadMeetings = async () => {
        try {
            setLoading(true);
            const data = await lmsApi.getMeetings(id);
            setMeetings(data);
        } catch (error) {
            console.error("Error loading meetings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMeetings();
    }, [id]);

    const handleCreateMeeting = async () => {
        try {
            await lmsApi.createMeeting(id, {
                ...newMeeting,
                start_at: new Date(newMeeting.start_at).toISOString()
            });
            setIsCreateModalOpen(false);
            loadMeetings();
        } catch (error) {
            console.error("Error creating meeting:", error);
            alert("Failed to create meeting.");
        }
    };

    const handleDeleteMeeting = async (meetingId: string) => {
        if (!confirm("Are you sure you want to delete this meeting?")) return;
        try {
            await lmsApi.deleteMeeting(id, meetingId);
            loadMeetings();
        } catch (error) {
            console.error("Error deleting meeting:", error);
            alert("Failed to delete meeting.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-transparent flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <CourseEditorLayout
                activeTab="sessions"
                pageTitle="Sesiones en Vivo"
                pageDescription="Programa y gestiona reuniones virtuales y sesiones en vivo."
                pageActions={
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        PROGRAM SESSION
                    </button>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {meetings.length === 0 ? (
                        <div className="col-span-full py-32 bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 rounded-[3rem] text-center">
                            <div className="w-24 h-24 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <Video className="w-12 h-12 text-slate-300 dark:text-gray-700" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">No active sessions</h3>
                            <p className="text-slate-500 dark:text-gray-500 max-w-sm mx-auto font-medium">Start by scheduling your first virtual meeting for this course.</p>
                        </div>
                    ) : (
                        meetings.map(meeting => (
                            <div key={meeting.id} className="bg-white dark:bg-black/20 rounded-[2rem] p-8 border border-slate-200 dark:border-white/10 hover:border-blue-500/30 transition-all group relative overflow-hidden shadow-sm hover:shadow-md">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDeleteMeeting(meeting.id)}
                                        className="p-3 bg-red-50 dark:bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all shadow-sm"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                <div className="flex items-start gap-5 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-sm transition-transform group-hover:scale-110">
                                        <Video size={28} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-xl leading-tight mb-2 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight">{meeting.title}</h4>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">
                                            <Globe size={12} className="text-blue-500/50" />
                                            {meeting.provider} Session
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-10">
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-inner">
                                        <CalendarIcon size={18} className="text-blue-500" />
                                        <span className="font-bold tracking-tight uppercase text-[11px]">{new Date(meeting.start_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-inner">
                                        <Clock size={18} className="text-blue-500" />
                                        <span className="font-black text-[11px] uppercase tracking-widest">
                                            {new Date(meeting.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            <span className="mx-3 opacity-30">|</span>
                                            {meeting.duration_minutes} MIN
                                        </span>
                                    </div>
                                    {meeting.description && (
                                        <p className="text-xs text-slate-500 dark:text-gray-500 line-clamp-3 mt-4 leading-relaxed italic px-2">
                                            "{meeting.description}"
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        className="flex-1 py-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-white transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                                        onClick={() => {
                                            const url = meeting.join_url || `https://meet.jit.si/${meeting.meeting_id}`;
                                            window.open(url, '_blank');
                                        }}
                                    >
                                        <LinkIcon size={14} className="text-blue-500" />
                                        PREVIEW LINK
                                    </button>
                                    <div className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border ${meeting.is_active ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-100 dark:border-green-500/20' : 'bg-slate-100 dark:bg-gray-500/20 text-slate-400 dark:text-gray-500 border-slate-200 dark:border-white/5'}`}>
                                        {meeting.is_active ? 'SCHEDULED' : 'PAST'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CourseEditorLayout>

            {/* Create Meeting Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-[#16181b] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                            <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter text-slate-900 dark:text-white">
                                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                                    <Video size={24} />
                                </div>
                                Schedule Session
                            </h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 ml-1">Meeting Title</label>
                                <input
                                    type="text"
                                    value={newMeeting.title}
                                    onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                                    placeholder="e.g., Weekly Office Hours"
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder:text-slate-300 transition-all font-medium shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 ml-1">Description (Optional)</label>
                                <textarea
                                    value={newMeeting.description}
                                    onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                                    placeholder="What will be covered?"
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder:text-slate-300 transition-all font-medium h-24 resize-none shadow-inner"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 ml-1">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={newMeeting.start_at}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, start_at: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white transition-all font-medium shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 ml-1">Duration (Min)</label>
                                    <input
                                        type="number"
                                        value={newMeeting.duration_minutes}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, duration_minutes: parseInt(e.target.value) })}
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white transition-all font-medium shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="pt-8 pb-4">
                                <button
                                    onClick={handleCreateMeeting}
                                    disabled={!newMeeting.title}
                                    className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-white"
                                >
                                    Confirm & Create Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
