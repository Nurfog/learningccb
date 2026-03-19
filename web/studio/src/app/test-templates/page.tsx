'use client';

import React from 'react';
import PageLayout from '@/components/PageLayout';
import { AlertTriangle } from 'lucide-react';

export default function TestTemplatesPage() {
    return (
        <PageLayout title="Plantillas de Pruebas">
            <div className="flex flex-col items-center justify-center p-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-600" />
                        <h2 className="text-xl font-semibold text-yellow-800">
                            Funcionalidad Temporalmente Desactivada
                        </h2>
                    </div>
                    <p className="text-yellow-700 mb-4">
                        Las plantillas de pruebas están temporalmente desactivadas mientras se realizan mejoras en el sistema.
                    </p>
                    <p className="text-yellow-600 text-sm">
                        Esta funcionalidad estará disponible próximamente.
                    </p>
                </div>
            </div>
        </PageLayout>
    );
}
