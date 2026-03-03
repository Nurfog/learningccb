"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, cmsApi, StudentGradeReport, Cohort, User } from "@/lib/api";
import {
    Users,
    UserPlus,
    Search,
    ArrowLeft,
    Loader2,
    X,
    Filter,
    CheckCircle2,
    Trash2,
    Mail,
    Plus,
    UserCircle,
    MoreHorizontal,
    ChevronRight
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function CourseStudentsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [students, setStudents] = useState<StudentGradeReport[]>([]);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCohortId, setSelectedCohortId] = useState<string>("all");
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
    const [allOrgUsers, setAllOrgUsers] = useState<User[]>([]);
    const [orgUsersLoading, setOrgUsersLoading] = useState(false);
    const [enrollSearch, setEnrollSearch] = useState("");

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [gradesData, cohortsData] = await Promise.all([
                lmsApi.getCourseGrades(id),
                lmsApi.getCohorts()
            ]);
            setStudents(gradesData);
            setCohorts(cohortsData);
        } catch (error) {
            console.error("Error fetching students and cohorts:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const loadOrgUsers = async () => {
        try {
            setOrgUsersLoading(true);
            const users = await cmsApi.getAllUsers();
            // Filter out those already enrolled
            const enrolledIds = new Set(students.map(s => s.user_id));
            setAllOrgUsers(users.filter(u => u.role === 'student' && !enrolledIds.has(u.id)));
        } catch (error) {
            console.error("Error loading org users:", error);
        } finally {
            setOrgUsersLoading(false);
        }
    };

    useEffect(() => {
        if (isEnrollModalOpen) {
            loadOrgUsers();
        }
    }, [isEnrollModalOpen, students]);

    const handleEnroll = async (emails: string[]) => {
        try {
            await lmsApi.bulkEnroll(id, emails);
            fetchData();
            setIsEnrollModalOpen(false);
        } catch (error) {
            console.error("Enrollment failed:", error);
            alert("Failed to enroll students.");
        }
    };

    const handleCohortAssignment = async (userId: string, cohortId: string, remove: boolean = false) => {
        try {
            if (remove) {
                await lmsApi.removeMember(cohortId, userId);
            } else {
                await lmsApi.addMember(cohortId, userId);
            }
            // In a real app we'd need to refresh specifically which cohorts each student is in.
            // Since StudentGradeReport doesn't include cohorts, we might need a better API or just a toast.
            alert(`Student ${remove ? 'removed from' : 'added to'} cohort.`);
        } catch (error) {
            console.error("Cohort assignment failed:", error);
        }
    };

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email.toLowerCase().includes(searchTerm.toLowerCase());
        // Note: Filtering by cohort is tricky because the grades API doesn't return cohorts per student directly.
        // For now we'll just implement search. Real cohort filtering would need backend support in getCourseGrades.
        return matchesSearch;
    });

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
                activeTab="students"
                pageTitle="Estudiantes y Grupos"
                pageDescription="Gestiona las inscripciones y segmenta a tu audiencia por cohortes."
                pageActions={
                    <button
                        onClick={() => setIsEnrollModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95"
                    >
                        <UserPlus size={18} />
                        Inscribir Estudiantes
                    </button>
                }
            >
                <div className="space-y-8">
                    <h2 className="section-title">
                        <Users className="text-blue-500" />
                        Listado de Estudiantes
                    </h2>
                    {/* Search and Filters */}
                    <div className="bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-3xl flex flex-col md:flex-row items-center gap-4 shadow-sm">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 shadow-inner"
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Filter size={16} className="text-slate-400 dark:text-gray-400" />
                            <select
                                className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white min-w-[180px] shadow-sm cursor-pointer"
                                value={selectedCohortId}
                                onChange={(e) => setSelectedCohortId(e.target.value)}
                            >
                                <option value="all">All Cohorts</option>
                                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">
                                    <th className="p-6">Student</th>
                                    <th className="p-6 text-center">Enrollment Status</th>
                                    <th className="p-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-12 text-center text-slate-500 dark:text-gray-500 italic">No students found.</td>
                                    </tr>
                                ) : filteredStudents.map(student => (
                                    <tr key={student.user_id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20">
                                                    {student.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">{student.full_name}</div>
                                                    <div className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1.5 mt-1 font-medium italic"><Mail size={12} className="text-blue-400" /> {student.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full border border-green-500/20 text-[10px] font-black uppercase tracking-widest">
                                                <CheckCircle2 size={12} /> Active
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="relative group/actions">
                                                    <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 dark:text-gray-500 active:scale-90">
                                                        <MoreHorizontal size={20} />
                                                    </button>
                                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#1a1c1e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl invisible group-hover/actions:visible z-10 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-600 px-3 py-2.5 border-b border-slate-100 dark:border-white/5 mb-1.5 flex items-center gap-2">
                                                            <Filter size={10} /> Move to Cohort
                                                        </div>
                                                        {cohorts.map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => handleCohortAssignment(student.user_id, c.id)}
                                                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white rounded-xl transition-all flex items-center justify-between group/item"
                                                            >
                                                                {c.name}
                                                                <ChevronRight size={14} className="opacity-0 group-hover/item:opacity-100 -translate-x-2 group-hover/item:translate-x-0 transition-all" />
                                                            </button>
                                                        ))}
                                                        <button
                                                            className="w-full text-left px-4 py-2.5 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all mt-2 border-t border-slate-100 dark:border-white/5 pt-3"
                                                            onClick={() => { if (confirm("Unenroll student?")) handleCohortAssignment(student.user_id, "", true) }}
                                                        >
                                                            Unenroll Student
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CourseEditorLayout>

            {/* Enroll Modal */}
            {
                isEnrollModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-[#16181b] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl scale-in-center">
                            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                                <div>
                                    <h2 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
                                        <UserPlus className="text-blue-600 dark:text-blue-500" />
                                        Enroll Students
                                    </h2>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Select from organization directory</p>
                                </div>
                                <button onClick={() => setIsEnrollModalOpen(false)} className="p-3 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all group active:scale-90">
                                    <X size={20} className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                                </button>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        value={enrollSearch}
                                        onChange={(e) => setEnrollSearch(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[1.5rem] py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-slate-900 dark:text-white shadow-inner"
                                    />
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {orgUsersLoading ? (
                                        <div className="flex justify-center p-12 text-blue-500 items-center flex-col gap-4">
                                            <Loader2 className="w-10 h-10 animate-spin" />
                                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Fetching Directory...</span>
                                        </div>
                                    ) : allOrgUsers.filter(u => u.full_name.toLowerCase().includes(enrollSearch.toLowerCase())).length === 0 ? (
                                        <div className="text-center p-12 text-slate-400 dark:text-gray-500 italic font-medium">No remaining students found in organization directory.</div>
                                    ) : (
                                        allOrgUsers.filter(u => u.full_name.toLowerCase().includes(enrollSearch.toLowerCase())).map(user => (
                                            <div key={user.id} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl group/user hover:bg-white dark:hover:bg-white/[0.08] transition-all shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/10 flex items-center justify-center shadow-sm">
                                                        <UserCircle className="text-slate-400 dark:text-gray-500" size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-900 dark:text-white text-sm tracking-tight group-hover/user:text-blue-600 dark:group-hover/user:text-blue-400 transition-colors uppercase">{user.full_name}</div>
                                                        <div className="text-xs text-slate-400 dark:text-gray-500 font-medium flex items-center gap-1.5 mt-0.5 italic"><Mail size={10} className="text-blue-400" /> {user.email}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleEnroll([user.email])}
                                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95"
                                                >
                                                    Enroll
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-5 rounded-3xl flex gap-4 shadow-sm">
                                    <div className="w-10 h-10 rounded-2xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0 shadow-sm">
                                        <Plus size={20} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="text-xs text-blue-800/80 dark:text-blue-300 leading-relaxed font-bold uppercase tracking-wide">
                                        You can also enroll external students by going to the <strong>Gradebook</strong> and using the Bulk Enroll feature.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
}
