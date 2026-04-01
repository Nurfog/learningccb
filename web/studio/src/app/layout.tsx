import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/AuthContext";
import { I18nProvider } from "@/context/I18nContext";
import { BookOpen } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { BrandingProvider } from "@/context/BrandingContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Studio",
  description: "Crea y gestiona contenido educativo de alta fidelidad.",
};

import { Navbar } from "@/components/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col font-sans transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <BrandingProvider>
                <AuthGuard>
                  <Navbar />
                  <main className="flex-1 mt-16 md:mt-20">{children}</main>
                </AuthGuard>
              </BrandingProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}