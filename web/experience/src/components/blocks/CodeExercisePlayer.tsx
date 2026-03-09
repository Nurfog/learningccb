"use client";

import React, { useState } from "react";
import { Play, CheckCircle, XCircle, Code2, RefreshCcw, Wand2, Sparkles, Loader2 } from "lucide-react";
import { lmsApi } from "@/lib/api";

interface CodeExercisePlayerProps {
    lessonId: string;
    title: string;
    instructions: string;
    initialCode: string;
    language?: string;
    testCases?: { description: string; expected: string }[];
    expectedOutput?: string;
    onComplete: (score: number) => void;
}

export default function CodeExercisePlayer({
    lessonId,
    title,
    instructions,
    initialCode,
    language = "python",
    testCases = [],
    onComplete
}: CodeExercisePlayerProps) {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState<string | null>(null);
    const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
    const [hint, setHint] = useState<string | null>(null);
    const [isGettingHint, setIsGettingHint] = useState(false);

    const runCode = () => {
        setStatus("running");
        setOutput("Ejecutando pruebas...\n");
        setHint(null);

        setTimeout(() => {
            // Mock validation logic
            const isCorrect = code.trim() !== initialCode.trim();

            if (isCorrect) {
                setStatus("success");
                setOutput("✅ ¡Pruebas superadas!\n\nSalida:\n" + (testCases[0]?.expected || "Hello, World!"));
                onComplete(1.0);
            } else {
                setStatus("error");
                setOutput("❌ Las pruebas fallaron.\n\nError:\nAssertionError: El resultado no coincide con lo esperado.");
            }
        }, 1500);
    };

    const getAIHint = async () => {
        if (isGettingHint) return;
        setIsGettingHint(true);
        try {
            const data = await lmsApi.getCodeHint(lessonId, {
                current_code: code,
                error_message: status === "error" ? output || undefined : undefined,
                instructions,
                language
            });
            setHint(data.hint);
        } catch (error) {
            console.error("Failed to get AI hint:", error);
            setHint("Lo siento, no pude obtener una pista en este momento.");
        } finally {
            setIsGettingHint(false);
        }
    };

    const reset = () => {
        setCode(initialCode);
        setStatus("idle");
        setOutput(null);
        setHint(null);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-700">
            <div className="glass-card p-6 border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-black/20">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Code2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white uppercase">{title}</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500/60">{language}</span>
                    </div>
                </div>
                <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                    {instructions}
                </div>

                {testCases.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-black/5 dark:border-white/5">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Casos de Prueba</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {testCases.map((tc, idx) => (
                                <div key={idx} className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-gray-500">{tc.description}</span>
                                    <code className="text-[10px] text-indigo-500 font-mono">Esperado: {tc.expected}</code>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[500px]">
                {/* Editor Area */}
                <div className="flex flex-col rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 bg-[#1a1c21]">
                    <div className="px-4 py-2 bg-black/40 dark:bg-white/5 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        <span>main.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'sql' ? 'sql' : 'sh'}</span>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500/20" />
                            <div className="w-2 h-2 rounded-full bg-amber-500/20" />
                            <div className="w-2 h-2 rounded-full bg-green-500/20" />
                        </div>
                    </div>
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="flex-1 bg-transparent p-6 font-mono text-sm resize-none focus:outline-none text-indigo-100 selection:bg-indigo-500/30"
                        spellCheck={false}
                    />
                    <div className="p-4 bg-black/40 dark:bg-black/20 border-t border-black/5 dark:border-white/5 flex gap-2">
                        <button
                            onClick={runCode}
                            disabled={status === "running"}
                            className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            {status === "running" ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Play size={16} />
                            )}
                            Ejecutar Código
                        </button>
                        <button
                            onClick={getAIHint}
                            disabled={isGettingHint || status === "running"}
                            className="flex-1 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            {isGettingHint ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            Pista IA
                        </button>
                        <button
                            onClick={reset}
                            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            title="Reset"
                        >
                            <RefreshCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* Console / Results Area */}
                <div className="flex flex-col rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 bg-black/[0.05] dark:bg-black/40">
                    <div className="px-4 py-2 bg-black/10 dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Consola de Salida
                    </div>
                    <div className="flex-1 p-6 font-mono text-sm overflow-auto">
                        {!output && <span className="text-gray-500 dark:text-gray-600 italic">Haz clic en &quot;Ejecutar Código&quot; para probar tu solución...</span>}
                        {output && (
                            <pre className={`whitespace-pre-wrap ${status === "success" ? "text-green-400" :
                                status === "error" ? "text-red-400" :
                                    "text-gray-400"
                                }`}>
                                {output}
                            </pre>
                        )}

                        {hint && (
                            <div className="mt-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-1">
                                    <Sparkles size={14} className="text-indigo-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Sugerencia del Tutor IA</span>
                                </div>
                                <p className="text-sm text-indigo-200/80 leading-relaxed italic">
                                    &quot;{hint}&quot;
                                </p>
                            </div>
                        )}
                    </div>
                    {status === "success" && (
                        <div className="m-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 animate-in zoom-in duration-300">
                            <CheckCircle className="text-green-400" />
                            <div>
                                <div className="text-sm font-bold text-green-400">¡Desafío Completado!</div>
                                <p className="text-[10px] text-green-500/80 uppercase font-black tracking-widest">Puntaje: 100%</p>
                            </div>
                        </div>
                    )}
                    {status === "error" && (
                        <div className="m-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in shake duration-300">
                            <XCircle className="text-red-400" />
                            <div>
                                <div className="text-sm font-bold text-red-400">Falla en la Ejecución</div>
                                <p className="text-[10px] text-red-500/80 uppercase font-black tracking-widest">Intenta de nuevo</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
