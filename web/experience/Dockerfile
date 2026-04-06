# syntax=docker/dockerfile:1.7

# Build stage for Rust LMS
FROM rust:1-bookworm AS rust-builder
WORKDIR /usr/src/app

# Install system dependencies first
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy entire project for building (simpler and more reliable)
COPY Cargo.toml Cargo.lock ./
COPY shared/ ./shared/
COPY services/ ./services/

# Build the LMS service
RUN --mount=type=cache,target=/usr/local/cargo/registry \
	--mount=type=cache,target=/usr/local/cargo/git \
	--mount=type=cache,target=/tmp/cargo-target \
	CARGO_TARGET_DIR=/tmp/cargo-target cargo build --release -p lms-service && \
	cp /tmp/cargo-target/release/lms-service /usr/src/app/lms-service

# Build stage for Next.js Experience
FROM node:20-alpine AS node-builder
WORKDIR /app

COPY web/experience/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY web/experience/ .
ARG NEXT_PUBLIC_LMS_API_URL
ENV NEXT_PUBLIC_LMS_API_URL=$NEXT_PUBLIC_LMS_API_URL
ARG NEXT_PUBLIC_CMS_API_URL
ENV NEXT_PUBLIC_CMS_API_URL=$NEXT_PUBLIC_CMS_API_URL
RUN --mount=type=cache,target=/root/.npm npm run build

# Final stage
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production

# Install system dependencies for Rust binary
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install sharp for Next.js image optimization
RUN --mount=type=cache,target=/root/.npm npm install sharp

# Copy LMS binary
COPY --from=rust-builder /usr/src/app/lms-service ./

# Copy Experience frontend
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/.next/standalone ./
COPY --from=node-builder /app/.next/static ./.next/static

# Copy entrypoint
COPY web/experience/entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3003 3002
CMD ["./entrypoint.sh"]
