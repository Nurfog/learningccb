//! Health check endpoints for monitoring and observability

use axum::{Json, Router, routing::get, extract::State};
use serde_json::json;
use sqlx::PgPool;
use std::time::Instant;

/// Health check state shared across requests
#[derive(Clone)]
pub struct HealthState {
    pub start_time: Instant,
    pub version: String,
}

impl Default for HealthState {
    fn default() -> Self {
        Self {
            start_time: Instant::now(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

/// Basic health check endpoint
pub async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Detailed readiness check including database connectivity
pub async fn readiness_check(pool: PgPool) -> Json<serde_json::Value> {
    let db_status = match pool.acquire().await {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };

    let status = if db_status == "connected" { "ready" } else { "not_ready" };

    Json(json!({
        "status": status,
        "database": db_status,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Liveness check with uptime information
pub async fn liveness_check(state: State<HealthState>) -> Json<serde_json::Value> {
    let uptime = state.start_time.elapsed();

    Json(json!({
        "status": "alive",
        "version": state.version,
        "uptime_seconds": uptime.as_secs(),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Create health routes
pub fn health_routes(pool: PgPool) -> Router<HealthState> {
    Router::new()
        .route("/health", get(health_check))
        .route("/health/live", get(liveness_check))
        .route("/health/ready", get(move || readiness_check(pool.clone())))
}
