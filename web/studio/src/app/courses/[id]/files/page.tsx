"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import { cmsApi, Asset, getImageUrl } from "@/lib/api";
import { Upload, Trash2, Copy, FileText, Image as ImageIcon, Film, File as FileIcon } from "lucide-react";

export default function CourseFilesPage() {
    const { id } = useParams() as { id: string };
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const loadAssets = useCallback(async () => {
        try {
            const data = await cmsApi.getCourseAssets(id);
            setAssets(data);
        } catch (error) {
            console.error("Failed to load assets:", error);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            await cmsApi.uploadAsset(file, (pct) => setUploadProgress(pct), id);
            await loadAssets(); // Refresh list
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload file");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (assetId: string) => {
        if (!confirm("Are you sure you want to delete this file? This cannot be undone.")) return;
        try {
            await cmsApi.deleteAsset(assetId);
            setAssets(assets.filter(a => a.id !== assetId));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete file");
        }
    };

    const copyToClipboard = (url: string) => {
        // Copy the relative path (e.g. /assets/uuid.ext) for use in lessons
        navigator.clipboard.writeText(url);
        alert(`Copied URL: ${url}`);
    };

    const getIcon = (mimetype: string) => {
        if (mimetype.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-400" />;
        if (mimetype.startsWith('video/')) return <Film className="w-8 h-8 text-purple-400" />;
        if (mimetype.includes('pdf')) return <FileText className="w-8 h-8 text-red-400" />;
        return <FileIcon className="w-8 h-8 text-gray-400" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <CourseEditorLayout
            activeTab="files"
            pageTitle="Archivos y Recursos"
            pageDescription="Gestiona los archivos específicos de este curso. Estos se incluirán en las exportaciones."
            pageActions={
                <div className="relative">
                    <input
                        type="file"
                        onChange={handleUpload}
                        className="hidden"
                        id="file-upload"
                        disabled={isUploading}
                    />
                    <label
                        htmlFor="file-upload"
                        className={`flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all cursor-pointer active:scale-95 ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {!isUploading && <Upload className="w-4 h-4" />}
                        {isUploading ? `UPLOADING ${uploadProgress}%` : 'SUBIR ARCHIVO'}
                    </label>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5">
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Asset Name</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">MIME Type</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Size</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Uploaded</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400 dark:text-gray-500 font-bold italic animate-pulse">Scanning server for assets...</td></tr>
                            ) : assets.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-24 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-300 dark:text-gray-600">
                                            <div className="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-100 dark:border-white/5 flex items-center justify-center">
                                                <FileIcon className="w-10 h-10 opacity-20" />
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-widest">No assets found for this course</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                assets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                    {getIcon(asset.mimetype)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">{asset.filename}</div>
                                                    <div className="text-[11px] text-blue-500/60 font-mono mt-1 break-all max-w-sm">{getImageUrl(asset.storage_path.replace('uploads/', '/assets/'))}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-slate-400 dark:text-gray-500 font-mono text-xs uppercase font-bold">{asset.mimetype}</td>
                                        <td className="p-6 text-slate-900 dark:text-white font-black text-sm uppercase tracking-tighter">{formatSize(asset.size_bytes)}</td>
                                        <td className="p-6 text-slate-400 dark:text-gray-500 text-xs font-bold">{new Date(asset.created_at).toLocaleDateString()}</td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => copyToClipboard(asset.storage_path.replace('uploads/', '/assets/'))}
                                                    title="Copy Internal URL"
                                                    className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-blue-600 hover:text-white rounded-xl transition-all text-blue-500 shadow-sm active:scale-90"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(asset.id)}
                                                    title="Delete File"
                                                    className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-red-600 hover:text-white rounded-xl transition-all text-red-500 shadow-sm active:scale-90"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </CourseEditorLayout>
    );
}
