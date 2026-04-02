'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import TestTemplateManager from '@/components/TestTemplates/TestTemplateManager';
import TestTemplateForm from '@/components/TestTemplates/TestTemplateForm';

export default function TestTemplatesPage() {
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

    return (
        <PageLayout title="Plantillas de Pruebas">
            {view === 'list' ? (
                <TestTemplateManager
                    onCreateTemplate={() => {
                        setEditingTemplateId(null);
                        setView('create');
                    }}
                    onEditTemplate={(template) => {
                        setEditingTemplateId(template.id);
                        setView('edit');
                    }}
                />
            ) : (
                <TestTemplateForm
                    templateId={view === 'edit' ? editingTemplateId || undefined : undefined}
                    onSuccess={() => {
                        setEditingTemplateId(null);
                        setView('list');
                    }}
                    onCancel={() => {
                        setEditingTemplateId(null);
                        setView('list');
                    }}
                />
            )}
        </PageLayout>
    );
}
