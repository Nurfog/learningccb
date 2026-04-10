//! Utilidades de IA para OpenCCB
//! Proporciona generación de embeddings y otras funciones de ayuda de IA

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Modelo de embedding por defecto para Ollama
pub const DEFAULT_EMBEDDING_MODEL: &str = "nomic-embed-text";

/// URL de Ollama por defecto
pub const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";

/// Dimensiones del embedding para nomic-embed-text
pub const EMBEDDING_DIMENSIONS: usize = 768;

/// Selección de modelo para diferentes casos de uso
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelType {
    /// IA conversacional rápida (chat, tutor, preguntas y respuestas)
    Chat,
    /// Razonamiento complejo (análisis, recomendaciones, retroalimentación)
    Complex,
    /// Tareas avanzadas (generación de cursos, análisis detallado)
    Advanced,
    /// Generación de embeddings
    Embedding,
}

impl ModelType {
    /// Obtener el nombre del modelo para este tipo desde el entorno
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

    /// Obtener la temperatura recomendada para este tipo de modelo
    pub fn get_temperature(&self) -> f32 {
        match self {
            ModelType::Chat => 0.7,       // Equilibrio entre creatividad y precisión
            ModelType::Complex => 0.5,    // Razonamiento más enfocado
            ModelType::Advanced => 0.6,   // Equilibrado para análisis
            ModelType::Embedding => 0.0,  // Determinista para embeddings
        }
    }

    /// Obtener los tokens máximos para este tipo de modelo
    pub fn get_max_tokens(&self) -> u32 {
        match self {
            ModelType::Chat => 1024,
            ModelType::Complex => 2048,
            ModelType::Advanced => 4096,
            ModelType::Embedding => 0, // No aplicable
        }
    }
}

#[derive(Error, Debug)]
pub enum AiError {
    #[error("Solicitud a Ollama fallida: {0}")]
    OllamaRequest(String),
    #[error("Respuesta de embedding inválida: {0}")]
    InvalidResponse(String),
    #[error("Modelo no disponible: {0}")]
    ModelNotAvailable(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
    #[serde(default)]
    pub model: String,
}

/// Obtener la URL de Ollama desde el entorno o por defecto
pub fn get_ollama_url() -> String {
    std::env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| DEFAULT_OLLAMA_URL.to_string())
}

/// Obtener el modelo de embedding desde el entorno o por defecto
pub fn get_embedding_model() -> String {
    std::env::var("EMBEDDING_MODEL").unwrap_or_else(|_| DEFAULT_EMBEDDING_MODEL.to_string())
}

/// Obtener el mejor modelo para una tarea específica
pub fn get_model_for_task(task: &str) -> String {
    // Selección de modelo basada en la tarea
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

/// Crear un cliente reqwest que acepte certificados inválidos (para desarrollo con certificados autofirmados)
#[allow(dead_code)]
fn create_insecure_client() -> Result<reqwest::Client, AiError> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| AiError::OllamaRequest(format!("Error al crear el cliente HTTP: {}", e)))
}

/// Generar embedding para texto usando Ollama
/// 
/// # Argumentos
/// * `client` - instancia de reqwest::Client
/// * `ollama_url` - URL base para Ollama (e.g., "http://localhost:11434")
/// * `model` - Nombre del modelo de embedding (por defecto: "nomic-embed-text")
/// * `text` - Texto a incrustar
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
        .map_err(|e| AiError::OllamaRequest(format!("Solicitud fallida: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(AiError::OllamaRequest(
            format!("Error de la API de Ollama ({}): {}", status, error_text)
        ));
    }

    let embedding_response: EmbeddingResponse = response
        .json()
        .await
        .map_err(|e| AiError::InvalidResponse(format!("Error al analizar la respuesta: {}", e)))?;

    Ok(embedding_response)
}

/// Generar embeddings para múltiples textos en lote
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

/// Convertir un vector de f32 a un formato compatible con pgvector
/// Formato de vector de PostgreSQL: "[0.1,0.2,0.3,...]"
pub fn embedding_to_pgvector(embedding: &[f32]) -> String {
    let formatted: Vec<String> = embedding
        .iter()
        .map(|v| format!("{:.7}", v))
        .collect();
    format!("[{}]", formatted.join(","))
}

/// Analizar el formato pgvector de vuelta a Vec<f32>
pub fn pgvector_to_embedding(pgvector: &str) -> Result<Vec<f32>, String> {
    let trimmed = pgvector.trim().trim_start_matches('[').trim_end_matches(']');
    trimmed
        .split(',')
        .map(|s| s.trim().parse::<f32>().map_err(|e| format!("Error de análisis: {}", e)))
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
