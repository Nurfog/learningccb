# CMS API routes - redirect POST /auth/login to CMS

location = /auth/login {
    # POST requests go to CMS API (port 3001)
    if ($cms_login) {
        proxy_pass http://172.18.0.6:3001;
    }
    # GET requests stay on frontend (port 3000)
    proxy_pass http://172.18.0.6:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $origin_proto;
    proxy_set_header X-Forwarded-Ssl on;
}
