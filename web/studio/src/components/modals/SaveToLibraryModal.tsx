'use client';

import { useState } from 'react';
import { Block } from '@/lib/api';

interface SaveToLibraryModalProps {
    block: Block;
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, description: string, tags: string[]) => Promise<void>;
}

export default function SaveToLibraryModal({
    block,
    isOpen,
    onClose,
    onSave,
}: SaveToLibraryModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleAddTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            await onSave(name, description, tags);
            // Reset form
            setName('');
            setDescription('');
            setTags([]);
            setTagInput('');
            onClose();
        } catch (error) {
            console.error('Error saving to library:', error);
            alert('Error al guardar en la biblioteca. Por favor intenta de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            handleAddTag();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-4">Guardar en Biblioteca</h2>

                    <form onSubmit={handleSubmit}>
                        {/* Block Type Badge */}
                        <div className="mb-4">
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                {block.type}
                            </span>
                        </div>

                        {/* Name Input */}
                        <div className="mb-4">
                            <label htmlFor="block-name" className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="block-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ej: Quiz de Matemáticas - Álgebra"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Description Input */}
                        <div className="mb-4">
                            <label htmlFor="block-description" className="block text-sm font-medium text-gray-700 mb-1">
                                Descripción (opcional)
                            </label>
                            <textarea
                                id="block-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe cuándo usar este bloque..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Tags Input */}
                        <div className="mb-4">
                            <label htmlFor="block-tags" className="block text-sm font-medium text-gray-700 mb-1">
                                Etiquetas (opcional)
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    id="block-tags"
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="ej: matemáticas, álgebra"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddTag}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium"
                                >
                                    Agregar
                                </button>
                            </div>

                            {/* Tags Display */}
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-sm px-2 py-1 rounded"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(tag)}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving || !name.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Guardando...' : 'Guardar en Biblioteca'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
