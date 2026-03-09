"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course, Module, Lesson, Organization } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
    Plus,
    Pencil,
    ChevronUp,
    ChevronDown,
    PlayCircle,
    FileText,
    Calendar,
    Save,
    X,
    GripVertical,
    Trash2,
    ArrowLeft,
    Send,
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

interface FullModule extends Module {
    lessons: Lesson[];
}

export default function CourseEditor({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<FullModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [saving, setSaving] = useState(false); // Added saving state
    const { user } = useAuth();

    const startEditing = (id: string, currentTitle: string) => {
        setEditingId(id);
        setEditValue(currentTitle);
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await cmsApi.getCourseWithFullOutline(params.id);
                setCourse(data);
                setModules(data.modules as FullModule[]);
            } catch (err) {
                console.error("Failed to load course data:", err);
                setError("Failed to load course details. Is the backend running?");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [params.id]);



    const handleAddModule = async () => {
        const title = "";
        try {
            const newMod = await cmsApi.createModule(params.id, title, modules.length + 1);
            const fullMod = { ...newMod, lessons: [] };
            setModules([...modules, fullMod]);
            setEditingId(newMod.id);
            setEditValue(title);
        } catch {
            alert("Failed to create module");
        }
    };

    const handleAddLesson = async (moduleId: string) => {
        const mod = modules.find((m: FullModule) => m.id === moduleId);
        if (!mod) return;

        const title = "New Lesson";
        try {
            const newLesson = await cmsApi.createLesson(moduleId, title, "video", mod.lessons.length + 1);
            setModules(modules.map((m: FullModule) =>
                m.id === moduleId
                    ? { ...m, lessons: [...m.lessons, newLesson] }
                    : m
            ));
            setEditingId(newLesson.id);
            setEditValue(title);
        } catch {
            alert("Failed to create lesson");
        }
    };

    const handleSaveTitle = async (id: string, type: 'module' | 'lesson') => {
        if (!editValue) {
            setEditingId(null);
            return;
        }
        try {
            if (type === 'module') {
                await cmsApi.updateModule(id, { title: editValue });
                setModules(modules.map((m: FullModule) => m.id === id ? { ...m, title: editValue } : m));
            } else {
                await cmsApi.updateLesson(id, { title: editValue });
                setModules(modules.map((mod: FullModule) => ({
                    ...mod,
                    lessons: mod.lessons.map((l: Lesson) => l.id === id ? { ...l, title: editValue } : l)
                })));
            }
            setEditingId(null);
        } catch {
            alert("Failed to update title");
        }
    };

    const handleDeleteModule = async (id: string) => {
        if (!confirm("Are you sure you want to delete this module and all its lessons?")) return;
        try {
            await cmsApi.deleteModule(id);
            setModules(modules.filter((m: FullModule) => m.id !== id));
        } catch {
            alert("Failed to delete module");
        }
    };

    const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
        if (!confirm("Are you sure you want to delete this lesson?")) return;
        try {
            await cmsApi.deleteLesson(lessonId);
            setModules(modules.map((m: FullModule) =>
                m.id === moduleId
                    ? { ...m, lessons: m.lessons.filter((l: Lesson) => l.id !== lessonId) }
                    : m
            ));
        } catch {
            alert("Failed to delete lesson");
        }
    };

    const handleReorderModule = async (index: number, direction: 'up' | 'down') => {
        const newModules = [...modules];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newModules.length) return;

        [newModules[index], newModules[targetIndex]] = [newModules[targetIndex], newModules[index]];

        const items = newModules.map((m: FullModule, i: number) => ({ id: m.id, position: i + 1 }));
        setModules(newModules.map((m: FullModule, i: number) => ({ ...m, position: i + 1 })));

        try {
            await cmsApi.reorderModules({ items });
        } catch {
            alert("Failed to save module order");
        }
    };

    const handleReorderLesson = async (moduleId: string, lessonIndex: number, direction: 'up' | 'down') => {
        const mod = modules.find((m: FullModule) => m.id === moduleId);
        if (!mod) return;

        const newLessons = [...mod.lessons];
        const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
        if (targetIndex < 0 || targetIndex >= newLessons.length) return;

        [newLessons[lessonIndex], newLessons[targetIndex]] = [newLessons[targetIndex], newLessons[lessonIndex]];

        const items = newLessons.map((l: Lesson, i: number) => ({ id: l.id, position: i + 1 }));
        setModules(modules.map((m: FullModule) => m.id === moduleId ? { ...m, lessons: newLessons.map((l: Lesson, i: number) => ({ ...l, position: i + 1 })) } : m));

        try {
            await cmsApi.reorderLessons({ items });
        } catch {
            alert("Failed to save lesson order");
        }
    };

    const handlePublish = async () => {
        if (!course) return;
        publishCourse();
    };

    const publishCourse = async () => {
        try {
            setSaving(true);
            await cmsApi.publishCourse(params.id as string);
            alert("Course published successfully!");
        } catch (err) {
            console.error("Failed to publish course", err);
            alert("Failed to publish course.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-20 text-center">Loading editor...</div>;
    if (error) return <div className="py-20 text-center text-red-400">{error}</div>;

    return (
        <>
            <CourseEditorLayout
                activeTab="outline"
                pageTitle="Editor de Curso"
                pageDescription={`Diseña la estructura de tu curso y el contenido de las lecciones.`}
                pageActions={
                    <div className="flex items-center gap-4">
                        <button
                            onClick={async () => {
                                try {
                                    const { token } = await cmsApi.getPreviewToken(params.id);
                                    const expUrl = process.env.NEXT_PUBLIC_EXPERIENCE_URL || "http://localhost:3000";
                                    window.open(`${expUrl}/courses/${params.id}?preview_token=${token}`, "_blank");
                                } catch (err) {
                                    console.error("Failed to get preview token", err);
                                    alert("Failed to start preview.");
                                }
                            }}
                            className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] uppercase tracking-widest font-black transition-all active:scale-95 text-slate-600 dark:text-white shadow-sm"
                        >
                            <PlayCircle size={20} className="text-blue-500" /> PREVIEW
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={saving}
                            className={`flex items-center gap-3 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all active:scale-95 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                            {saving ? 'PUBLISHING...' : 'PUBLISH COURSE'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-6">
                    {modules.map((module: FullModule, mIndex: number) => (
                        <div key={module.id} className="bg-white dark:bg-white/5 rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm group/module">
                            <div className="bg-slate-50 dark:bg-white/5 px-8 p-6 flex justify-between items-center border-b border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-6 flex-1">
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => handleReorderModule(mIndex, 'up')}
                                            disabled={mIndex === 0}
                                            className="p-1 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-0 transition-colors bg-white dark:bg-white/5 rounded-md border border-slate-100 dark:border-white/5"
                                        >
                                            <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleReorderModule(mIndex, 'down')}
                                            disabled={mIndex === modules.length - 1}
                                            className="p-1 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-0 transition-colors bg-white dark:bg-white/5 rounded-md border border-slate-100 dark:border-white/5"
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <GripVertical className="text-slate-300 dark:text-gray-600 w-5 h-5 cursor-grab active:cursor-grabbing hover:text-blue-500 transition-colors" />

                                    {editingId === module.id ? (
                                        <div className="flex items-center gap-3 flex-1 max-w-2xl">
                                            <input
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(module.id, 'module')}
                                                className="bg-white dark:bg-black/40 border border-blue-500/50 rounded-2xl px-5 py-3 flex-1 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-lg font-black uppercase tracking-tight shadow-inner"
                                            />
                                            <button onClick={() => handleSaveTitle(module.id, 'module')} className="w-12 h-12 flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-500/10">
                                                <Save className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="w-12 h-12 flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 group flex-1">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-0.5">Module {mIndex + 1}</span>
                                                <span
                                                    onClick={() => { setEditingId(module.id); setEditValue(module.title); }}
                                                    className="font-black text-2xl text-slate-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase tracking-tight"
                                                >
                                                    {module.title || `Untitled Section`}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => { setEditingId(module.id); setEditValue(module.title); }}
                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-blue-600 dark:text-gray-600 transition-all active:scale-90"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDeleteModule(module.id)}
                                        className="w-11 h-11 flex items-center justify-center bg-transparent border border-transparent hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-300 hover:text-red-600 transition-all rounded-xl active:scale-95"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-10 space-y-4 bg-slate-50/30 dark:bg-transparent">
                                {module.lessons.map((lesson: Lesson, lIndex: number) => (
                                    <div key={lesson.id} className="flex items-center gap-5 group/row">
                                        <div className="flex flex-col gap-1 opacity-0 group-hover/row:opacity-100 transition-all scale-95 group-hover/row:scale-100">
                                            <button
                                                onClick={() => handleReorderLesson(module.id, lIndex, 'up')}
                                                disabled={lIndex === 0}
                                                className="p-1 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-0 bg-white dark:bg-white/5 rounded-md border border-slate-100 dark:border-white/5"
                                            >
                                                <ChevronUp className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleReorderLesson(module.id, lIndex, 'down')}
                                                disabled={lIndex === module.lessons.length - 1}
                                                className="p-1 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-0 bg-white dark:bg-white/5 rounded-md border border-slate-100 dark:border-white/5"
                                            >
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                        </div>

                                        <div className="flex-1">
                                            {editingId === lesson.id ? (
                                                <div className="flex items-center gap-3 bg-white dark:bg-black/20 border-2 border-blue-500/50 p-3 rounded-2xl shadow-inner animate-in slide-in-from-left-2 duration-200">
                                                    <input
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(lesson.id, 'lesson')}
                                                        className="bg-transparent border-none flex-1 text-slate-900 dark:text-white focus:outline-none font-black uppercase tracking-tight"
                                                    />
                                                    <button onClick={() => handleSaveTitle(lesson.id, 'lesson')} className="w-9 h-9 flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="w-9 h-9 flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 p-5 rounded-[1.5rem] hover:bg-slate-50 dark:hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer group/lesson shadow-sm">
                                                    <Link href={`/courses/${params.id}/lessons/${lesson.id}`} className="flex-1 flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover/lesson:scale-110 transition-transform shadow-sm">
                                                            {lesson.content_type === 'video' ? <PlayCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(lesson.id, lesson.title); }}
                                                                className="font-black text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase tracking-tight text-sm"
                                                            >
                                                                {lesson.title}
                                                            </span>
                                                            <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-gray-500 uppercase mt-1 font-black tracking-widest">
                                                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-md">{lesson.content_type}</span>
                                                                {lesson.due_date && (
                                                                    <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400/80">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {new Date(lesson.due_date).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(lesson.id, lesson.title); }}
                                                            className="opacity-0 group-hover/lesson:opacity-100 w-10 h-10 flex items-center justify-center bg-transparent hover:bg-blue-50 dark:hover:bg-white/5 rounded-xl text-slate-400 hover:text-blue-600 transition-all"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLesson(module.id, lesson.id); }}
                                                            className="opacity-0 group-hover/lesson:opacity-100 w-10 h-10 flex items-center justify-center bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={() => handleAddLesson(module.id)}
                                    className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all mt-4 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <Plus className="w-4 h-4" /> Add Lesson to Module
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleAddModule}
                        className="w-full py-12 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all flex items-center justify-center gap-4 group shadow-inner"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-sm group-hover:scale-110 transition-transform">
                            <Plus className="w-6 h-6" />
                        </div>
                        Add New Curriculum Module
                    </button>
                </div>
            </CourseEditorLayout>

        </>
    );
}
