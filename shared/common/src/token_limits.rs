//! Utilidades de Límite de Tokens de IA
//! Proporciona funciones para verificar y hacer cumplir los límites mensuales de tokens

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

/// Verificar si el usuario tiene tokens disponibles para operaciones de IA
/// 
/// # Argumentos
/// * `pool` - Pool de conexión a la base de datos
/// * `user_id` - UUID del usuario
/// * `estimated_tokens` - Tokens estimados para esta operación (por defecto: 1000)
/// 
/// # Retornos
/// * `Ok(TokenLimitCheck)` - El usuario tiene tokens disponibles
/// * `Err(TokenLimitError)` - El usuario excedió el límite
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
        tracing::error!("Error al verificar el límite de tokens: {}", e);
        TokenLimitError {
            error: "Error al verificar el límite de tokens".to_string(),
            monthly_limit: 0,
            used_tokens: 0,
            remaining_tokens: 0,
            reset_date: Utc::now(),
        }
    })?;

    if !result.has_available_tokens {
        tracing::warn!(
            "El usuario {} excedió el límite de tokens: {}/{} (reinicio: {})",
            user_id,
            result.used_tokens,
            result.monthly_limit,
            result.reset_date
        );
        
        return Err(TokenLimitError {
            error: format!(
                "Límite mensual de tokens de IA excedido. Usados: {} / Límite: {}. Fecha de reinicio: {}",
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

/// Obtener el mensaje formateado de uso de tokens para las respuestas de la API
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
