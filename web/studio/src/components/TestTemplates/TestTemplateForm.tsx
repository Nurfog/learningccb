'use client';

import React, { useState } from 'react';
import { cmsApi, CreateTestTemplatePayload, CourseLevel, CourseType, TestType, QuestionType } from '@/lib/api';
import { X, Save, Plus, Trash2, Sparkles, ChevronDown, ChevronUp, Copy, GripVertical, Edit2 } from 'lucide-react';

interface Section {
    id: string;
    title: string;
    description?: string;
    section_order: number;
    points: number;
    instructions?: string;
}

interface Question {
    id: string;
    section_id?: string;
    question_order: number;
    question_type: QuestionType;
    question_text: string;
    options?: string[];
    correct_answer?: number | number[] | string;
    explanation?: string;
    points: number;
    metadata?: any;
}

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

    const [sections, setSections] = useState<Section[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
    const [aiContext, setAiContext] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('El nombre es obligatorio');
            return;
        }

        if (questions.length === 0) {
            alert('Debes agregar al menos una pregunta');
            return;
        }

        try {
            setSaving(true);
            
            // Primero crear la plantilla
            const template = await cmsApi.createTestTemplate(formData);
            
            // Luego agregar secciones
            for (const section of sections) {
                await cmsApi.createTemplateSection(template.id, {
                    title: section.title,
                    description: section.description,
                    section_order: section.section_order,
                    points: section.points,
                    instructions: section.instructions,
                });
            }
            
            // Finalmente agregar preguntas
            for (const question of questions) {
                await cmsApi.createTemplateQuestion(template.id, {
                    section_id: question.section_id,
                    question_order: question.question_order,
                    question_type: question.question_type,
                    question_text: question.question_text,
                    options: question.options,
                    correct_answer: question.correct_answer,
                    explanation: question.explanation,
                    points: question.points,
                    metadata: question.metadata,
                });
            }
            
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

    const handleAddSection = () => {
        const newSection: Section = {
            id: `section-${Date.now()}`,
            title: `Sección ${sections.length + 1}`,
            description: '',
            section_order: sections.length,
            points: 0,
            instructions: '',
        };
        setSections([...sections, newSection]);
    };

    const handleRemoveSection = (sectionId: string) => {
        setSections(sections.filter(s => s.id !== sectionId));
        setQuestions(questions.filter(q => q.section_id !== sectionId));
    };

    const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
        setSections(sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
    };

    const handleAddQuestion = (sectionId?: string) => {
        const newQuestion: Question = {
            id: `question-${Date.now()}`,
            section_id: sectionId,
            question_order: questions.filter(q => q.section_id === sectionId).length,
            question_type: 'multiple-choice',
            question_text: '',
            options: ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'],
            correct_answer: 0,
            explanation: '',
            points: 1,
        };
        setQuestions([...questions, newQuestion]);
        setExpandedQuestion(newQuestion.id);
    };

    const handleGenerateWithAI = async () => {
        if (!aiContext.trim()) {
            alert('Ingresa el contexto para generar las preguntas (ej: tema de la lección, contenido, etc.)');
            return;
        }

        const token = localStorage.getItem('studio_token');
        if (!token) {
            alert('No hay sesión activa. Por favor inicia sesión nuevamente.');
            return;
        }

        try {
            setGeneratingAI(true);

            // Usar el endpoint RAG de generación de preguntas desde banco MySQL
            const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/test-templates/generate-with-rag`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    topic: aiContext,
                    num_questions: 5,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const generatedQuestions = await response.json();

            // Parsear las preguntas generadas
            if (Array.isArray(generatedQuestions) && generatedQuestions.length > 0) {
                const questionsToAdd: Question[] = generatedQuestions.map((q: any, idx: number) => ({
                    id: `q-${Date.now()}-${idx}`,
                    section_id: undefined,
                    question_order: questions.length + idx,
                    question_type: q.question_type || 'multiple-choice',
                    question_text: q.question_text || q.text,
                    options: q.options || [],
                    correct_answer: q.correct_answer || q.correct,
                    explanation: q.explanation || '',
                    points: q.points || 1,
                }));

                setQuestions([...questions, ...questionsToAdd]);
                alert(`Se generaron ${questionsToAdd.length} preguntas con IA`);
            }
        } catch (error) {
            console.error('AI generation error:', error);
            alert(`Error al generar preguntas con IA: ${error instanceof Error ? error.message : 'Verifica que Ollama esté configurado y el banco de preguntas MySQL tenga datos'}`);
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleDuplicateQuestion = (question: Question) => {
        const duplicate: Question = {
            ...question,
            id: `question-${Date.now()}`,
            question_order: questions.length,
            question_text: `${question.question_text} (copia)`,
        };
        setQuestions([...questions, duplicate]);
    };

    const getQuestionTypeLabel = (type: QuestionType) => {
        const labels: Record<QuestionType, string> = {
            'multiple-choice': 'Opción Múltiple',
            'true-false': 'Verdadero/Falso',
            'short-answer': 'Respuesta Corta',
            'essay': 'Ensayo',
            'matching': 'Emparejamiento',
            'ordering': 'Ordenar',
        };
        return labels[type] || type;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Nueva Plantilla de Prueba</h2>
                        <p className="text-sm text-gray-500">Crea preguntas y secciones para tu evaluación</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Edit2 className="w-4 h-4" />
                            Información Básica
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Descripción
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Descripción de la plantilla..."
                            />
                        </div>

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
                                    <option value="beginner1">Beginner 1</option>
                                    <option value="beginner2">Beginner 2</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="intermediate1">Intermediate 1</option>
                                    <option value="intermediate2">Intermediate 2</option>
                                    <option value="advanced">Advanced</option>
                                    <option value="advanced1">Advanced 1</option>
                                    <option value="advanced2">Advanced 2</option>
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
                                    Duración (min) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.duration_minutes}
                                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                    </div>

                    {/* AI Generation */}
                    <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            Generar Preguntas con IA
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={aiContext}
                                onChange={(e) => setAiContext(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                placeholder="Describe el tema o contenido (ej: 'Past Simple tense, vocabulary about travel, 5 questions')"
                                disabled={generatingAI}
                            />
                            <button
                                type="button"
                                onClick={handleGenerateWithAI}
                                disabled={generatingAI}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Sparkles className="w-4 h-4" />
                                {generatingAI ? 'Generando...' : 'Generar'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            La IA generará preguntas de opción múltiple con explicaciones automáticas.
                        </p>
                    </div>

                    {/* Sections */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Copy className="w-4 h-4" />
                                Secciones y Preguntas
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddSection}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    Agregar Sección
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAddQuestion(undefined)}
                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    Agregar Pregunta
                                </button>
                            </div>
                        </div>

                        {/* Sections List */}
                        {sections.map((section, sIdx) => (
                            <div key={section.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 grid grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => handleUpdateSection(section.id, { title: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                                            placeholder="Título de sección"
                                        />
                                        <input
                                            type="number"
                                            value={section.points}
                                            onChange={(e) => handleUpdateSection(section.id, { points: parseInt(e.target.value) || 0 })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="Puntos"
                                        />
                                        <input
                                            type="text"
                                            value={section.instructions || ''}
                                            onChange={(e) => handleUpdateSection(section.id, { instructions: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="Instrucciones (opcional)"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSection(section.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                {/* Questions for this section */}
                                <div className="ml-4 space-y-2">
                                    {questions.filter(q => q.section_id === section.id).map((q) => (
                                        <div key={q.id} className="bg-white border border-gray-200 rounded p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">{q.question_text || 'Sin título'}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-gray-500">{q.points} pts</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveQuestion(q.id)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => handleAddQuestion(section.id)}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Agregar pregunta a esta sección
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Questions without section */}
                        <div className="space-y-3">
                            {questions.filter(q => !q.section_id).map((question, qIdx) => (
                                <div key={question.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Question Header */}
                                    <div 
                                        className="bg-gray-50 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                                        onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <GripVertical className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-500">Pregunta {qIdx + 1}</span>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                {getQuestionTypeLabel(question.question_type)}
                                            </span>
                                            <span className="text-xs text-gray-500">{question.points} puntos</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleDuplicateQuestion(question)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Duplicar"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveQuestion(question.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            {expandedQuestion === question.id ? (
                                                <ChevronUp className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Question Editor */}
                                    {expandedQuestion === question.id && (
                                        <div className="p-4 space-y-4 bg-white">
                                            {/* Question Type */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Tipo de Pregunta
                                                    </label>
                                                    <select
                                                        value={question.question_type}
                                                        onChange={(e) => handleUpdateQuestion(question.id, { question_type: e.target.value as QuestionType })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="multiple-choice">Opción Múltiple</option>
                                                        <option value="true-false">Verdadero/Falso</option>
                                                        <option value="short-answer">Respuesta Corta</option>
                                                        <option value="essay">Ensayo</option>
                                                        <option value="matching">Emparejamiento</option>
                                                        <option value="ordering">Ordenar</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Puntos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={question.points}
                                                        onChange={(e) => handleUpdateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                        min="1"
                                                    />
                                                </div>
                                            </div>

                                            {/* Question Text */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Pregunta *
                                                </label>
                                                <textarea
                                                    value={question.question_text}
                                                    onChange={(e) => handleUpdateQuestion(question.id, { question_text: e.target.value })}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Escribe el enunciado de la pregunta..."
                                                    required
                                                />
                                            </div>

                                            {/* Options for multiple choice */}
                                            {(question.question_type === 'multiple-choice' || question.question_type === 'true-false') && (
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        Opciones (marca la correcta)
                                                    </label>
                                                    {question.options?.map((option, oIdx) => (
                                                        <div key={oIdx} className="flex items-center gap-2">
                                                            <input
                                                                type="radio"
                                                                name={`correct-${question.id}`}
                                                                checked={question.correct_answer === oIdx}
                                                                onChange={() => handleUpdateQuestion(question.id, { correct_answer: oIdx })}
                                                                className="w-4 h-4 text-blue-600"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={option}
                                                                onChange={(e) => {
                                                                    const newOptions = [...(question.options || [])];
                                                                    newOptions[oIdx] = e.target.value;
                                                                    handleUpdateQuestion(question.id, { options: newOptions });
                                                                }}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                placeholder={`Opción ${oIdx + 1}`}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newOptions = question.options?.filter((_, idx) => idx !== oIdx);
                                                                    handleUpdateQuestion(question.id, { options: newOptions });
                                                                }}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateQuestion(question.id, { 
                                                            options: [...(question.options || []), `Opción ${(question.options?.length || 0) + 1}`] 
                                                        })}
                                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        Agregar opción
                                                    </button>
                                                </div>
                                            )}

                                            {/* Explanation (AI generated field) */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                                    Explicación / Feedback
                                                    <Sparkles className="w-3 h-3 text-purple-600" />
                                                    <span className="text-xs text-gray-500 font-normal">(Generado por IA, editable)</span>
                                                </label>
                                                <textarea
                                                    value={question.explanation || ''}
                                                    onChange={(e) => handleUpdateQuestion(question.id, { explanation: e.target.value })}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                    placeholder="Explicación que se mostrará al estudiante después de responder..."
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Esta explicación se mostrará al alumno después de que responda la pregunta.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {questions.length === 0 && (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <Copy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No hay preguntas agregadas</p>
                                <p className="text-gray-400 text-xs">Usa la IA o agrega preguntas manualmente</p>
                            </div>
                        )}
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
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 sticky bottom-0 bg-white">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || questions.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : `Guardar Plantilla (${questions.length} preguntas)`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
