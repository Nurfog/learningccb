"use client";

import React, { useState, useEffect } from "react";
import {
    cmsApi,
    Course
} from "@/lib/api";
import {
    Save,
    Type,
    Target,
    AlertCircle,
    Clock,
    Award,
    Zap,
    Megaphone
} from "lucide-react";

interface MarketingTabProps {
    courseId: string;
}

export default function MarketingTab({ courseId }: MarketingTabProps) {
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form states
    const [objectives, setObjectives] = useState("");
    const [requirements, setRequirements] = useState("");
    const [duration, setDuration] = useState("");
    const [modulesSummary, setModulesSummary] = useState("");
    const [certificationInfo, setCertificationInfo] = useState("");

    const loadCourse = async () => {
        try {
            setLoading(true);
            const data = await cmsApi.getCourse(courseId);
            setCourse(data);

            // Initialize form from metadata
            const meta = data.marketing_metadata || {};
            setObjectives(meta.objectives || "");
            setRequirements(meta.requirements || "");
            setDuration(meta.duration || "");
            setModulesSummary(meta.modules_summary || "");
            setCertificationInfo(meta.certification_info || "");
        } catch (err) {
            console.error("Failed to load course", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCourse();
    }, [courseId]);

    const handleSaveMetadata = async () => {
        try {
            setSaving(true);
            await cmsApi.updateCourse(courseId, {
                marketing_metadata: {
                    objectives,
                    requirements,
                    duration,
                    modules_summary: modulesSummary,
                    certification_info: certificationInfo
                }
            });
            alert("Marketing metadata saved successfully!");
        } catch (err) {
            console.error("Save failed", err);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── SECTION: CORE MARKETING DATA ── */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[3rem] p-10 lg:p-14 space-y-12 shadow-sm">
                <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div>
                        <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-4">
                            <Megaphone className="text-indigo-500" />
                            Marketing Manifesto
                        </h3>
                        <p className="text-slate-500 dark:text-gray-500 mt-2 font-medium">Define the core value proposition and educational objectives.</p>
                    </div>
                    <button
                        onClick={handleSaveMetadata}
                        disabled={saving}
                        className="flex items-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                        {saving ? 'Saving Manifest...' : 'Update Manifesto'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 ml-2 flex items-center gap-2">
                                <Target size={14} /> Learning Objectives
                            </label>
                            <textarea
                                value={objectives}
                                onChange={(e) => setObjectives(e.target.value)}
                                placeholder="What will the student achieve?"
                                className="w-full h-40 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none font-medium shadow-inner"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 ml-2 flex items-center gap-2">
                                <Zap size={14} /> Requirements & Prerequisites
                            </label>
                            <textarea
                                value={requirements}
                                onChange={(e) => setRequirements(e.target.value)}
                                placeholder="What should they know before starting?"
                                className="w-full h-40 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all resize-none font-medium shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2 flex items-center gap-2">
                                <Clock size={14} /> Estimated Duration
                            </label>
                            <input
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                placeholder="e.g. 10 weeks, 40 hours"
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[1.5rem] px-6 py-4 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-black uppercase tracking-tight shadow-inner"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2 flex items-center gap-2">
                                <Award size={14} /> Certification Info
                            </label>
                            <textarea
                                value={certificationInfo}
                                onChange={(e) => setCertificationInfo(e.target.value)}
                                placeholder="Details about the final certificate or credential."
                                className="w-full h-32 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none font-medium shadow-inner"
                            />
                        </div>

                        <div className="p-8 bg-blue-50 dark:bg-blue-500/5 rounded-[2.5rem] border border-blue-100 dark:border-blue-500/10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <AlertCircle size={20} />
                                </div>
                                <h4 className="font-black uppercase tracking-tight text-blue-900 dark:text-blue-300">Public Preview</h4>
                            </div>
                            <p className="text-sm text-blue-700/70 dark:text-blue-400/70 font-medium leading-relaxed">
                                This information will be displayed on the public landing page. Use compelling language to increase student enrollment.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-6">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2 flex items-center gap-2">
                        <Type size={14} /> Modules Deep-Dive (Sales Summary)
                    </label>
                    <textarea
                        value={modulesSummary}
                        onChange={(e) => setModulesSummary(e.target.value)}
                        placeholder="Highlight the key modules and what's unique about them."
                        className="w-full h-40 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-8 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none font-medium shadow-inner"
                    />
                </div>
            </div>
        </div>
    );
}
