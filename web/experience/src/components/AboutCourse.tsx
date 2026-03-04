"use client";

import React from "react";
import { Course, getImageUrl } from "@/lib/api";
import {
    Target,
    Zap,
    Clock,
    Award,
    CheckCircle2,
    Info,
    Calendar,
    Users
} from "lucide-react";

interface AboutCourseProps {
    course: Course;
    instructors: any[];
}

export default function AboutCourse({ course, instructors }: AboutCourseProps) {
    const meta = course.marketing_metadata || {};

    return (
        <div className="space-y-24 pb-20 animate-in fade-in duration-1000">

            {/* ── HERO GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-12">
                    <div className="relative aspect-[21/9] rounded-[3rem] overflow-hidden border border-slate-200 dark:border-white/5 shadow-2xl group">
                        {course.course_image_url ? (
                            <img
                                src={getImageUrl(course.course_image_url)}
                                alt={course.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[4s]"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center">
                                <h1 className="text-4xl font-black text-white/20 uppercase tracking-[0.5em]">{course.title}</h1>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-12 left-12 right-12">
                            <div className="flex items-center gap-4 mb-4">
                                <span className="px-4 py-1.5 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20">
                                    Official Curriculum
                                </span>
                                {course.pacing_mode && (
                                    <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                                        {course.pacing_mode.replace("_", " ")}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">{course.title}</h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MANIFESTO GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">

                {/* Right: Core Meta */}
                <div className="lg:col-span-1 space-y-12">
                    <div className="glass-premium p-10 rounded-[2.5rem] border-white/5 space-y-8 shadow-xl">
                        <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Key Information</span>
                            <div className="flex flex-col gap-6 pt-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500">Duration</p>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">{meta.duration || "Self-paced immersion"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                        <Award size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500">Certification</p>
                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{meta.certification_info || "Accredited Certificate"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                        <Zap size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500">Passing Grade</p>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">{course.passing_percentage}% Proficiency</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-gray-500 flex items-center gap-3">
                            <Users size={16} /> Course Faculty
                        </h4>
                        <div className="space-y-4">
                            {instructors.map((inst) => (
                                <div key={inst.id} className="flex items-center gap-5 p-5 glass-premium rounded-[1.5rem] border-white/5 hover:bg-white/10 transition-all group">
                                    <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                        {inst.full_name?.charAt(0) || inst.email?.charAt(0)}
                                    </div>
                                    <div>
                                        <h5 className="font-black text-slate-900 dark:text-white tracking-tight">{inst.full_name}</h5>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mt-1">{inst.role || "Instructor"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Left: Objectives & Manifesto */}
                <div className="lg:col-span-2 space-y-16">
                    <section className="space-y-8">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
                                    <Target size={20} />
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Learning Objectives</h3>
                            </div>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-lg leading-relaxed text-slate-600 dark:text-gray-400 font-medium italic">
                                    {meta.objectives || "Comprehensive learning path designed to master core concepts and advanced applications."}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                            <div className="p-8 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-2">
                                    <Zap size={14} /> Prerequisites
                                </h4>
                                <p className="text-sm font-bold text-slate-700 dark:text-gray-300 leading-relaxed">
                                    {meta.requirements || "No specific prerequisites required. An open mind and dedication to learning are the only things needed to succeed."}
                                </p>
                            </div>
                            <div className="p-8 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-[2rem] border border-indigo-100/50 dark:border-indigo-500/10 space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 flex items-center gap-2">
                                    <Info size={14} /> Curriculum Insight
                                </h4>
                                <p className="text-sm font-bold text-indigo-900/60 dark:text-indigo-400/60 leading-relaxed">
                                    Each module is structured to provide both theoretical knowledge and practical applications in real-world scenarios.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-8 border-t border-slate-100 dark:border-white/5 pt-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                <CheckCircle2 size={20} />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">The Modules Deep-Dive</h3>
                        </div>
                        <div className="p-10 glass-premium rounded-[2.5rem] border-white/5 bg-gradient-to-br from-white/5 to-transparent">
                            <p className="text-lg leading-relaxed text-slate-600 dark:text-gray-400 font-medium">
                                {meta.modules_summary || "Explore the rich content structured across multiple interactive modules. Each section builds upon the previous one to ensure a cohesive learning experience."}
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
