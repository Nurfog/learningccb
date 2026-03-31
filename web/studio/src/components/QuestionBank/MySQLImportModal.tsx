'use client';

import React, { useState } from 'react';
import { X, Download, Database, Check, AlertCircle, Upload, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import ExcelImportModal from './ExcelImportModal';

interface MySQLImportModalProps {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function MySQLImportModal({ onSuccess, onCancel }: MySQLImportModalProps) {
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleImportAll = async () => {
        if (!confirm('¿Estás seguro de importar preguntas desde SAM Diagnóstico (adultos, kids y teens)? Esto puede tomar varios minutos.')) {
            return;
        }

        try {
            setImporting(true);
            setError(null);

            const result = await apiFetch('/question-bank/import-sam-diagnostico', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            setImportResult(result);

            // Refresh parent data but keep modal open so the user can inspect counts/errors.
            onSuccess?.();
        } catch (error: any) {
            console.error('SAM diagnostico import failed:', error);
            setError(error.message || 'Error al importar preguntas desde SAM Diagnóstico');
        } finally {
            setImporting(false);
        }
    };

    if (showExcelModal) {
        return (
            <ExcelImportModal
                onSuccess={onSuccess}
                onCancel={() => setShowExcelModal(false)}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <Database className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Importar Preguntas
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Desde MySQL o Excel
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* SAM Diagnostico Import */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-3">
                            <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-2">
                                    Importar desde SAM Diagnostico
                                </h4>
                                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                                    <li>• Origen: tablas SAM diagnostico (adultos, kids y teens)</li>
                                    <li>• Sin duplicados (usa sam_id en source_metadata)</li>
                                    <li>• Mapeo directo al banco de preguntas de OpenCCB</li>
                                </ul>
                            </div>
                        </div>
                        <button
                            onClick={handleImportAll}
                            disabled={importing}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            {importing ? 'Importando...' : 'Importar Todo desde SAM Diagnostico'}
                        </button>
                    </div>

                    {/* Excel Import */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-3">
                            <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm mb-2">
                                    Importar desde Excel
                                </h4>
                                <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
                                    <li>• Archivo .xlsx con tus preguntas</li>
                                    <li>• Plantilla personalizada</li>
                                    <li>• Múltiples tipos de preguntas</li>
                                </ul>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowExcelModal(true)}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                            Importar desde Excel
                        </button>
                    </div>

                    {/* Result Messages */}
                    {importResult && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <Check className="w-5 h-5 text-green-600" />
                                <p className="font-semibold text-green-900 dark:text-green-100 text-sm">
                                    ¡Importación completada!
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-green-700 dark:text-green-300">Importadas:</span>
                                    <span className="ml-2 font-bold text-green-900 dark:text-green-100">
                                        {importResult.imported}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-green-700 dark:text-green-300">Saltadas:</span>
                                    <span className="ml-2 font-bold text-green-900 dark:text-green-100">
                                        {importResult.skipped}
                                    </span>
                                </div>
                                {importResult.updated !== undefined && (
                                    <div>
                                        <span className="text-green-700 dark:text-green-300">Actualizadas:</span>
                                        <span className="ml-2 font-bold text-green-900 dark:text-green-100">
                                            {importResult.updated}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                                <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">
                                    <p className="font-semibold mb-1">Errores reportados por el backend: {importResult.errors.length}</p>
                                    <p>Primer error: {String(importResult.errors[0])}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <div>
                                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                                    Error
                                </p>
                                <p className="text-xs text-red-700 dark:text-red-300">
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={importing}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        {importResult ? 'Cerrar' : 'Cancelar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
