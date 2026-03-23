//! AI Token Limit Utilities
//! Provides functions to check and enforce monthly token limits

use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, FromRow)]
pub struct TokenLimitCheck {
    pub has_available_tokens: bool,
    pub monthly_limit: i32,
    pub used_tokens: i64,
    pub remaining_tokens: i64,
    pub reset_date: DateTime<Utc>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TokenLimitError {
    pub error: String,
    pub monthly_limit: i32,
    pub used_tokens: i64,
    pub remaining_tokens: i64,
    pub reset_date: DateTime<Utc>,
}

/// Verify if user has available tokens for AI operations
/// 
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - User UUID
/// * `estimated_tokens` - Estimated tokens for this operation (default: 1000)
/// 
/// # Returns
/// * `Ok(TokenLimitCheck)` - User has available tokens
/// * `Err(TokenLimitError)` - User exceeded limit
pub async fn check_ai_token_limit(
    pool: &PgPool,
    user_id: Uuid,
    estimated_tokens: i32,
) -> Result<TokenLimitCheck, TokenLimitError> {
    let result: TokenLimitCheck = sqlx::query_as(
        "SELECT * FROM check_token_limit($1, $2)"
    )
    .bind(user_id)
    .bind(estimated_tokens)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check token limit: {}", e);
        TokenLimitError {
            error: "Failed to verify token limit".to_string(),
            monthly_limit: 0,
            used_tokens: 0,
            remaining_tokens: 0,
            reset_date: Utc::now(),
        }
    })?;

    if !result.has_available_tokens {
        tracing::warn!(
            "User {} exceeded token limit: {}/{} (reset: {})",
            user_id,
            result.used_tokens,
            result.monthly_limit,
            result.reset_date
        );
        
        return Err(TokenLimitError {
            error: format!(
                "Monthly AI token limit exceeded. Used: {} / Limit: {}. Reset date: {}",
                result.used_tokens,
                result.monthly_limit,
                result.reset_date.format("%Y-%m-%d %H:%M UTC")
            ),
            monthly_limit: result.monthly_limit,
            used_tokens: result.used_tokens,
            remaining_tokens: result.remaining_tokens,
            reset_date: result.reset_date,
        });
    }

    Ok(result)
}

/// Get formatted token usage message for API responses
pub fn format_token_limit_message(used: i64, limit: i32, reset: DateTime<Utc>) -> String {
    let percentage = (used as f64 / limit as f64 * 100.0).round();
    format!(
        "🚫 Límite de tokens IA alcanzado: {}% usado ({}/{} tokens). Reset: {}",
        percentage,
        used,
        limit,
        reset.format("%d/%m/%Y a las %H:%M")
    )
}
