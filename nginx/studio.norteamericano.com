# CMS API routes - ONLY POST /auth/login
# All other routes handled by Next.js rewrites

# Auth login - POST goes to CMS API, GET stays on frontend
location = /auth/login {
    proxy_pass http://172.18.0.6:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}
