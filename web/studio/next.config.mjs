/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    optimizeFonts: false,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3001',
                pathname: '/assets/**',
            },
            {
                protocol: 'https',
                hostname: 'studio.norteamericano.com',
                pathname: '/assets/**',
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/assets/:path*',
                destination: 'http://localhost:3001/assets/:path*',
            },
            // Proxy API routes to CMS service
            {
                source: '/auth/:path*',
                destination: 'http://localhost:3001/auth/:path*',
            },
            {
                source: '/courses/:path*',
                destination: 'http://localhost:3001/courses/:path*',
            },
            {
                source: '/modules/:path*',
                destination: 'http://localhost:3001/modules/:path*',
            },
            {
                source: '/lessons/:path*',
                destination: 'http://localhost:3001/lessons/:path*',
            },
            {
                source: '/organization/:path*',
                destination: 'http://localhost:3001/organization/:path*',
            },
            {
                source: '/branding/:path*',
                destination: 'http://localhost:3001/branding/:path*',
            },
            {
                source: '/users/:path*',
                destination: 'http://localhost:3001/users/:path*',
            },
            {
                source: '/admin/:path*',
                destination: 'http://localhost:3001/admin/:path*',
            },
            {
                source: '/question-bank/:path*',
                destination: 'http://localhost:3001/question-bank/:path*',
            },
            {
                source: '/test-templates/:path*',
                destination: 'http://localhost:3001/test-templates/:path*',
            },
            {
                source: '/knowledge-base/:path*',
                destination: 'http://localhost:3001/knowledge-base/:path*',
            },
            {
                source: '/api/:path*',
                destination: 'http://localhost:3001/api/:path*',
            },
            {
                source: '/webhooks/:path*',
                destination: 'http://localhost:3001/webhooks/:path*',
            },
            {
                source: '/grading/:path*',
                destination: 'http://localhost:3001/grading/:path*',
            },
            {
                source: '/libraries/:path*',
                destination: 'http://localhost:3001/libraries/:path*',
            },
            {
                source: '/rubrics/:path*',
                destination: 'http://localhost:3001/rubrics/:path*',
            },
            {
                source: '/learning-sequences/:path*',
                destination: 'http://localhost:3001/learning-sequences/:path*',
            },
            {
                source: '/audit-logs/:path*',
                destination: 'http://localhost:3001/audit-logs/:path*',
            },
            {
                source: '/analytics/:path*',
                destination: 'http://localhost:3001/analytics/:path*',
            },
            {
                source: '/cohorts/:path*',
                destination: 'http://localhost:3001/cohorts/:path*',
            },
            {
                source: '/announcements/:path*',
                destination: 'http://localhost:3001/announcements/:path*',
            },
            {
                source: '/submissions/:path*',
                destination: 'http://localhost:3001/submissions/:path*',
            },
            {
                source: '/peer-reviews/:path*',
                destination: 'http://localhost:3001/peer-reviews/:path*',
            },
            {
                source: '/instructors/:path*',
                destination: 'http://localhost:3001/instructors/:path*',
            },
            {
                source: '/token-usage/:path*',
                destination: 'http://localhost:3001/token-usage/:path*',
            },
            {
                source: '/sam/:path*',
                destination: 'http://localhost:3001/sam/:path*',
            },
            {
                source: '/embeddings/:path*',
                destination: 'http://localhost:3001/embeddings/:path*',
            },
            {
                source: '/health',
                destination: 'http://localhost:3001/health',
            },
        ];
    },
};

export default nextConfig;
