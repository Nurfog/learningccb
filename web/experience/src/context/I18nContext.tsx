"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../lib/locales/en.json';
import es from '../lib/locales/es.json';
import pt from '../lib/locales/pt.json';

const translations: Record<string, any> = { en, es, pt };

// Idiomas soportados
export const SUPPORTED_LANGUAGES = ['es', 'en', 'pt'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

interface I18nContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (path: string) => string;
    detectBrowserLanguage: () => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Detecta el idioma del navegador del usuario
 */
function detectBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'es';
    
    // Obtener idiomas del navegador (puede ser un array)
    const browserLanguages = navigator.languages || [navigator.language || (navigator as any).userLanguage];
    
    // Buscar el primer idioma soportado
    for (const browserLang of browserLanguages) {
        // Idioma completo (ej: 'en-US')
        if (SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage)) {
            return browserLang;
        }
        
        // Solo código de idioma (ej: 'en' de 'en-US')
        const langCode = browserLang.split('-')[0].toLowerCase();
        if (SUPPORTED_LANGUAGES.includes(langCode as SupportedLanguage)) {
            return langCode;
        }
    }
    
    // Fallback a español
    return 'es';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState('es');
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // 1. Primero intentar cargar de localStorage
        const savedLang = localStorage.getItem('experience_language');
        
        if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang as SupportedLanguage)) {
            setLanguageState(savedLang);
        } else {
            // 2. Si no hay guardado, detectar del navegador
            const detectedLang = detectBrowserLanguage();
            setLanguageState(detectedLang);
            localStorage.setItem('experience_language', detectedLang);
        }
        
        setIsInitialized(true);
    }, []);

    const setLanguage = (lang: string) => {
        if (SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
            setLanguageState(lang);
            localStorage.setItem('experience_language', lang);
        }
    };

    const t = (path: string): string => {
        const keys = path.split('.');
        let result = translations[language] || translations['es'];

        for (const key of keys) {
            if (result[key]) {
                result = result[key];
            } else {
                return path;
            }
        }

        return typeof result === 'string' ? result : path;
    };

    return (
        <I18nContext.Provider value={{ language, setLanguage, t, detectBrowserLanguage }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
}

export { detectBrowserLanguage };
