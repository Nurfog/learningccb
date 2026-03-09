"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { cmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import { BookOpen, Lock, Mail, User } from "lucide-react";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function StudioLoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { branding } = useBranding();

    const platformName = branding?.platform_name || branding?.name || 'Academia';
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [ssoMode, setSSOMode] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isLogin) {
                const response = await cmsApi.login({ email, password });

                // Verify user is instructor or admin
                if (response.user.role !== "instructor" && response.user.role !== "admin") {
                    setError("Access denied. This portal is for instructors and administrators only.");
                    setLoading(false);
                    return;
                }

                login(response.user, response.token);
                router.push("/");
            } else {
                const response = await cmsApi.register({
                    email,
                    password,
                    full_name: fullName,
                    role: "instructor",
                    organization_name: organizationName,
                });

                login(response.user, response.token);
                router.push("/");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-gray-950 dark:via-blue-950 dark:to-gray-950 flex items-center justify-center p-4 transition-colors">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
                        <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">{platformName} Studio</h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Instructor & Administrator Portal</p>
                </div>

                {/* Login/Register Form */}
                <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-3xl p-8 transition-colors">
                    <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-white/5 rounded-xl p-1 transition-colors">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${isLogin ? "bg-blue-600 text-white shadow" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                }`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${!isLogin ? "bg-blue-600 text-white shadow" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                }`}
                        >
                            Register
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!ssoMode ? (
                            <>
                                {!isLogin && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                Full Name
                                            </label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                                <input
                                                    type="text"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-11 pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                                    placeholder="John Doe"
                                                    autoComplete="name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                Organization Name (Optional)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={organizationName}
                                                    onChange={(e) => setOrganizationName(e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 px-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                                    placeholder="Tu Escuela o Empresa"
                                                    autoComplete="organization"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-1">
                                                If left blank, an organization will be created based on your email domain.
                                            </p>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-11 pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            placeholder="instructor@example.com"
                                            autoComplete="email"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-11 pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            placeholder="••••••••"
                                            autoComplete="current-password"
                                            required
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="z-50 relative py-8 text-center">
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Continue to sign in via your enterprise Single Sign-On provider.
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3 text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            onClick={(e) => {
                                if (ssoMode) {
                                    e.preventDefault();
                                    cmsApi.initSSOLogin(DEFAULT_ORG_ID);
                                }
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            {loading ? "Processing..." : ssoMode ? "Continue with SSO" : isLogin ? "Sign In" : "Create Account"}
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-200 dark:border-white/10 transition-colors"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-[#020617] px-2 text-gray-500 dark:text-gray-400 transition-colors">Or</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setSSOMode(!ssoMode);
                                setError("");
                            }}
                            className="w-full bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white font-bold py-3 rounded-xl border border-gray-200 dark:border-white/10 transition-colors"
                        >
                            {ssoMode ? "Use Email & Password" : "Login with Enterprise SSO"}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10 text-center transition-colors">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Are you a student?{" "}
                            <a href="http://192.168.0.254:3003/auth/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold transition-colors">
                                Go to Student Portal
                            </a>
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-500 dark:text-gray-500 mt-6">
                    {platformName} Studio - Portal de Instructores y Administradores
                </p>
            </div>
        </div>
    );
}
