"use client";

import { useState, useEffect, useRef } from "react";
import { lmsApi } from "@/lib/api";
import { Send, User, Bot, Sparkles, MessageCircle, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface RolePlayingPlayerProps {
    id: string;
    lessonId: string;
    title?: string;
    scenario?: string;
    ai_persona?: string;
    user_role?: string;
    objectives?: string;
    initial_message?: string;
}

export default function RolePlayingPlayer({
    id,
    lessonId,
    title,
    scenario = "",
    ai_persona = "",
    user_role = "",
    objectives = "",
    initial_message = "Hola, ¿cómo puedo ayudarte hoy?"
}: RolePlayingPlayerProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (messages.length === 0 && initial_message) {
            setMessages([{ role: "assistant", content: initial_message }]);
        }
    }, [initial_message, messages.length]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setLoading(true);

        try {
            const res = await lmsApi.chatRolePlay(lessonId, id, userMessage, sessionId || undefined);
            setMessages(prev => [...prev, { role: "assistant", content: res.response }]);
            if (!sessionId) setSessionId(res.session_id);
        } catch (error) {
            console.error("Error in role-play chat:", error);
            setMessages(prev => [...prev, { role: "assistant", content: "Lo siento, hubo un error procesando la simulación. Por favor, intenta de nuevo." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setMessages([{ role: "assistant", content: initial_message }]);
        setSessionId(null);
    };

    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                        <MessageCircle size={18} />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {title || "Simulación de Rol"}
                    </h3>
                </div>
            </div>

            <div className="glass border-black/5 dark:border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col h-[600px] shadow-2xl bg-white/50 dark:bg-black/50 backdrop-blur-xl">
                {/* Scenario Header */}
                <div className="p-6 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
                            <Sparkles size={20} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Escenario Activo</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">{scenario}</p>
                        </div>
                    </div>
                </div>

                {/* Information Bar */}
                <div className="px-6 py-4 bg-black/5 dark:bg-white/5 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <User size={12} className="text-indigo-500" />
                        <span>Tu Rol: <span className="text-gray-900 dark:text-white">{user_role}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Bot size={12} className="text-blue-500" />
                        <span>IA: <span className="text-gray-900 dark:text-white">{ai_persona}</span></span>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-indigo-500/20">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === "user"
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                    : "bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-gray-800 dark:text-gray-200"
                                }`}>
                                <div className="text-sm prose dark:prose-invert max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start animate-pulse">
                            <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-black/5 dark:bg-white/5 border-t border-black/5 dark:border-white/5 space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Escribe tu mensaje en la simulación..."
                            className="flex-1 bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-900 dark:text-white shadow-inner"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <Send size={20} />
                        </button>
                        <button
                            onClick={handleReset}
                            title="Reiniciar Simulación"
                            className="p-4 bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-400 rounded-2xl hover:bg-black/20 dark:hover:bg-white/20 transition-all active:scale-95"
                        >
                            <RotateCcw size={20} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-gray-400">
                            <Sparkles size={10} className="text-indigo-500" />
                            <span>IA Generativa Avanzada</span>
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-gray-400 truncate max-w-[200px]">
                            Objetivo: {objectives.slice(0, 40)}{objectives.length > 40 ? "..." : ""}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
