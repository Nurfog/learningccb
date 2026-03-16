'use client';

import React, { useState, useEffect } from 'react';
import { cmsApi, TestTemplate, TestTemplateFilters, CourseLevel, CourseType, TestType } from '@/lib/api';
import { Plus, Search, Filter, Edit2, Trash2, Eye, Copy, BookOpen, Clock, Target, Tag } from 'lucide-react';

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
        if (onSelectTemplate) {
            onSelectTemplate(template);
        } else {
            alert(`Plantilla "${template.name}" seleccionada. (Implementar lógica de aplicación)`);
        }
    };

    const getLevelLabel = (level: CourseLevel) => {
        const labels: Record<CourseLevel, string> = {
            beginner: 'Beginner',
            beginner_1: 'Beginner 1',
            beginner_2: 'Beginner 2',
            intermediate: 'Intermediate',
            intermediate_1: 'Intermediate 1',
            intermediate_2: 'Intermediate 2',
            advanced: 'Advanced',
            advanced_1: 'Advanced 1',
            advanced_2: 'Advanced 2',
        };
        return labels[level] || level;
    };

    const getCourseTypeLabel = (type: CourseType) => {
        return type === 'intensive' ? 'Intensivo' : 'Regular';
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

    const getLevelColor = (level: CourseLevel) => {
        if (level.includes('beginner')) return 'bg-green-100 text-green-800';
        if (level.includes('intermediate')) return 'bg-yellow-100 text-yellow-800';
        if (level.includes('advanced')) return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    const getTestTypeColor = (type: TestType) => {
        if (type === 'CA') return 'bg-blue-100 text-blue-800';
        if (type.includes('MWT') || type.includes('MOT')) return 'bg-purple-100 text-purple-800';
        if (type.includes('FWT') || type.includes('FOT')) return 'bg-orange-100 text-orange-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Plantillas de Pruebas</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Gestiona plantillas de evaluaciones por nivel y tipo de curso
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

            {/* Search and Filters */}
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

            {/* Filter Panel */}
            {showFilters && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
                        <select
                            value={filters.level || ''}
                            onChange={(e) => setFilters({ ...filters, level: e.target.value as CourseLevel || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los niveles</option>
                            <option value="beginner">Beginner</option>
                            <option value="beginner_1">Beginner 1</option>
                            <option value="beginner_2">Beginner 2</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="intermediate_1">Intermediate 1</option>
                            <option value="intermediate_2">Intermediate 2</option>
                            <option value="advanced">Advanced</option>
                            <option value="advanced_1">Advanced 1</option>
                            <option value="advanced_2">Advanced 2</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Curso</label>
                        <select
                            value={filters.course_type || ''}
                            onChange={(e) => setFilters({ ...filters, course_type: e.target.value as CourseType || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los tipos</option>
                            <option value="intensive">Intensivo</option>
                            <option value="regular">Regular</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Prueba</label>
                        <select
                            value={filters.test_type || ''}
                            onChange={(e) => setFilters({ ...filters, test_type: e.target.value as TestType || undefined })}
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

            {/* Templates Grid */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando plantillas...</p>
                </div>
            ) : templates.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No hay plantillas</h3>
                    <p className="text-gray-600 mt-1">Crea tu primera plantilla de prueba</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-semibold text-gray-900 flex-1">{template.name}</h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => alert(`Implementar: Ver plantilla ${template.id}`)}
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

                            {/* Description */}
                            {template.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>
                            )}

                            {/* Badges */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(template.level)}`}>
                                    {getLevelLabel(template.level)}
                                </span>
                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {getCourseTypeLabel(template.course_type)}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getTestTypeColor(template.test_type)}`}>
                                    {getTestTypeLabel(template.test_type)}
                                </span>
                            </div>

                            {/* Metadata */}
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

                            {/* Tags */}
                            {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {template.tags.map((tag, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Usage Stats */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                <span className="text-xs text-gray-500">
                                    Usos: {template.usage_count}
                                </span>
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
        </div>
    );
}
