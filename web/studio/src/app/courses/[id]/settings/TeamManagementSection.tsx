"use client";

import React, { useState, useEffect } from "react";
import { cmsApi, CourseInstructor } from "@/lib/api";
import { Users, UserPlus, Trash2, Shield, User, Loader2, Mail } from "lucide-react";

interface TeamManagementSectionProps {
    courseId: string;
}

export default function TeamManagementSection({ courseId }: TeamManagementSectionProps) {
    const [team, setTeam] = useState<CourseInstructor[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("instructor");
    const [error, setError] = useState<string | null>(null);

    const fetchTeam = async () => {
        try {
            setLoading(true);
            const data = await cmsApi.getCourseTeam(courseId);
            setTeam(data);
        } catch (err) {
            console.error("Failed to load team", err);
            setError("Failed to load course team");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeam();
    }, [courseId]);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setAdding(true);
        setError(null);
        try {
            await cmsApi.addTeamMember(courseId, email, role);
            setEmail("");
            fetchTeam();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to add team member. Make sure the user exists.");
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this instructor?")) return;

        try {
            await cmsApi.removeTeamMember(courseId, userId);
            fetchTeam();
        } catch (err) {
            console.error(err);
            alert("Failed to remove team member");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Users size={24} />
                    </div>
                    <div>
                        <h2 className="section-title">Equipo del Curso</h2>
                        <p className="text-sm text-gray-400">Gestiona los instructores y asistentes de este curso</p>
                    </div>
                </div>
            </div>

            {/* Add Member Form */}
            <form onSubmit={handleAddMember} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                    <UserPlus size={16} /> Add Team Member
                </h3>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="instructor@example.com"
                            className="w-full bg-black/30 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            required
                        />
                    </div>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="instructor">Instructor</option>
                        <option value="assistant">Assistant</option>
                        <option value="primary">Primary Instructor</option>
                    </select>
                    <button
                        type="submit"
                        disabled={adding}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-xl text-sm transition-all active:scale-95 flex items-center gap-2"
                    >
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus size={16} />}
                        Add Member
                    </button>
                </div>
                {error && <p className="mt-3 text-xs text-red-400 font-medium">{error}</p>}
            </form>

            {/* Member List */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-300">Active Instructors</h3>
                <div className="grid grid-cols-1 gap-4">
                    {team.map((member) => (
                        <div key={member.user_id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/[0.07] transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/10">
                                    {member.full_name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold flex items-center gap-2">
                                        {member.full_name}
                                        {member.role === 'primary' && (
                                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                                Primary
                                            </span>
                                        )}
                                        {member.role === 'assistant' && (
                                            <span className="px-2 py-0.5 bg-gray-500/10 border border-gray-500/20 rounded text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                Assistant
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500">{member.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {member.role !== 'primary' && (
                                    <button
                                        onClick={() => handleRemoveMember(member.user_id)}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                        title="Remove member"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {team.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            No instructors added yet.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
