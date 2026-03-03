"use client";

import React, { useState, useEffect } from "react";
import {
    RubricWithDetails,
    RubricCriterion,
    RubricLevel,
    cmsApi,
    CreateCriterionPayload,
    CreateLevelPayload
} from "@/lib/api";
import {
    Plus,
    Trash2,
    Save,
    X,
    GripVertical,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Check
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface RubricEditorProps {
    rubricId: string;
    courseId: string;
    onClose: () => void;
    onSaved?: () => void;
}

export default function RubricEditor({ rubricId, courseId, onClose, onSaved }: RubricEditorProps) {
    const [rubric, setRubric] = useState<RubricWithDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadRubric();
    }, [rubricId]);

    const loadRubric = async () => {
        try {
            setLoading(true);
            const data = await cmsApi.getRubricWithDetails(rubricId);
            setRubric(data);
        } catch (err) {
            console.error("Failed to load rubric", err);
            setError("Failed to load rubric details.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRubric = async (name: string, description: string) => {
        if (!rubric) return;
        try {
            const updated = await cmsApi.updateRubric(rubricId, { name, description: description || undefined });
            setRubric({ ...rubric, ...updated });
        } catch (err) {
            console.error("Failed to update rubric", err);
        }
    };

    const handleAddCriterion = async () => {
        if (!rubric) return;
        const payload: CreateCriterionPayload = {
            name: "New Criterion",
            max_points: 10,
            position: rubric.criteria.length
        };
        try {
            const newCriterion = await cmsApi.createCriterion(rubricId, payload);
            setRubric({
                ...rubric,
                criteria: [...rubric.criteria, { ...newCriterion, levels: [] }]
            });
        } catch (err) {
            console.error("Failed to add criterion", err);
        }
    };

    const handleUpdateCriterion = async (criterionId: string, updates: Partial<RubricCriterion>) => {
        if (!rubric) return;
        try {
            const payload = {
                ...updates,
                description: updates.description === null ? undefined : updates.description
            };
            const updated = await cmsApi.updateCriterion(criterionId, payload);
            setRubric({
                ...rubric,
                criteria: rubric.criteria.map(c =>
                    c.id === criterionId
                        ? { ...c, ...updated }
                        : c
                )
            });
            // Total points might have changed
            if (updates.max_points !== undefined) {
                const updatedRubric = await cmsApi.getRubricWithDetails(rubricId);
                setRubric(updatedRubric);
            }
        } catch (err) {
            console.error("Failed to update criterion", err);
        }
    };

    const handleDeleteCriterion = async (criterionId: string) => {
        if (!confirm("Are you sure you want to delete this criterion?")) return;
        try {
            await cmsApi.deleteCriterion(criterionId);
            const updatedRubric = await cmsApi.getRubricWithDetails(rubricId);
            setRubric(updatedRubric);
        } catch (err) {
            console.error("Failed to delete criterion", err);
        }
    };

    const handleAddLevel = async (criterionId: string) => {
        if (!rubric) return;
        const criterion = rubric.criteria.find(c => c.id === criterionId);
        if (!criterion) return;

        const payload: CreateLevelPayload = {
            name: "New Level",
            points: 0,
            position: criterion.levels.length
        };
        try {
            const newLevel = await cmsApi.createLevel(criterionId, payload);
            setRubric({
                ...rubric,
                criteria: rubric.criteria.map(c =>
                    c.id === criterionId
                        ? { ...c, levels: [...c.levels, newLevel] }
                        : c
                )
            });
        } catch (err) {
            console.error("Failed to add level", err);
        }
    };

    const handleUpdateLevel = async (levelId: string, criterionId: string, updates: Partial<RubricLevel>) => {
        if (!rubric) return;
        try {
            const payload = {
                ...updates,
                description: updates.description === null ? undefined : updates.description
            };
            const updated = await cmsApi.updateLevel(levelId, payload);
            setRubric({
                ...rubric,
                criteria: rubric.criteria.map(c =>
                    c.id === criterionId
                        ? { ...c, levels: c.levels.map(l => l.id === levelId ? updated : l) }
                        : c
                )
            });
        } catch (err) {
            console.error("Failed to update level", err);
        }
    };

    const handleDeleteLevel = async (levelId: string, criterionId: string) => {
        try {
            await cmsApi.deleteLevel(levelId);
            setRubric({
                ...rubric!,
                criteria: rubric!.criteria.map(c =>
                    c.id === criterionId
                        ? { ...c, levels: c.levels.filter(l => l.id !== levelId) }
                        : c
                )
            });
        } catch (err) {
            console.error("Failed to delete level", err);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    if (error || !rubric) return (
        <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-400 font-medium">{error || "Rubric not found"}</p>
            <button onClick={onClose} className="mt-4 text-blue-400 hover:underline">Go Back</button>
        </div>
    );

    return (
        <div className="bg-white dark:bg-[#1a1d23] rounded-[2.5rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex-1">
                    <input
                        type="text"
                        value={rubric.name}
                        onChange={(e) => handleUpdateRubric(e.target.value, rubric.description || "")}
                        placeholder="Rubric Name"
                        className="bg-transparent text-3xl font-black text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 rounded px-2 w-full uppercase tracking-tighter"
                    />
                    <input
                        type="text"
                        value={rubric.description || ""}
                        onChange={(e) => handleUpdateRubric(rubric.name, e.target.value)}
                        placeholder="Add a description..."
                        className="bg-transparent text-sm font-bold text-slate-400 dark:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 rounded px-2 mt-2 w-full italic"
                    />
                </div>
                <div className="flex items-center gap-6 ml-4">
                    <div className="text-right">
                        <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] block font-black mb-1">Total Points</span>
                        <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{rubric.total_points}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 flex items-center justify-center hover:bg-red-50 dark:hover:bg-white/10 rounded-full text-slate-400 hover:text-red-500 transition-all active:scale-95 border border-transparent hover:border-red-100"
                    >
                        <X className="w-8 h-8" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black flex items-center gap-3 text-slate-900 dark:text-gray-200 uppercase tracking-tight">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                            <Plus size={20} />
                        </div>
                        Evaluation Criteria
                        <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 rounded-full uppercase tracking-widest ml-2">
                            {rubric.criteria.length} items
                        </span>
                    </h3>
                    <button
                        onClick={handleAddCriterion}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        ADD NEW CRITERION
                    </button>
                </div>

                <div className="space-y-8 pb-10">
                    {rubric.criteria.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] bg-slate-50/50 dark:bg-white/[0.01]">
                            <p className="text-slate-400 dark:text-gray-500 italic font-medium">Define your first grading criterion to start building the rubric.</p>
                        </div>
                    ) : (
                        rubric.criteria.map((item, idx) => (
                            <div key={item.id} className="group bg-slate-50/30 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 hover:border-blue-500/30 transition-all shadow-sm hover:shadow-md">
                                <div className="flex items-start gap-6">
                                    <div className="mt-2 text-slate-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors">
                                        <GripVertical className="w-6 h-6 cursor-grab active:cursor-grabbing" />
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleUpdateCriterion(item.id, { name: e.target.value })}
                                                    className="bg-transparent text-xl font-black text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2 w-full uppercase tracking-tight"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.description || ""}
                                                    onChange={(e) => handleUpdateCriterion(item.id, { description: e.target.value })}
                                                    placeholder="Focus area (e.g. Critical Thinking, Technical Accuracy...)"
                                                    className="bg-transparent text-sm font-medium text-slate-500 dark:text-gray-500 focus:outline-none w-full mt-2 italic px-2"
                                                />
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="flex flex-col items-end">
                                                    <label className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-black mb-1 mr-1">Points</label>
                                                    <input
                                                        type="number"
                                                        value={item.max_points}
                                                        onChange={(e) => handleUpdateCriterion(item.id, { max_points: parseInt(e.target.value) || 0 })}
                                                        className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 w-20 text-center text-blue-600 dark:text-blue-400 font-black text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-sm"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteCriterion(item.id)}
                                                    className="p-3 bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-95"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Levels */}
                                        <div className="pl-8 border-l-4 border-slate-100 dark:border-white/5 space-y-6 pt-4 mt-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Achievement Levels</h4>
                                                <button
                                                    onClick={() => handleAddLevel(item.id)}
                                                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20 transition-all"
                                                >
                                                    <Plus size={12} /> ADD LEVEL
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                                                {item.levels.map(level => (
                                                    <div key={level.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] p-6 flex flex-col gap-4 relative group/level hover:border-blue-500/30 transition-all shadow-sm">
                                                        <button
                                                            onClick={() => handleDeleteLevel(level.id, item.id)}
                                                            className="absolute top-4 right-4 p-2 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover/level:opacity-100 transition-all active:scale-90"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={level.name}
                                                            onChange={(e) => handleUpdateLevel(level.id, item.id, { name: e.target.value })}
                                                            placeholder="Level (e.g. Master)"
                                                            className="bg-transparent text-sm font-black text-slate-900 dark:text-gray-200 focus:outline-none uppercase tracking-tight"
                                                        />
                                                        <textarea
                                                            value={level.description || ""}
                                                            onChange={(e) => handleUpdateLevel(level.id, item.id, { description: e.target.value })}
                                                            placeholder="Grade description..."
                                                            className="bg-transparent text-xs font-medium text-slate-500 dark:text-gray-500 focus:outline-none resize-none h-20 leading-relaxed italic"
                                                        />
                                                        <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-50 dark:border-white/5">
                                                            <span className="text-[9px] text-slate-400 dark:text-gray-600 uppercase font-black tracking-widest">Points Value</span>
                                                            <input
                                                                type="number"
                                                                value={level.points}
                                                                onChange={(e) => handleUpdateLevel(level.id, item.id, { points: parseInt(e.target.value) || 0 })}
                                                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 w-14 text-xs font-black text-center text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-inner"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex justify-end gap-5">
                <button
                    onClick={onClose}
                    className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={() => {
                        if (onSaved) onSaved();
                        onClose();
                    }}
                    className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-500 shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-3"
                >
                    <Check className="w-5 h-5" />
                    Save & Finish
                </button>
            </div>
        </div>
    );
}
