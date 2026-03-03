"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { cmsApi, GradingCategory } from "@/lib/api";
import {
    Plus,
    Trash2,
    Percent,
    AlertCircle,
    CheckCircle2,
    TrendingUp,
    Settings,
    Loader2
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import CourseEditorLayout from "@/components/CourseEditorLayout";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function GradingPolicyPage() {
    const { id } = useParams() as { id: string };
    const [categories, setCategories] = useState<GradingCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newWeight, setNewWeight] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    const loadCategories = useCallback(async () => {
        try {
            const data = await cmsApi.getGradingCategories(id);
            setCategories(data);
        } catch (err) {
            console.error("Failed to load categories", err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    async function handleAdd() {
        if (!newName || newWeight <= 0) return;
        setSubmitting(true);
        try {
            await cmsApi.createGradingCategory(id, newName, newWeight);
            setNewName("");
            setNewWeight(0);
            await loadCategories();
        } catch (err) {
            console.error("Failed to create category", err);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(catId: string) {
        if (!confirm("Are you sure you want to delete this category?")) return;
        try {
            await cmsApi.deleteGradingCategory(catId);
            await loadCategories();
        } catch (err) {
            console.error("Failed to delete category", err);
        }
    }

    const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
    const isBalanced = totalWeight === 100;

    if (loading) return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    return (
        <CourseEditorLayout
            activeTab="grading"
            pageTitle="Política de Notas"
            pageDescription="Configura los tipos de evaluación y la distribución de pesos del curso."
            pageActions={
                <div className={cn(
                    "flex items-center gap-3 px-6 py-2.5 rounded-2xl border transition-all duration-500 shadow-sm",
                    isBalanced ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400"
                        : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400"
                )}>
                    {isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5 animate-pulse" />}
                    <div className="flex flex-col items-start leading-none">
                        <span className="font-black text-xl tracking-tighter">{totalWeight}%</span>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Total Defined</span>
                    </div>
                </div>
            }
        >
            <div className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Categories List */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-8 flex items-center gap-2.5">
                            <Settings className="w-4 h-4 text-blue-500" /> Course Grading Structure
                        </h2>

                        {categories.length === 0 ? (
                            <div className="bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] p-24 text-center shadow-inner">
                                <TrendingUp className="w-12 h-12 text-slate-400 dark:text-gray-600 mx-auto mb-6 opacity-40 shadow-sm" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 italic">No grading categories defined for this curriculum</p>
                            </div>
                        ) : (
                            categories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="group bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-3xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                                            <span className="text-2xl font-black">{cat.weight}</span>
                                            <span className="text-[10px] font-black uppercase tracking-tighter">Weight</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{cat.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/60 dark:text-gray-500 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md">
                                                    Primary Assessment Category
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="p-4 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add New Category Form */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-white/5 p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/10 sticky top-8 shadow-sm">
                            <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-slate-900 dark:text-white uppercase tracking-tight">
                                <Plus className="w-6 h-6 text-blue-500" /> New Format
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-1">Assessment Type</label>
                                    <select
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-900 dark:text-gray-100 appearance-none font-bold shadow-inner"
                                    >
                                        <option value="">Choose assessment...</option>
                                        <option value="Continuous Assessment">Continuous Assessment (Min 4)</option>
                                        <option value="Midterm">Midterm</option>
                                        <option value="Final Test">Final Test</option>
                                        <option value="Exam">Exam</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-1">Weight Value (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            placeholder="20"
                                            value={newWeight || ""}
                                            onChange={(e) => setNewWeight(parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-900 dark:text-gray-100 pl-11 font-black text-lg shadow-inner"
                                        />
                                        <Percent className="w-4 h-4 text-blue-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>

                                <button
                                    onClick={handleAdd}
                                    disabled={submitting || !newName || newWeight <= 0}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-gray-500 text-white font-black py-4 rounded-[1.5rem] mt-6 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[10px]"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                        <>
                                            <Plus className="w-5 h-5" />
                                            Add Category
                                        </>
                                    )}
                                </button>

                                {!isBalanced && (
                                    <div className="mt-8 p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0 shadow-sm text-amber-500">
                                            <AlertCircle size={20} className="animate-pulse" />
                                        </div>
                                        <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed font-bold uppercase tracking-tight">
                                            The total weight must be exactly 100% for certification eligibility. Current sum: <span className="text-amber-600 font-black">{totalWeight}%</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CourseEditorLayout>
    );
}
