//! AI Utilities for OpenCCB
//! Provides embedding generation and other AI helper functions

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Default embedding model for Ollama
pub const DEFAULT_EMBEDDING_MODEL: &str = "nomic-embed-text";

/// Default Ollama URL
pub const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";

/// Embedding dimensions for nomic-embed-text
pub const EMBEDDING_DIMENSIONS: usize = 768;

/// Model selection for different use cases
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelType {
    /// Fast conversational AI (chat, tutor, Q&A)
    Chat,
    /// Complex reasoning (analysis, recommendations, feedback)
    Complex,
    /// Advanced tasks (course generation, detailed analysis)
    Advanced,
    /// Embedding generation
    Embedding,
}

impl ModelType {
    /// Get the model name for this type from environment
    pub fn get_model(&self) -> String {
        match self {
            ModelType::Chat => {
                std::env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string())
            }
            ModelType::Complex => {
                std::env::var("LOCAL_LLM_MODEL_COMPLEX").unwrap_or_else(|_| "qwen3.5:9b".to_string())
            }
            ModelType::Advanced => {
                std::env::var("LOCAL_LLM_MODEL_ADVANCED").unwrap_or_else(|_| "gpt-oss:latest".to_string())
            }
            ModelType::Embedding => {
                std::env::var("EMBEDDING_MODEL").unwrap_or_else(|_| "nomic-embed-text".to_string())
            }
        }
    }

    /// Get recommended temperature for this model type
    pub fn get_temperature(&self) -> f32 {
        match self {
            ModelType::Chat => 0.7,       // Balanced creativity/accuracy
            ModelType::Complex => 0.5,    // More focused reasoning
            ModelType::Advanced => 0.6,   // Balanced for analysis
            ModelType::Embedding => 0.0,  // Deterministic for embeddings
        }
    }

    /// Get max tokens for this model type
    pub fn get_max_tokens(&self) -> u32 {
        match self {
            ModelType::Chat => 1024,
            ModelType::Complex => 2048,
            ModelType::Advanced => 4096,
            ModelType::Embedding => 0, // Not applicable
        }
    }
}

#[derive(Error, Debug)]
pub enum AiError {
    #[error("Ollama request failed: {0}")]
    OllamaRequest(String),
    #[error("Invalid embedding response: {0}")]
    InvalidResponse(String),
    #[error("Model not available: {0}")]
    ModelNotAvailable(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
    #[serde(default)]
    pub model: String,
}

/// Get Ollama URL from environment or default
pub fn get_ollama_url() -> String {
    std::env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| DEFAULT_OLLAMA_URL.to_string())
}

/// Get embedding model from environment or default
pub fn get_embedding_model() -> String {
    std::env::var("EMBEDDING_MODEL").unwrap_or_else(|_| DEFAULT_EMBEDDING_MODEL.to_string())
}

/// Get the best model for a specific task
pub fn get_model_for_task(task: &str) -> String {
    // Task-based model selection
    match task.to_lowercase().as_str() {
        t if t.contains("chat") || t.contains("tutor") || t.contains("conversation") => {
            ModelType::Chat.get_model()
        }
        t if t.contains("quiz") || t.contains("question") || t.contains("assessment") => {
            ModelType::Complex.get_model()
        }
        t if t.contains("course") || t.contains("curriculum") || t.contains("syllabus") => {
            ModelType::Advanced.get_model()
        }
        t if t.contains("feedback") || t.contains("recommendation") || t.contains("analysis") => {
            ModelType::Complex.get_model()
        }
        t if t.contains("transcript") || t.contains("summary") => {
            ModelType::Chat.get_model()
        }
        _ => ModelType::Chat.get_model(),
    }
}

/// Create a reqwest client that accepts invalid certificates (for dev with self-signed certs)
fn create_insecure_client() -> Result<reqwest::Client, AiError> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| AiError::OllamaRequest(format!("Failed to create HTTP client: {}", e)))
}

/// Generate embedding for text using Ollama
/// 
/// # Arguments
/// * `client` - reqwest::Client instance
/// * `ollama_url` - Base URL for Ollama (e.g., "http://localhost:11434")
/// * `model` - Embedding model name (default: "nomic-embed-text")
/// * `text` - Text to embed
pub async fn generate_embedding(
    client: &reqwest::Client,
    ollama_url: &str,
    model: &str,
    text: &str,
) -> Result<EmbeddingResponse, AiError> {
    let endpoint = format!("{}/api/embeddings", ollama_url.trim_end_matches('/'));
    
    let response = client
        .post(&endpoint)
        .json(&serde_json::json!({
            "model": model,
            "prompt": text
        }))
        .send()
        .await
        .map_err(|e| AiError::OllamaRequest(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(AiError::OllamaRequest(
            format!("Ollama API error ({}): {}", status, error_text)
        ));
    }

    let embedding_response: EmbeddingResponse = response
        .json()
        .await
        .map_err(|e| AiError::InvalidResponse(format!("Failed to parse response: {}", e)))?;

    Ok(embedding_response)
}

/// Generate embeddings for multiple texts in batch
pub async fn generate_embeddings_batch(
    client: &reqwest::Client,
    ollama_url: &str,
    model: &str,
    texts: Vec<&str>,
) -> Result<Vec<EmbeddingResponse>, AiError> {
    let mut embeddings = Vec::with_capacity(texts.len());
    
    for text in texts {
        let embedding = generate_embedding(client, ollama_url, model, text).await?;
        embeddings.push(embedding);
    }
    
    Ok(embeddings)
}

/// Convert a vector of f32 to pgvector-compatible format
/// PostgreSQL vector format: "[0.1,0.2,0.3,...]"
pub fn embedding_to_pgvector(embedding: &[f32]) -> String {
    let formatted: Vec<String> = embedding
        .iter()
        .map(|v| format!("{:.7}", v))
        .collect();
    format!("[{}]", formatted.join(","))
}

/// Parse pgvector format back to Vec<f32>
pub fn pgvector_to_embedding(pgvector: &str) -> Result<Vec<f32>, String> {
    let trimmed = pgvector.trim().trim_start_matches('[').trim_end_matches(']');
    trimmed
        .split(',')
        .map(|s| s.trim().parse::<f32>().map_err(|e| format!("Parse error: {}", e)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_to_pgvector() {
        let embedding = vec![0.1, 0.2, 0.3];
        let pg = embedding_to_pgvector(&embedding);
        assert_eq!(pg, "[0.1000000,0.2000000,0.3000000]");
    }

    #[test]
    fn test_pgvector_to_embedding() {
        let pg = "[0.1000000,0.2000000,0.3000000]";
        let embedding = pgvector_to_embedding(pg).unwrap();
        assert_eq!(embedding, vec![0.1, 0.2, 0.3]);
    }
}
