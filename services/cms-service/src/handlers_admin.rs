use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

// ==================== Token Usage Tracking ====================

/// GET /api/admin/token-usage - Get token usage statistics for all users
pub async fn get_token_usage(
    _org_ctx: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<TokenUsageResponse>, (StatusCode, String)> {
    // Get user token usage from database
    let usage: Vec<TokenUsageRecord> = sqlx::query_as(
        r#"
        SELECT 
            u.id as user_id,
            u.email,
            u.full_name,
            u.role,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COUNT(au.id) as ai_requests,
            MAX(au.created_at) as last_used
        FROM users u
        LEFT JOIN ai_usage_logs au ON u.id = au.user_id
        GROUP BY u.id, u.email, u.full_name, u.role
        ORDER BY total_tokens DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch usage: {}", e)))?;

    // Calculate stats
    let total_tokens: i64 = usage.iter().map(|u| u.total_tokens).sum();
    let total_input: i64 = usage.iter().map(|u| u.input_tokens).sum();
    let total_output: i64 = usage.iter().map(|u| u.output_tokens).sum();
    let total_requests: i64 = usage.iter().map(|u| u.ai_requests).sum();
    let top_user_tokens = usage.first().map(|u| u.total_tokens).unwrap_or(0);
    let avg_tokens = if !usage.is_empty() { total_tokens / usage.len() as i64 } else { 0 };

    // Estimate cost (using approximate OpenAI pricing: $0.001/1K input, $0.003/1K output)
    let estimated_cost = (total_input as f64 * 0.000001) + (total_output as f64 * 0.000003);

    let stats = TokenUsageStats {
        total_tokens,
        total_input,
        total_output,
        total_requests,
        total_cost_usd: estimated_cost,
        top_user_tokens,
        avg_tokens_per_user: avg_tokens,
    };

    // Convert to response format with USD estimation per user
    let usage_with_cost: Vec<TokenUsage> = usage
        .into_iter()
        .map(|u| {
            let user_cost = (u.input_tokens as f64 * 0.000001) + (u.output_tokens as f64 * 0.000003);
            TokenUsage {
                user_id: u.user_id.to_string(),
                email: u.email,
                full_name: u.full_name,
                role: u.role,
                total_tokens: u.total_tokens,
                input_tokens: u.input_tokens,
                output_tokens: u.output_tokens,
                ai_requests: u.ai_requests,
                last_used: u.last_used.to_rfc3339(),
                estimated_cost_usd: user_cost,
            }
        })
        .collect();

    Ok(Json(TokenUsageResponse {
        usage: usage_with_cost,
        stats,
    }))
}

#[derive(Debug, Deserialize)]
pub struct TokenUsageFilters {
    pub role: Option<String>,
    pub min_tokens: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct TokenUsage {
    pub user_id: String,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub ai_requests: i64,
    pub last_used: String,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct TokenUsageRecord {
    user_id: uuid::Uuid,
    email: String,
    full_name: String,
    role: String,
    total_tokens: i64,
    input_tokens: i64,
    output_tokens: i64,
    ai_requests: i64,
    last_used: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct TokenUsageStats {
    pub total_tokens: i64,
    pub total_input: i64,
    pub total_output: i64,
    pub total_requests: i64,
    pub total_cost_usd: f64,
    pub top_user_tokens: i64,
    pub avg_tokens_per_user: i64,
}

#[derive(Debug, Serialize)]
pub struct TokenUsageResponse {
    pub usage: Vec<TokenUsage>,
    pub stats: TokenUsageStats,
}
