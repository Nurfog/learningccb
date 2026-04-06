'use client';

import React, { useMemo, useState } from 'react';
import { cmsApi, questionBankApi, MySqlPlan, MySqlCourse } from '@/lib/api';
import { Upload, Database, FileArchive, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function AdminSharedMaterialsPage() {
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [ingestRag, setIngestRag] = useState(true);
    const [englishLevel, setEnglishLevel] = useState('');
    const [plans, setPlans] = useState<MySqlPlan[]>([]);
    const [courses, setCourses] = useState<MySqlCourse[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
    const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        imported_assets: number;
        rag_ingested_assets: number;
        rag_chunks_ingested: number;
        failed_entries: string[];
    } | null>(null);

    const canUpload = useMemo(() => Boolean(zipFile) && !loading, [zipFile, loading]);

    React.useEffect(() => {
        questionBankApi.getMySQLPlans().then(setPlans).catch(() => setPlans([]));
    }, []);

    React.useEffect(() => {
        if (!selectedPlanId) {
            setCourses([]);
            setSelectedCourseId('');
            return;
        }
        questionBankApi.getMySQLCoursesByPlan(selectedPlanId).then(setCourses).catch(() => setCourses([]));
    }, [selectedPlanId]);

    const handleUpload = async () => {
        if (!zipFile) {
            alert('Selecciona un archivo ZIP primero.');
            return;
        }

        try {
            setLoading(true);
            setResult(null);
            const response = await cmsApi.importAssetsZip(
                zipFile,
                ingestRag,
                undefined,
                englishLevel || undefined,
                selectedPlanId || undefined,
                selectedCourseId || undefined,
            );
            setResult(response);
            alert('Importacion ZIP finalizada.');
        } catch (error) {
            console.error('ZIP import failed:', error);
            const msg = error instanceof Error ? error.message : 'Error al importar ZIP';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Material Compartido y RAG</h1>
                <p className="text-slate-600 dark:text-gray-400 mt-2">
                    Sube ZIPs desde Admin para dejar contenido global disponible en todas las plantillas y cursos.
                </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <FileArchive className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white">Importar ZIP de Materiales</h2>
                        <p className="text-xs text-slate-500 dark:text-gray-500">Se cargan a biblioteca compartida (sin curso especifico).</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Archivo ZIP</label>
                    <input
                        type="file"
                        accept=".zip,application/zip"
                        onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-700 dark:text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-indigo-500"
                    />
                    {zipFile && (
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                            Seleccionado: {zipFile.name}
                        </p>
                    )}
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <input
                        type="checkbox"
                        checked={ingestRag}
                        onChange={(e) => setIngestRag(e.target.checked)}
                    />
                    <span className="font-medium">Ingerir automaticamente en RAG al importar</span>
                </label>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Plan de Estudios (SAM)</label>
                    <select
                        value={selectedPlanId}
                        onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : '';
                            setSelectedPlanId(value);
                            setSelectedCourseId('');
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                        <option value="">Seleccionar plan</option>
                        {plans.map((p) => (
                            <option key={p.idPlanDeEstudios} value={p.idPlanDeEstudios}>{p.NombrePlan}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Curso (SAM)</label>
                    <select
                        value={selectedCourseId}
                        onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : '';
                            setSelectedCourseId(value);
                            const selected = courses.find((c) => c.idCursos === value);
                            if (selected?.NivelCurso !== undefined && selected?.NivelCurso !== null) {
                                const n = selected.NivelCurso;
                                if (n <= 2) setEnglishLevel('beginner_1');
                                else if (n <= 4) setEnglishLevel('beginner_2');
                                else if (n <= 6) setEnglishLevel('intermediate_1');
                                else if (n <= 8) setEnglishLevel('intermediate_2');
                                else if (n <= 10) setEnglishLevel('advanced_1');
                                else setEnglishLevel('advanced_2');
                            }
                        }}
                        disabled={!selectedPlanId}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                    >
                        <option value="">Seleccionar curso</option>
                        {courses.map((c) => (
                            <option key={c.idCursos} value={c.idCursos}>{c.NombreCurso}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Nivel de Ingles para este ZIP</label>
                    <select
                        value={englishLevel}
                        onChange={(e) => setEnglishLevel(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                        <option value="">Sin nivel (general)</option>
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

                <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!canUpload}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" />
                    {loading ? 'Importando...' : 'Importar ZIP Compartido'}
                </button>
            </div>

            {result && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Resultado de la Importacion</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                                <Database className="w-4 h-4" />
                                <span className="text-sm font-medium">Assets importados</span>
                            </div>
                            <p className="text-2xl font-black mt-2">{result.imported_assets}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Assets ingeridos RAG</span>
                            </div>
                            <p className="text-2xl font-black mt-2">{result.rag_ingested_assets}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Chunks RAG</span>
                            </div>
                            <p className="text-2xl font-black mt-2">{result.rag_chunks_ingested}</p>
                        </div>
                    </div>

                    {result.failed_entries.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 text-amber-800 mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm font-semibold">Entradas con error</span>
                            </div>
                            <ul className="text-xs text-amber-900 space-y-1 max-h-40 overflow-y-auto">
                                {result.failed_entries.map((entry, idx) => (
                                    <li key={`${entry}-${idx}`}>- {entry}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}