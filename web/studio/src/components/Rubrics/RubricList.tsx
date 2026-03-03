"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Rubric, cmsApi } from "@/lib/api";
import {
    Plus,
    Search,
    FileText,
    MoreVertical,
    Edit2,
    Trash2,
    ExternalLink,
    AlertCircle,
    Copy
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface RubricListProps {
    courseId: string;
    onEdit: (rubricId: string) => void;
}

export default function RubricList({ courseId, onEdit }: RubricListProps) {
    const [rubrics, setRubrics] = useState<Rubric[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [creating, setCreating] = useState(false);
    const [newRubricName, setNewRubricName] = useState("");

    const loadRubrics = useCallback(async () => {
        try {
            setLoading(true);
            const data = await cmsApi.listCourseRubrics(courseId);
            setRubrics(data);
        } catch (err) {
            console.error("Failed to load rubrics", err);
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => {
        loadRubrics();
    }, [loadRubrics]);

    const handleCreate = async () => {
        if (!newRubricName) return;
        setCreating(true);
        try {
            const newRubric = await cmsApi.createRubric(courseId, {
                name: newRubricName,
                course_id: courseId
            });
            setRubrics([newRubric, ...rubrics]);
            setNewRubricName("");
            onEdit(newRubric.id);
        } catch (err) {
            console.error("Failed to create rubric", err);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this rubric? This will affect any lessons using it.")) return;
        try {
            await cmsApi.deleteRubric(id);
            setRubrics(rubrics.filter(r => r.id !== id));
        } catch (err) {
            console.error("Failed to delete rubric", err);
        }
    };

    const filteredRubrics = rubrics.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="search"
                        placeholder="Search rubrics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-slate-900 dark:text-gray-100 placeholder:text-slate-300 shadow-inner font-medium"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="New Rubric Name"
                        value={newRubricName}
                        onChange={(e) => setNewRubricName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        className="flex-1 md:w-64 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 shadow-inner font-medium"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={creating || !newRubricName}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-300 text-white font-black text-xs uppercase tracking-[0.2em] px-8 py-3 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Create
                    </button>
                </div>
            </div>

            {/* Rubrics Grid */}
            {filteredRubrics.length === 0 ? (
                <div className="bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-[3rem] p-24 text-center">
                    <div className="w-20 h-20 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                        <FileText className="w-10 h-10 text-slate-300 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">No rubrics created</h3>
                    <p className="text-slate-500 dark:text-gray-500 max-w-sm mx-auto font-medium">
                        Standardize your evaluation process by creating detailed rubrics for your course assignments.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredRubrics.map((rubric) => (
                        <div
                            key={rubric.id}
                            className="group bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 hover:border-blue-500/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between shadow-sm"
                        >
                            <div>
                                <div className="flex items-start justify-between mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm transition-transform group-hover:scale-110">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onEdit(rubric.id)}
                                            className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                            title="Edit Rubric"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rubric.id)}
                                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all shadow-sm active:scale-90"
                                            title="Delete Rubric"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2 uppercase tracking-tight">
                                    {rubric.name}
                                </h3>
                                <p className="text-slate-500 dark:text-gray-500 text-sm line-clamp-2 min-h-[3rem] font-medium leading-relaxed">
                                    {rubric.description || "Establish consistent grading standards with custom criteria."}
                                </p>
                            </div>

                            <div className="mt-12 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] font-black mb-1">Total Points</span>
                                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{rubric.total_points}</span>
                                </div>
                                <button
                                    onClick={() => onEdit(rubric.id)}
                                    className="px-6 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-white hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 shadow-sm"
                                >
                                    EDIT CRITERIA
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
