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
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-gray-100"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="New Rubric Name"
                        value={newRubricName}
                        onChange={(e) => setNewRubricName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        className="flex-1 md:w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={creating || !newRubricName}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create
                    </button>
                </div>
            </div>

            {/* Rubrics Grid */}
            {filteredRubrics.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-16 text-center">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-200 mb-2">No rubrics found</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Create a rubric to start using advanced grading criteria in your course lessons.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredRubrics.map((rubric) => (
                        <div
                            key={rubric.id}
                            className="group bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-blue-500/50 hover:bg-white/[0.08] transition-all duration-300 flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <FileText className="w-6 h-6" />
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
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                            title="Delete Rubric"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-gray-100 group-hover:text-blue-400 transition-colors mb-2">
                                    {rubric.name}
                                </h3>
                                <p className="text-gray-500 text-sm line-clamp-2 min-h-[2.5rem]">
                                    {rubric.description || "No description provided."}
                                </p>
                            </div>

                            <div className="mt-8 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Total Points</span>
                                    <span className="text-xl font-black text-white">{rubric.total_points}</span>
                                </div>
                                <button
                                    onClick={() => onEdit(rubric.id)}
                                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95"
                                >
                                    Manage Criteria
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
