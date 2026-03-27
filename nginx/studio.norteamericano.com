# CMS API routes - redirect to CMS service (port 3001)
# Frontend pages stay on port 3000

# Auth login - POST goes to CMS, GET stays on frontend
location = /auth/login {
    proxy_pass http://172.18.0.6:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# All other auth API endpoints
location ^~ /auth/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Branding API
location = /branding {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Courses API
location = /courses {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Admin API
location = /admin {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Organization API
location = /organization {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Assets
location ^~ /assets/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Health check
location = /health {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Users API
location ^~ /users/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Question bank
location ^~ /question-bank/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Test templates
location ^~ /test-templates/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Knowledge base
location ^~ /knowledge-base/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# API routes
location ^~ /api/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Modules
location ^~ /modules/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Lessons
location ^~ /lessons/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Grading
location ^~ /grading/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Token usage
location ^~ /token-usage/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# SAM
location ^~ /sam/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}

# Embeddings
location ^~ /embeddings/ {
    proxy_pass http://172.18.0.6:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}
