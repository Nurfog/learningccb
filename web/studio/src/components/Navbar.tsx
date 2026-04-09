'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/I18nContext';
import { LayoutDashboard, ShieldCheck, LogOut, Settings, Globe, Library, BookOpen, Sun, Moon, ChevronDown, FileQuestion, Webhook, User, Menu, X } from 'lucide-react';
import { useBranding } from '@/context/BrandingContext';
import { useTheme } from '@/context/ThemeContext';
import { getImageUrl } from '@/lib/api';
import Image from 'next/image';

// Clase base para TODOS los links de nav
const NAV_LINK = "flex items-center gap-2 text-sm font-bold uppercase tracking-wide transition-colors text-slate-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400";

// Admin variant
const NAV_LINK_ADMIN = "flex items-center gap-2 text-sm font-bold uppercase tracking-wide transition-colors text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300";

// Dropdown menu item
const DROPDOWN_ITEM = "flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";

// Mobile sidebar link
const MOBILE_LINK = "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors text-slate-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-blue-400";
const MOBILE_LINK_ADMIN = "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10";

export function Navbar() {
    const { t, language, setLanguage } = useTranslation();
    const { user, logout } = useAuth();
    const { branding } = useBranding();
    const { theme, toggleTheme } = useTheme();
    
    const [coursesOpen, setCoursesOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const platformName = branding?.platform_name || branding?.name || 'Studio';

    return (
        <>
        <nav className="fixed top-0 w-full z-50 glass border-b border-black/5 dark:border-white/10 bg-gray-50/70 dark:bg-black/40 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 md:gap-4 group" aria-label={`${platformName} Studio - Dashboard`}>
                    <div className={`rounded-lg md:rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all overflow-hidden relative border border-white/5 ${branding?.logo_variant === 'wide' ? 'w-32 h-8 md:w-48 md:h-10 px-2 bg-white' : 'w-8 h-8 md:w-10 md:h-10'}`}>
                        {branding?.logo_url ? (
                            <Image src={getImageUrl(branding.logo_url)} alt="" fill className={`object-contain ${branding?.logo_variant === 'wide' ? 'p-1' : ''}`} sizes={branding?.logo_variant === 'wide' ? '200px' : '40px'} />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700" aria-hidden="true">
                                <BookOpen size={branding?.logo_variant === 'wide' ? 16 : 20} />
                            </div>
                        )}
                    </div>
                    {branding?.logo_variant !== 'wide' && (
                        <div className="flex flex-col -gap-1">
                            <span className="font-black text-sm md:text-lg tracking-tighter text-gray-900 dark:text-white leading-none">
                                {platformName.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-500 uppercase">STUDIO</span>
                        </div>
                    )}
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6">
                    <div className="flex items-center gap-5">

                        {/* Cursos Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setCoursesOpen(!coursesOpen)}
                                className={`${NAV_LINK} cursor-pointer`}
                            >
                                <BookOpen className="w-4 h-4 shrink-0" />
                                Cursos
                                <ChevronDown className={`w-3 h-3 transition-transform ${coursesOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {coursesOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-10" 
                                        onClick={() => setCoursesOpen(false)}
                                    />
                                    <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                                        <Link 
                                            href="/" 
                                            className={DROPDOWN_ITEM}
                                            onClick={() => setCoursesOpen(false)}
                                        >
                                            <LayoutDashboard className="w-4 h-4" />
                                            Listar Cursos
                                        </Link>
                                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                                        <Link 
                                            href="/library/assets" 
                                            className={DROPDOWN_ITEM}
                                            onClick={() => setCoursesOpen(false)}
                                        >
                                            <Library className="w-4 h-4" />
                                            Librería
                                        </Link>
                                        <Link 
                                            href="/question-bank" 
                                            className={DROPDOWN_ITEM}
                                            onClick={() => setCoursesOpen(false)}
                                        >
                                            <FileQuestion className="w-4 h-4" />
                                            Banco de Preguntas
                                        </Link>
                                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                                        <Link 
                                            href="/test-templates" 
                                            className={DROPDOWN_ITEM}
                                            onClick={() => setCoursesOpen(false)}
                                        >
                                            <FileQuestion className="w-4 h-4" />
                                            Plantillas de Pruebas
                                        </Link>
                                        <Link
                                            href="/course-templates"
                                            className={DROPDOWN_ITEM}
                                            onClick={() => setCoursesOpen(false)}
                                        >
                                            <BookOpen className="w-4 h-4" />
                                            Plantillas de Curso
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>

                        {user?.role === 'admin' && (
                            <>
                                {user.organization_id === '00000000-0000-0000-0000-000000000001' && (
                                    <Link href="/admin" className={NAV_LINK_ADMIN}>
                                        <ShieldCheck className="w-4 h-4 shrink-0" />
                                        Control Global
                                    </Link>
                                )}
                                
                                {/* Configuración Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setSettingsOpen(!settingsOpen)}
                                        className={`${NAV_LINK} cursor-pointer`}
                                    >
                                        <Settings className="w-4 h-4 shrink-0" />
                                        Configuración
                                        <ChevronDown className={`w-3 h-3 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {settingsOpen && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-10" 
                                                onClick={() => setSettingsOpen(false)}
                                            />
                                            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                                                <Link 
                                                    href="/settings/webhooks" 
                                                    className={DROPDOWN_ITEM}
                                                    onClick={() => setSettingsOpen(false)}
                                                >
                                                    <Webhook className="w-4 h-4" />
                                                    Webhooks
                                                </Link>
                                                <Link 
                                                    href="/profile" 
                                                    className={DROPDOWN_ITEM}
                                                    onClick={() => setSettingsOpen(false)}
                                                >
                                                    <User className="w-4 h-4" />
                                                    Perfil
                                                </Link>
                                                <Link 
                                                    href="/settings" 
                                                    className={DROPDOWN_ITEM}
                                                    onClick={() => setSettingsOpen(false)}
                                                >
                                                    <Settings className="w-4 h-4" />
                                                    General
                                                </Link>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {user?.role !== 'admin' && (
                            <Link href="/settings" className={NAV_LINK}>
                                <Settings className="w-4 h-4 shrink-0" />
                                Configuración
                            </Link>
                        )}
                    </div>

                    <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1" />

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-all"
                        title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                        aria-label={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    {/* Language */}
                    <div className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-gray-500" aria-hidden="true" />
                        <select
                            id="studio-language-selector"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            aria-label={t('nav.selectLanguage') || 'Select Language'}
                            className="bg-transparent text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none cursor-pointer"
                        >
                            <option value="en" className="bg-white dark:bg-gray-900">EN</option>
                            <option value="es" className="bg-white dark:bg-gray-900">ES</option>
                            <option value="pt" className="bg-white dark:bg-gray-900">PT</option>
                        </select>
                    </div>

                    <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1" />

                    {/* User info */}
                    {user ? (
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user.full_name}</span>
                                <span className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-widest font-bold">{user.role}</span>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all text-gray-400"
                                title={t('nav.signOut') || "Sign Out"}
                                aria-label={t('nav.signOut') || "Sign Out"}
                            >
                                <LogOut className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                    ) : (
                        <Link href="/auth/login" className="text-sm font-bold text-blue-600 hover:text-blue-500 transition-colors">
                            Sign In
                        </Link>
                    )}
                </div>

                {/* Mobile: Hamburger button */}
                <button
                    onClick={() => setMobileOpen(true)}
                    className="md:hidden p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-gray-400 transition-colors"
                    aria-label="Abrir menú"
                    aria-expanded={mobileOpen}
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            </nav>

                {/* Mobile Sidebar Overlay — fuera del <nav> para evitar que el
                    backdrop-filter cree un stacking context que confine el fixed */}
                {mobileOpen && (
                <div
                    className="fixed inset-0 z-[150] md:hidden bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setMobileOpen(false)}
                >
                    <div
                        className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-white/10 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menú de navegación"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
                            <span className="font-black text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Menú</span>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors"
                                aria-label="Cerrar menú"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Nav links */}
                        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                            <p className="px-4 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 dark:text-gray-600">Cursos</p>
                            <Link href="/" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                <LayoutDashboard className="w-4 h-4 shrink-0" /> Listar Cursos
                            </Link>
                            <Link href="/library/assets" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                <Library className="w-4 h-4 shrink-0" /> Librería
                            </Link>
                            <Link href="/question-bank" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                <FileQuestion className="w-4 h-4 shrink-0" /> Banco de Preguntas
                            </Link>
                            <Link href="/test-templates" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                <FileQuestion className="w-4 h-4 shrink-0" /> Plantillas de Pruebas
                            </Link>
                            <Link href="/course-templates" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                <BookOpen className="w-4 h-4 shrink-0" /> Plantillas de Curso
                            </Link>

                            {user?.role === 'admin' && (
                                <>
                                    <div className="my-2 border-t border-gray-100 dark:border-white/10" />
                                    <p className="px-4 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 dark:text-gray-600">Administración</p>
                                    {user.organization_id === '00000000-0000-0000-0000-000000000001' && (
                                        <Link href="/admin" className={MOBILE_LINK_ADMIN} onClick={() => setMobileOpen(false)}>
                                            <ShieldCheck className="w-4 h-4 shrink-0" /> Control Global
                                        </Link>
                                    )}
                                    <Link href="/settings/webhooks" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                        <Webhook className="w-4 h-4 shrink-0" /> Webhooks
                                    </Link>
                                    <Link href="/settings" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                        <Settings className="w-4 h-4 shrink-0" /> Configuración
                                    </Link>
                                </>
                            )}
                            {user?.role !== 'admin' && (
                                <>
                                    <div className="my-2 border-t border-gray-100 dark:border-white/10" />
                                    <Link href="/settings" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                        <Settings className="w-4 h-4 shrink-0" /> Configuración
                                    </Link>
                                </>
                            )}
                            <Link href="/profile" className={MOBILE_LINK} onClick={() => setMobileOpen(false)}>
                                <User className="w-4 h-4 shrink-0" /> Perfil
                            </Link>
                        </nav>

                        {/* Footer */}
                        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/10 space-y-3">
                            {user && (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user.full_name}</p>
                                        <p className="text-xs uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">{user.role}</p>
                                    </div>
                                    <button
                                        onClick={() => { logout(); setMobileOpen(false); }}
                                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
                                        aria-label={t('nav.signOut') || 'Cerrar sesión'}
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={toggleTheme}
                                    className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                    {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                                </button>
                                <div className="flex items-center gap-1.5 text-gray-500">
                                    <Globe className="w-3.5 h-3.5" />
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        aria-label="Idioma"
                                        className="bg-transparent text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer"
                                    >
                                        <option value="en" className="bg-white dark:bg-gray-900">EN</option>
                                        <option value="es" className="bg-white dark:bg-gray-900">ES</option>
                                        <option value="pt" className="bg-white dark:bg-gray-900">PT</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </>
        );
}
