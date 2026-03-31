'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import TestTemplateManager from '@/components/TestTemplates/TestTemplateManager';
import TestTemplateForm from '@/components/TestTemplates/TestTemplateForm';

export default function TestTemplatesPage() {
    const [view, setView] = useState<'list' | 'create'>('list');

    return (
        <PageLayout title="Plantillas de Pruebas">
            {view === 'list' ? (
                <TestTemplateManager
                    onCreateTemplate={() => setView('create')}
                />
            ) : (
                <TestTemplateForm
                    onSuccess={() => setView('list')}
                    onCancel={() => setView('list')}
                />
            )}
        </PageLayout>
    );
}
