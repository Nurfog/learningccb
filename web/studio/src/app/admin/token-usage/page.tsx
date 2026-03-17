'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, Users, AlertTriangle, DollarSign, Activity } from 'lucide-react';

interface TokenUsage {
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    ai_requests: number;
    last_used: string;
    estimated_cost_usd: number;
}

interface TokenStats {
    total_tokens: number;
    total_input: number;
    total_output: number;
    total_requests: number;
    total_cost_usd: number;
    top_user_tokens: number;
    avg_tokens_per_user: number;
}

export default function AdminTokenTracking() {
    const [usage, setUsage] = useState<TokenUsage[]>([]);
    const [stats, setStats] = useState<TokenStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterRole, setFilterRole] = useState<string>('');
    const [sortBy, setSortBy] = useState<'total_tokens' | 'ai_requests' | 'estimated_cost_usd'>('total_tokens');

    useEffect(() => {
        loadTokenUsage();
    }, []);

    const loadTokenUsage = async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/admin/token-usage`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUsage(data.usage || []);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load token usage:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsage = usage
        .filter(u => !filterRole || u.role === filterRole)
        .sort((a, b) => b[sortBy] - a[sortBy]);

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en-US').format(num);
    };

    const formatCurrency = (num: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-8 h-8 text-indigo-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Control Global - Token Usage
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Monitoreo de tokens de IA y costos del sistema
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {stats && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {formatNumber(stats.total_tokens)}
                                        </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-blue-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Input: {formatNumber(stats.total_input)} | Output: {formatNumber(stats.total_output)}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Requests IA</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {formatNumber(stats.total_requests)}
                                        </p>
                                    </div>
                                    <Activity className="w-8 h-8 text-green-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Avg: {formatNumber(stats.avg_tokens_per_user)} tokens/user
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Costo Estimado</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(stats.total_cost_usd)}
                                        </p>
                                    </div>
                                    <DollarSign className="w-8 h-8 text-green-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Top user: {formatNumber(stats.top_user_tokens)} tokens
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Usuarios Activos</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {usage.length}
                                        </p>
                                    </div>
                                    <Users className="w-8 h-8 text-purple-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Monitoreando uso de IA
                                </div>
                            </div>
                        </div>

                        {/* Alerts */}
                        {usage.some(u => u.total_tokens > 1000000) && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 text-sm">
                                        Usuarios con alto consumo detectado
                                    </h4>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                        {usage.filter(u => u.total_tokens > 1000000).length} usuario(s) han superado 1M de tokens.
                                        Considere implementar límites de uso.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Filters */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
                            <div className="flex items-center gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        Filtrar por Rol
                                    </label>
                                    <select
                                        value={filterRole}
                                        onChange={(e) => setFilterRole(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">Todos</option>
                                        <option value="student">Estudiantes</option>
                                        <option value="instructor">Instructores</option>
                                        <option value="admin">Admins</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        Ordenar por
                                    </label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="total_tokens">Total Tokens</option>
                                        <option value="ai_requests">Requests IA</option>
                                        <option value="estimated_cost_usd">Costo USD</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Usage Table */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    Uso por Usuario
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Usuario
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Rol
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Input Tokens
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Output Tokens
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Total Tokens
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Requests
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Costo USD
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Última Actividad
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {filteredUsage.map((user) => (
                                            <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {user.full_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                                                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                        user.role === 'instructor' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                                                    {formatNumber(user.input_tokens)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                                                    {formatNumber(user.output_tokens)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <span className={`text-sm font-medium ${
                                                        user.total_tokens > 1000000 ? 'text-red-600' :
                                                        user.total_tokens > 500000 ? 'text-yellow-600' :
                                                        'text-gray-900 dark:text-white'
                                                    }`}>
                                                        {formatNumber(user.total_tokens)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                                                    {formatNumber(user.ai_requests)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                                                    {formatCurrency(user.estimated_cost_usd)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(user.last_used).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando estadísticas de tokens...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
