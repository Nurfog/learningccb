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
        <div className="bg-[#1a1d23] rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex-1">
                    <input
                        type="text"
                        value={rubric.name}
                        onChange={(e) => handleUpdateRubric(e.target.value, rubric.description || "")}
                        placeholder="Rubric Name"
                        className="bg-transparent text-2xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-2 w-full"
                    />
                    <input
                        type="text"
                        value={rubric.description || ""}
                        onChange={(e) => handleUpdateRubric(rubric.name, e.target.value)}
                        placeholder="Add a description..."
                        className="bg-transparent text-sm text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-2 mt-1 w-full"
                    />
                </div>
                <div className="flex items-center gap-4 ml-4">
                    <div className="text-right mr-4">
                        <span className="text-xs text-gray-500 uppercase tracking-widest block font-semibold">Total Points</span>
                        <span className="text-2xl font-bold text-blue-400">{rubric.total_points}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-200">
                        Criteria
                        <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                            {rubric.criteria.length} items
                        </span>
                    </h3>
                    <button
                        onClick={handleAddCriterion}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-600 hover:text-white transition-all transform active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Add Criterion
                    </button>
                </div>

                <div className="space-y-6">
                    {rubric.criteria.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                            <p className="text-gray-500 italic">No criteria added yet. Add your first evaluation criterion.</p>
                        </div>
                    ) : (
                        rubric.criteria.map((item, idx) => (
                            <div key={item.id} className="group bg-white/[0.03] border border-white/10 rounded-3xl p-6 hover:border-blue-500/30 transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="mt-2 text-gray-600 group-hover:text-blue-500/50 transition-colors">
                                        <GripVertical className="w-5 h-5 cursor-grab active:cursor-grabbing" />
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleUpdateCriterion(item.id, { name: e.target.value })}
                                                    className="bg-transparent text-lg font-bold text-gray-100 focus:outline-none focus:border-b border-blue-500/50 w-full"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.description || ""}
                                                    onChange={(e) => handleUpdateCriterion(item.id, { description: e.target.value })}
                                                    placeholder="Description of what to evaluate..."
                                                    className="bg-transparent text-sm text-gray-500 focus:outline-none w-full mt-1"
                                                />
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-end">
                                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Max Points</label>
                                                    <input
                                                        type="number"
                                                        value={item.max_points}
                                                        onChange={(e) => handleUpdateCriterion(item.id, { max_points: parseInt(e.target.value) || 0 })}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 w-16 text-center text-blue-400 font-bold focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteCriterion(item.id)}
                                                    className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Levels */}
                                        <div className="pl-4 border-l-2 border-white/5 space-y-4 pt-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Performance Levels</h4>
                                                <button
                                                    onClick={() => handleAddLevel(item.id)}
                                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Level
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {item.levels.map(level => (
                                                    <div key={level.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2 relative group/level hover:bg-white/[0.08] transition-all">
                                                        <button
                                                            onClick={() => handleDeleteLevel(level.id, item.id)}
                                                            className="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-500 opacity-0 group-level-hover:opacity-100 transition-all"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={level.name}
                                                            onChange={(e) => handleUpdateLevel(level.id, item.id, { name: e.target.value })}
                                                            placeholder="Level Name (e.g. Excellent)"
                                                            className="bg-transparent text-sm font-semibold text-gray-200 focus:outline-none"
                                                        />
                                                        <textarea
                                                            value={level.description || ""}
                                                            onChange={(e) => handleUpdateLevel(level.id, item.id, { description: e.target.value })}
                                                            placeholder="Criteria description..."
                                                            className="bg-transparent text-xs text-gray-500 focus:outline-none resize-none h-12"
                                                        />
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-gray-600 uppercase font-bold">Points:</span>
                                                            <input
                                                                type="number"
                                                                value={level.points}
                                                                onChange={(e) => handleUpdateLevel(level.id, item.id, { points: parseInt(e.target.value) || 0 })}
                                                                className="bg-white/5 border border-white/10 rounded px-1.5 w-12 text-xs text-center text-blue-400 focus:outline-none"
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
            <div className="p-6 border-t border-white/10 bg-white/[0.02] flex justify-end gap-4">
                <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all font-medium"
                >
                    Close
                </button>
                <button
                    onClick={() => {
                        if (onSaved) onSaved();
                        onClose();
                    }}
                    className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Check className="w-5 h-5" />
                    Done
                </button>
            </div>
        </div>
    );
}
