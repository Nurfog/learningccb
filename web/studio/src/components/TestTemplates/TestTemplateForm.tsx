'use client';

import React, { useState } from 'react';
import { cmsApi, CreateTestTemplatePayload, CourseLevel, CourseType, TestType } from '@/lib/api';
import { X, Save, Plus, Trash2 } from 'lucide-react';

interface TestTemplateFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function TestTemplateForm({ onSuccess, onCancel }: TestTemplateFormProps) {
    const [formData, setFormData] = useState<CreateTestTemplatePayload>({
        name: '',
        description: '',
        level: 'beginner',
        course_type: 'regular',
        test_type: 'CA',
        duration_minutes: 60,
        passing_score: 70,
        total_points: 100,
        instructions: '',
        template_data: { sections: [], questions: [] },
        tags: [],
    });

    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            alert('El nombre es obligatorio');
            return;
        }

        try {
            setSaving(true);
            await cmsApi.createTestTemplate(formData);
            alert('Plantilla creada exitosamente');
            onSuccess?.();
        } catch (error) {
            console.error('Failed to create template:', error);
            alert('Error al crear la plantilla');
        } finally {
            setSaving(false);
        }
    };

    const handleAddTag = () => {
        if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
            setFormData({
                ...formData,
                tags: [...(formData.tags || []), newTag.trim()],
            });
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setFormData({
            ...formData,
            tags: formData.tags?.filter(tag => tag !== tagToRemove) || [],
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Nueva Plantilla de Prueba</h2>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">Información Básica</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Final Exam - Beginner 1"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Descripción
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Descripción de la plantilla..."
                            />
                        </div>
                    </div>

                    {/* Classification */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">Clasificación</h3>
                        
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nivel *
                                </label>
                                <select
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value as CourseLevel })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tipo de Curso *
                                </label>
                                <select
                                    value={formData.course_type}
                                    onChange={(e) => setFormData({ ...formData, course_type: e.target.value as CourseType })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="regular">Regular</option>
                                    <option value="intensive">Intensivo</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tipo de Prueba *
                                </label>
                                <select
                                    value={formData.test_type}
                                    onChange={(e) => setFormData({ ...formData, test_type: e.target.value as TestType })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="CA">Continuous Assessment (CA)</option>
                                    <option value="MWT">Midterm Written Test (MWT)</option>
                                    <option value="MOT">Midterm Oral Test (MOT)</option>
                                    <option value="FOT">Final Oral Test (FOT)</option>
                                    <option value="FWT">Final Written Test (FWT)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Configuration */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">Configuración</h3>
                        
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Duración (minutos) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.duration_minutes}
                                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Puntuación Mínima (%) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.passing_score}
                                    onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                    max="100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Puntos Totales *
                                </label>
                                <input
                                    type="number"
                                    value={formData.total_points}
                                    onChange={(e) => setFormData({ ...formData, total_points: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Instrucciones
                            </label>
                            <textarea
                                value={formData.instructions}
                                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Instrucciones generales para la prueba..."
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">Etiquetas</h3>
                        
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Agregar etiqueta..."
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar
                            </button>
                        </div>

                        {formData.tags && formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {formData.tags.map((tag, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-blue-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Plantilla'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
