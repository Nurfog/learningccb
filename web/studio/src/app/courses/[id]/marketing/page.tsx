"use client";

import CourseEditorLayout from "@/components/CourseEditorLayout";
import MarketingTab from "./MarketingTab";

export default function MarketingPage({ params }: { params: { id: string } }) {
    return (
        <CourseEditorLayout
            activeTab="marketing"
            pageTitle="Marketing del Curso"
            pageDescription="Configura la landing page y genera activos visuales con IA."
        >
            <MarketingTab courseId={params.id} />
        </CourseEditorLayout>
    );
}
