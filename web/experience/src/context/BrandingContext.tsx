'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { lmsApi, Organization, getImageUrl } from '@/lib/api';
import { usePathname } from 'next/navigation';

interface BrandingContextType {
    branding: Organization | null;
    loading: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
    branding: null,
    loading: true,
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [branding, setBranding] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);



    const pathname = usePathname();

    useEffect(() => {
        const loadBranding = async () => {
            try {
                const data = await lmsApi.getBranding();
                setBranding(data);
                console.log('Branding loaded in Experience:', data);
            } catch (error) {
                console.error('Failed to load branding', error);
            } finally {
                setLoading(false);
            }
        };

        loadBranding();
    }, []);

    useEffect(() => {
        if (!branding) return;
        console.log('Applying branding in Experience for path:', pathname);

        // Apply CSS variables
        if (branding.primary_color) {
            document.documentElement.style.setProperty('--primary-color', branding.primary_color);
        }
        if (branding.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', branding.secondary_color);
        }

        // Update Title
        if (branding.platform_name) {
            document.title = `${branding.platform_name} | Experiencia de Aprendizaje`;
        }

        // Update Favicon
        if (branding.favicon_url) {
            const faviconUrl = getImageUrl(branding.favicon_url);
            const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
            if (link) {
                link.href = faviconUrl;
            } else {
                const newLink = document.createElement("link");
                newLink.rel = "shortcut icon";
                newLink.href = faviconUrl;
                document.head.appendChild(newLink);
            }
        }
    }, [branding, pathname]);

    return (
        <BrandingContext.Provider value={{ branding, loading }}>
            {children}
        </BrandingContext.Provider>
    );
};
