"use client";

import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/PageLayout";
import { cmsApi, Course, CourseTemplateSummary } from "@/lib/api";
import { BookOpen, Plus, Trash2, Wand2 } from "lucide-react";

export default function CourseTemplatesPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [templates, setTemplates] = useState<CourseTemplateSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const [sourceCourseId, setSourceCourseId] = useState("");
    const [templateName, setTemplateName] = useState("");
    const [templateDescription, setTemplateDescription] = useState("");
    const [creating, setCreating] = useState(false);

    const [instantiatingId, setInstantiatingId] = useState<string | null>(null);

    const sourceCourse = useMemo(
        () => courses.find((c) => c.id === sourceCourseId),
        [courses, sourceCourseId]
    );

    async function loadData() {
        setLoading(true);
        try {
            const [coursesData, templatesData] = await Promise.all([
                cmsApi.getCourses(),
                cmsApi.listCourseTemplates(),
            ]);
            setCourses(coursesData);
            setTemplates(templatesData);
            if (!sourceCourseId && coursesData.length > 0) {
                setSourceCourseId(coursesData[0].id);
                setTemplateName(`${coursesData[0].title} - Base`);
            }
        } catch (error) {
            console.error("Failed to load course templates page", error);
            alert("No se pudieron cargar los datos de plantillas de curso");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadData();
    }, []);

    async function handleCreateTemplate() {
        if (!sourceCourseId || !templateName.trim()) {
            alert("Selecciona un curso y nombre de plantilla");
            return;
        }

        setCreating(true);
        try {
            await cmsApi.createCourseTemplateFromCourse(
                sourceCourseId,
                templateName.trim(),
                templateDescription.trim() || undefined
            );
            setTemplateDescription("");
            await loadData();
            alert("Plantilla de curso creada");
        } catch (error) {
            console.error("Failed to create course template", error);
            alert("No se pudo crear la plantilla de curso");
        } finally {
            setCreating(false);
        }
    }

    async function handleInstantiateTemplate(template: CourseTemplateSummary) {
        const customTitle = prompt(
            "Título del nuevo curso (opcional):",
            `${template.name} - Copia`
        );

        setInstantiatingId(template.id);
        try {
            const created = await cmsApi.applyCourseTemplate(
                template.id,
                customTitle && customTitle.trim().length > 0 ? customTitle.trim() : undefined
            );
            alert(`Curso creado desde plantilla: ${created.title}`);
        } catch (error) {
            console.error("Failed to instantiate template", error);
            alert("No se pudo crear el curso desde la plantilla");
        } finally {
            setInstantiatingId(null);
        }
    }

    async function handleDeleteTemplate(template: CourseTemplateSummary) {
        const ok = confirm(`¿Eliminar plantilla \"${template.name}\"?`);
        if (!ok) return;

        try {
            await cmsApi.deleteCourseTemplate(template.id);
            await loadData();
        } catch (error) {
            console.error("Failed to delete template", error);
            alert("No se pudo eliminar la plantilla");
        }
    }

    return (
        <PageLayout
            title="Plantillas de Curso"
            description="Crea una plantilla base de curso y genera nuevos cursos reutilizando estructura y evaluaciones."
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 space-y-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nueva plantilla</h2>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Curso base</label>
                        <select
                            value={sourceCourseId}
                            onChange={(e) => {
                                setSourceCourseId(e.target.value);
                                const c = courses.find((x) => x.id === e.target.value);
                                if (c) setTemplateName(`${c.title} - Base`);
                            }}
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2"
                        >
                            {courses.map((c) => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre de plantilla</label>
                        <input
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2"
                            placeholder="Ej. Inglés A1 - Base"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción</label>
                        <textarea
                            value={templateDescription}
                            onChange={(e) => setTemplateDescription(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2"
                            rows={4}
                            placeholder="Opcional"
                        />
                    </div>

                    <button
                        onClick={handleCreateTemplate}
                        disabled={creating || !sourceCourseId || !templateName.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold"
                    >
                        <Plus size={16} />
                        {creating ? "Creando..." : "Guardar como plantilla"}
                    </button>

                    {sourceCourse && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Se usará la estructura de: <strong>{sourceCourse.title}</strong>
                        </p>
                    )}
                </div>

                <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Plantillas disponibles</h2>

                    {loading ? (
                        <p className="text-slate-500">Cargando...</p>
                    ) : templates.length === 0 ? (
                        <p className="text-slate-500">No hay plantillas de curso todavía.</p>
                    ) : (
                        <div className="space-y-3">
                            {templates.map((t) => (
                                <div key={t.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <BookOpen size={16} className="text-blue-600" />
                                            <h3 className="font-semibold text-slate-900 dark:text-white">{t.name}</h3>
                                        </div>
                                        {t.description ? (
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.description}</p>
                                        ) : null}
                                        <p className="text-xs text-slate-500 mt-2">
                                            Creada: {new Date(t.created_at).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleInstantiateTemplate(t)}
                                            disabled={instantiatingId === t.id}
                                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold"
                                        >
                                            <Wand2 size={14} />
                                            {instantiatingId === t.id ? "Creando..." : "Crear curso"}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTemplate(t)}
                                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
                                        >
                                            <Trash2 size={14} /> Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageLayout>
    );
}
