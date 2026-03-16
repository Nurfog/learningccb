'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { TestTemplateManager, TestTemplateForm } from '@/components/TestTemplates';
import { Plus } from 'lucide-react';

export default function TestTemplatesPage() {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleSuccess = () => {
        setShowCreateForm(false);
        setRefreshKey(prev => prev + 1);
    };

    return (
        <PageLayout title="Plantillas de Pruebas">
            <div key={refreshKey}>
                <TestTemplateManager
                    onSelectTemplate={() => setShowCreateForm(true)}
                    onCreateTemplate={() => setShowCreateForm(true)}
                />
            </div>

            {showCreateForm && (
                <TestTemplateForm
                    onSuccess={handleSuccess}
                    onCancel={() => setShowCreateForm(false)}
                />
            )}
        </PageLayout>
    );
}
