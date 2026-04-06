# syntax=docker/dockerfile:1.7

# Build stage for Rust CMS
FROM rust:1-bookworm AS rust-builder
WORKDIR /usr/src/app

# Install system dependencies first
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy entire project for building (simpler and more reliable)
COPY Cargo.toml Cargo.lock ./
COPY shared/ ./shared/
COPY services/ ./services/

# Build the CMS service
RUN --mount=type=cache,target=/usr/local/cargo/registry \
	--mount=type=cache,target=/usr/local/cargo/git \
	--mount=type=cache,target=/tmp/cargo-target \
	CARGO_TARGET_DIR=/tmp/cargo-target cargo build --release -p cms-service && \
	cp /tmp/cargo-target/release/cms-service /usr/src/app/cms-service

# Build stage for Next.js Studio
FROM node:20-alpine AS node-builder
WORKDIR /app

COPY web/studio/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY web/studio/ .
ARG NEXT_PUBLIC_CMS_API_URL
ARG NEXT_PUBLIC_LMS_API_URL
ENV NEXT_PUBLIC_CMS_API_URL=$NEXT_PUBLIC_CMS_API_URL
ENV NEXT_PUBLIC_LMS_API_URL=$NEXT_PUBLIC_LMS_API_URL
RUN --mount=type=cache,target=/root/.npm npm run build

# Final stage
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production

# Install system dependencies for Rust binary
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install sharp for Next.js image optimization
RUN --mount=type=cache,target=/root/.npm npm install sharp

# Copy CMS binary
COPY --from=rust-builder /usr/src/app/cms-service ./

# Copy Studio frontend
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/.next/standalone ./
COPY --from=node-builder /app/.next/static ./.next/static

# Copy entrypoint
COPY web/studio/entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000 3001
CMD ["./entrypoint.sh"]
