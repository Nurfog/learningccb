'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    cmsApi,
    questionBankApi,
    TestTemplate,
    TestTemplateFilters,
    TestType,
    Course,
    MySqlPlan,
    MySqlCourse,
} from '@/lib/api';
import { Plus, Search, Filter, Edit2, Trash2, Eye, Copy, BookOpen, Clock, Target, Tag, X } from 'lucide-react';

interface TestTemplateManagerProps {
    onSelectTemplate?: (template: TestTemplate) => void;
    onCreateTemplate?: () => void;
}

export default function TestTemplateManager({ onSelectTemplate, onCreateTemplate }: TestTemplateManagerProps) {
    const [templates, setTemplates] = useState<TestTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState<TestTemplateFilters>({});
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [filterPlans, setFilterPlans] = useState<MySqlPlan[]>([]);
    const [filterCourses, setFilterCourses] = useState<MySqlCourse[]>([]);
    const [filterPlanId, setFilterPlanId] = useState<number | ''>('');
    const [filterCourseId, setFilterCourseId] = useState<number | ''>('');

    const [showApplyModal, setShowApplyModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);

    const [applyPlans, setApplyPlans] = useState<MySqlPlan[]>([]);
    const [applyCourses, setApplyCourses] = useState<MySqlCourse[]>([]);
    const [applyPlanId, setApplyPlanId] = useState<number | ''>('');
    const [applyCourseId, setApplyCourseId] = useState<number | ''>('');
    const [applyCoursesError, setApplyCoursesError] = useState('');

    const [selectedLesson, setSelectedLesson] = useState<string>('');
    const [applying, setApplying] = useState(false);

    const resetApplyState = () => {
        setSelectedTemplate(null);
        setApplyPlanId('');
        setApplyCourseId('');
        setApplyCoursesError('');
        setSelectedLesson('');
    };

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const data = await cmsApi.listTestTemplates(filters);
            setTemplates(data);
        } catch (error) {
            console.error('Failed to load test templates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, [filters]);

    useEffect(() => {
        questionBankApi.getMySQLPlans().then(setFilterPlans).catch(() => {});
        questionBankApi.getMySQLPlans().then(setApplyPlans).catch(() => {});
    }, []);

    useEffect(() => {
        if (!filterPlanId) {
            setFilterCourses([]);
            setFilterCourseId('');
            setFilters((f) => ({ ...f, mysql_course_id: undefined }));
            return;
        }
        questionBankApi.getMySQLCoursesByPlan(filterPlanId).then(setFilterCourses).catch(() => {});
    }, [filterPlanId]);

    useEffect(() => {
        if (!applyPlanId) {
            setApplyCourses([]);
            setApplyCourseId('');
            setApplyCoursesError('');
            return;
        }
        questionBankApi
            .getMySQLCoursesByPlan(applyPlanId)
            .then((courses) => {
                setApplyCourses(courses);
                setApplyCoursesError('');
            })
            .catch((error) => {
                console.error('Failed to load MySQL courses by plan:', error);
                setApplyCourses([]);
                setApplyCoursesError('No se pudieron cargar los cursos para este plan.');
            });
    }, [applyPlanId]);

    const getCourseTypeFromPlan = (planName: string): 'intensive' | 'regular' => {
        const planLower = (planName || '').toLowerCase();
        return planLower.includes('intensive') || planLower.includes('intensivo') ? 'intensive' : 'regular';
    };

    const getCourseLevelFromMysql = (nivelCurso?: number, planNombre?: string): string => {
        if (typeof nivelCurso === 'number') {
            if (nivelCurso >= 1 && nivelCurso <= 2) return 'beginner';
            if (nivelCurso >= 3 && nivelCurso <= 4) return 'beginner_1';
            if (nivelCurso >= 5 && nivelCurso <= 6) return 'beginner_2';
            if (nivelCurso >= 7 && nivelCurso <= 8) return 'intermediate';
            if (nivelCurso >= 9 && nivelCurso <= 10) return 'intermediate_1';
            if (nivelCurso >= 11 && nivelCurso <= 12) return 'intermediate_2';
            return 'advanced';
        }

        const planLower = (planNombre || '').toLowerCase();
        if (planLower.includes('basic') || planLower.includes('beginner')) return 'beginner';
        if (planLower.includes('intermediate') || planLower.includes('intermedio')) return 'intermediate';
        return 'advanced';
    };

    const matchingPlatformCourses = useMemo(() => {
        if (!applyCourseId) return [] as Course[];
        const mysqlCourse = applyCourses.find((c) => c.idCursos === applyCourseId);
        if (!mysqlCourse) return [] as Course[];

        const expectedLevel = getCourseLevelFromMysql(mysqlCourse.NivelCurso, mysqlCourse.NombrePlan);
        const expectedType = getCourseTypeFromPlan(mysqlCourse.NombrePlan);

        return courses.filter((course) => {
            const courseLevel = String((course as { level?: string }).level || '').toLowerCase();
            const courseType = String((course as { course_type?: string }).course_type || '').toLowerCase();
            return courseLevel === expectedLevel && courseType === expectedType;
        });
    }, [applyCourseId, applyCourses, courses]);

    const selectedPlatformCourseId = useMemo(() => {
        if (matchingPlatformCourses.length === 0) return '';
        return matchingPlatformCourses[0].id;
    }, [matchingPlatformCourses]);

    const filteredTemplates = useMemo(() => {
        if (!searchTerm.trim()) return templates;
        const q = searchTerm.toLowerCase();
        return templates.filter((t) => {
            const inName = t.name?.toLowerCase().includes(q);
            const inDesc = t.description?.toLowerCase().includes(q);
            const inTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
            return Boolean(inName || inDesc || inTags);
        });
    }, [templates, searchTerm]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) return;

        try {
            await cmsApi.deleteTestTemplate(id);
            await loadTemplates();
        } catch (error) {
            console.error('Failed to delete template:', error);
            alert('Error al eliminar la plantilla');
        }
    };

    const handleApplyTemplate = async (template: TestTemplate) => {
        setSelectedTemplate(template);
        setShowApplyModal(true);
        setApplyPlanId('');
        setApplyCourseId('');
        setSelectedLesson('');
        setApplyCoursesError('');

        cmsApi.getCourses()
            .then(setCourses)
            .catch((e) => console.error('Failed to load courses:', e));
    };

    const handleApplyToLesson = async () => {
        if (!selectedTemplate || !selectedPlatformCourseId || !selectedLesson) {
            alert('Selecciona plan, curso y lección');
            return;
        }

        try {
            setApplying(true);
            await cmsApi.applyTemplateToLesson(selectedTemplate.id, selectedLesson);
            alert('Plantilla aplicada exitosamente a la lección');
            setShowApplyModal(false);
            resetApplyState();
        } catch (error) {
            console.error('Failed to apply template:', error);
            alert('Error al aplicar la plantilla');
        } finally {
            setApplying(false);
        }
    };

    const getTestTypeLabel = (type: TestType) => {
        const labels: Record<TestType, string> = {
            CA: 'Evaluación Continua',
            MWT: 'Examen Escrito Parcial',
            MOT: 'Examen Oral Parcial',
            FOT: 'Examen Oral Final',
            FWT: 'Examen Escrito Final',
        };
        return labels[type] || type;
    };

    const getTestTypeColor = (type: TestType) => {
        if (type === 'CA') return 'bg-blue-100 text-blue-800';
        if (type.includes('MWT') || type.includes('MOT')) return 'bg-purple-100 text-purple-800';
        if (type.includes('FWT') || type.includes('FOT')) return 'bg-orange-100 text-orange-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Plantillas de Pruebas</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Gestiona plantillas y vincúlalas a una lección específica de un curso
                    </p>
                </div>
                <button
                    onClick={onCreateTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Plantilla
                </button>
            </div>

            <div className="mb-6 flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar plantillas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                        showFilters ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <Filter className="w-4 h-4" />
                    Filtros
                </button>
            </div>

            {showFilters && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Programa de Estudios</label>
                        <select
                            value={filterPlanId}
                            onChange={(e) => {
                                const id = e.target.value ? Number(e.target.value) : '';
                                setFilterPlanId(id);
                                setFilterCourseId('');
                                setFilters((f) => ({ ...f, mysql_course_id: undefined }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los programas</option>
                            {filterPlans.map((p) => (
                                <option key={p.idPlanDeEstudios} value={p.idPlanDeEstudios}>{p.NombrePlan}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Curso</label>
                        <select
                            value={filterCourseId}
                            disabled={!filterPlanId}
                            onChange={(e) => {
                                const id = e.target.value ? Number(e.target.value) : '';
                                setFilterCourseId(id);
                                setFilters((f) => ({ ...f, mysql_course_id: id || undefined }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <option value="">Todos los cursos</option>
                            {filterCourses.map((c) => (
                                <option key={c.idCursos} value={c.idCursos}>{c.NombreCurso}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Prueba</label>
                        <select
                            value={filters.test_type || ''}
                            onChange={(e) => setFilters({ ...filters, test_type: (e.target.value as TestType) || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los tipos</option>
                            <option value="CA">Continuous Assessment (CA)</option>
                            <option value="MWT">Midterm Written Test (MWT)</option>
                            <option value="MOT">Midterm Oral Test (MOT)</option>
                            <option value="FOT">Final Oral Test (FOT)</option>
                            <option value="FWT">Final Written Test (FWT)</option>
                        </select>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
                    <p className="mt-4 text-gray-600">Cargando plantillas...</p>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No hay plantillas</h3>
                    <p className="text-gray-600 mt-1">Crea tu primera plantilla de prueba</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => (
                        <div
                            key={template.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-semibold text-gray-900 flex-1">{template.name}</h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onSelectTemplate?.(template)}
                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Ver detalles"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => alert(`Implementar: Editar plantilla ${template.id}`)}
                                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {template.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getTestTypeColor(template.test_type)}`}>
                                    {getTestTypeLabel(template.test_type)}
                                </span>
                                {template.mysql_course_id && (
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                        Curso SAM #{template.mysql_course_id}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Clock className="w-4 h-4" />
                                    <span>{template.duration_minutes} minutos</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Target className="w-4 h-4" />
                                    <span>Puntuación mínima: {template.passing_score}%</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Tag className="w-4 h-4" />
                                    <span>Puntos totales: {template.total_points}</span>
                                </div>
                            </div>

                            {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {template.tags.map((tag, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                <span className="text-xs text-gray-500">Usos: {template.usage_count}</span>
                                <button
                                    onClick={() => handleApplyTemplate(template)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                >
                                    <Copy className="w-3 h-3" />
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showApplyModal && selectedTemplate && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Aplicar Plantilla a Lección</h3>
                                <p className="text-sm text-gray-500">{selectedTemplate.name}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowApplyModal(false);
                                    resetApplyState();
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-semibold text-blue-900 mb-2">Información de la Plantilla</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-blue-700">Tipo:</span>
                                        <span className="ml-2 font-medium">{getTestTypeLabel(selectedTemplate.test_type)}</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700">Duración:</span>
                                        <span className="ml-2 font-medium">{selectedTemplate.duration_minutes} min</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700">Puntos:</span>
                                        <span className="ml-2 font-medium">{selectedTemplate.total_points}</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700">Aprobación:</span>
                                        <span className="ml-2 font-medium">{selectedTemplate.passing_score}%</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">1. Programa de Estudios</label>
                                <select
                                    value={applyPlanId}
                                    onChange={(e) => {
                                        setApplyPlanId(e.target.value ? Number(e.target.value) : '');
                                        setApplyCourseId('');
                                        setSelectedLesson('');
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Selecciona un programa...</option>
                                    {applyPlans.map((p) => (
                                        <option key={p.idPlanDeEstudios} value={p.idPlanDeEstudios}>{p.NombrePlan}</option>
                                    ))}
                                </select>
                            </div>

                            {applyPlanId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">2. Curso</label>
                                    <select
                                        value={applyCourseId}
                                        onChange={(e) => {
                                            setApplyCourseId(e.target.value ? Number(e.target.value) : '');
                                            setSelectedLesson('');
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Selecciona un curso...</option>
                                        {applyCourses.map((c) => (
                                            <option key={c.idCursos} value={c.idCursos}>{c.NombreCurso}</option>
                                        ))}
                                    </select>
                                    {applyCoursesError && (
                                        <p className="text-xs text-red-600 mt-1">{applyCoursesError}</p>
                                    )}
                                </div>
                            )}

                            {applyCourseId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">3. Curso destino detectado</label>
                                    {matchingPlatformCourses.length > 0 ? (
                                        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700">
                                            {matchingPlatformCourses[0].title}
                                        </div>
                                    ) : (
                                        <div className="w-full px-3 py-2 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700">
                                            No se encontró un curso de plataforma compatible para este curso SAM.
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedPlatformCourseId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">4. Lección</label>
                                    <LessonSelector
                                        courseId={selectedPlatformCourseId}
                                        selectedLesson={selectedLesson}
                                        onSelect={setSelectedLesson}
                                    />
                                </div>
                            )}

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <h4 className="font-semibold text-yellow-900 mb-2 text-sm">¿Qué sucederá?</h4>
                                <ul className="text-xs text-yellow-800 space-y-1">
                                    <li>• La lección se convertirá en un quiz con las preguntas de la plantilla</li>
                                    <li>• Se configurará con 1 solo intento por alumno</li>
                                    <li>• Los alumnos podrán revisar sus respuestas después de completar</li>
                                </ul>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowApplyModal(false);
                                    resetApplyState();
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyToLesson}
                                disabled={applying || !selectedLesson}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Copy className="w-4 h-4" />
                                {applying ? 'Aplicando...' : 'Aplicar Plantilla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function LessonSelector({
    courseId,
    selectedLesson,
    onSelect,
}: {
    courseId: string;
    selectedLesson: string;
    onSelect: (lessonId: string) => void;
}) {
    const [modules, setModules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadLessons = async () => {
            try {
                setLoading(true);
                const course = await cmsApi.getCourseWithFullOutline(courseId);
                setModules(course.modules || []);
            } catch (error) {
                console.error('Failed to load lessons:', error);
                setModules([]);
            } finally {
                setLoading(false);
            }
        };
        loadLessons();
    }, [courseId]);

    if (loading) {
        return <div className="text-sm text-gray-500">Cargando lecciones...</div>;
    }

    const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
    if (totalLessons === 0) {
        return <div className="text-sm text-red-600">Este curso no tiene lecciones</div>;
    }

    return (
        <select
            value={selectedLesson}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
            <option value="">Selecciona una lección...</option>
            {modules.map((mod) => (
                <optgroup key={mod.id} label={mod.title}>
                    {(mod.lessons || []).map((lesson: any) => (
                        <option key={lesson.id} value={lesson.id}>
                            {lesson.title}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}
