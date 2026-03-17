'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Database, Check, AlertCircle, Upload, FileSpreadsheet } from 'lucide-react';
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
        if (!confirm('¿Estás seguro de importar TODAS las preguntas de MySQL? Esto puede tomar varios minutos.')) {
            return;
        }

        try {
            setImporting(true);
            setError(null);
            
            const result = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/question-bank/import-mysql-all`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
            }).then(r => r.json());
            
            setImportResult(result);
            
            setTimeout(() => {
                onSuccess?.();
            }, 1500);
        } catch (error: any) {
            console.error('Import all failed:', error);
            setError(error.message || 'Error al importar todas las preguntas');
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
                    {/* MySQL Import */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-3">
                            <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-2">
                                    Importar desde MySQL
                                </h4>
                                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                                    <li>• Todas las preguntas del banco de diagnóstico</li>
                                    <li>• Sin duplicados automáticos</li>
                                    <li>• Mapeo automático de tipos</li>
                                </ul>
                            </div>
                        </div>
                        <button
                            onClick={handleImportAll}
                            disabled={importing}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            {importing ? 'Importando...' : 'Importar Todo desde MySQL'}
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
