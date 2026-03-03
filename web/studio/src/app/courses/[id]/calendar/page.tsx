"use client";
import { useEffect, useState } from "react";
import { cmsApi, Course, Lesson } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    AlertCircle
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function CourseCalendarPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const loadData = async () => {
            try {
                const courseData = await cmsApi.getCourseWithFullOutline(params.id);
                setCourse(courseData);

                // Flatten lessons from modules
                const allLessons: Lesson[] = [];
                courseData.modules?.forEach(mod => {
                    mod.lessons.forEach(lesson => {
                        allLessons.push(lesson);
                    });
                });
                setLessons(allLessons);
            } catch (err) {
                console.error("Failed to load course data", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [params.id]);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Padding for first week
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 border-r border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/2"></div>);
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayLessons = lessons.filter(l => l.due_date && l.due_date.startsWith(dateStr));

            days.push(
                <div key={day} className="h-36 border-r border-b border-slate-100 dark:border-white/5 p-3 relative hover:bg-slate-50 dark:hover:bg-white/5 transition-all group cursor-pointer">
                    <span className="text-xs font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">{day}</span>
                    <div className="mt-2 space-y-1.5 overflow-y-auto max-h-24 custom-scrollbar">
                        {dayLessons.map(lesson => (
                            <div
                                key={lesson.id}
                                className={`text-[9px] p-1.5 rounded-lg truncate flex items-center gap-1.5 font-bold uppercase tracking-tight shadow-sm border ${lesson.important_date_type === 'exam' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30' :
                                    lesson.important_date_type === 'assignment' ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' :
                                        lesson.important_date_type === 'live-session' ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30'
                                    }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${lesson.important_date_type === 'exam' ? 'bg-red-500' : lesson.important_date_type === 'assignment' ? 'bg-blue-500' : lesson.important_date_type === 'live-session' ? 'bg-purple-500' : 'bg-emerald-500'}`}></span>
                                {lesson.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return days;
    };

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));

    if (loading) return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    return (
        <CourseEditorLayout
            activeTab="calendar"
            pageTitle="Calendario del Curso"
            pageDescription={`Gestiona fechas importantes y plazos para ${course?.title || 'este curso'}.`}
        >
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                        <h3 className="text-2xl font-black uppercase tracking-tight">{monthName} <span className="text-blue-500">{year}</span></h3>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-xl p-1 border border-slate-200 dark:border-white/10">
                            <button onClick={prevMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-600 dark:text-gray-400"><ChevronLeft className="w-5 h-5" /></button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Hoy</button>
                            <button onClick={nextMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-600 dark:text-gray-400"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/20"></span> Examen
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20"></span> Tarea
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/20"></span> En Vivo
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></span> Lección
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-7 border-t border-l border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm bg-white dark:bg-white/[0.02]">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="bg-slate-50 dark:bg-white/5 py-4 text-center text-xs font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 border-r border-b border-slate-200 dark:border-white/5">
                            {day}
                        </div>
                    ))}
                    {renderCalendar()}
                </div>

                <div className="mt-12 space-y-4">
                    <h4 className="text-lg font-bold flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-500" />
                        Upcoming Deadlines
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lessons
                            .filter(l => l.due_date && new Date(l.due_date) >= new Date())
                            .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                            .slice(0, 6)
                            .map(lesson => (
                                <div key={lesson.id} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 hover:bg-white dark:hover:bg-white/10 transition-all group shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${lesson.important_date_type === 'exam' ? 'text-red-500' :
                                                lesson.important_date_type === 'assignment' ? 'text-blue-500' :
                                                    'text-emerald-500'
                                                }`}>
                                                {lesson.important_date_type || 'Activity'}
                                            </div>
                                            <h5 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight">{lesson.title}</h5>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-slate-900 dark:text-white">{new Date(lesson.due_date!).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black mt-0.5 tracking-tighter">Due Date</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
        </CourseEditorLayout>
    );
}
