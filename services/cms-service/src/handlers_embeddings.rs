//! Handlers for PGVector embeddings in Question Bank
//! Enables semantic search and RAG with AI-powered embeddings

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::ai::{self, generate_embedding};
use common::models::QuestionBank;
use common::middleware::Org;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ==================== Query Parameters ====================

#[derive(Debug, Deserialize)]
pub struct SemanticSearchFilters {
    pub query: String,
    pub limit: Option<i32>,
    pub threshold: Option<f64>,
    pub question_type: Option<String>,
    pub difficulty: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SemanticSearchResult {
    pub id: Uuid,
    pub question_text: String,
    pub question_type: String,
    pub similarity: f64,  // PostgreSQL vector similarity returns double precision
    pub tags: Option<Vec<String>>,
    pub difficulty: Option<String>,
    pub points: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateEmbeddingsResult {
    pub processed: i32,
    pub failed: i32,
    pub duration_ms: u64,
}

// ==================== Generate Embeddings ====================

/// POST /api/question-bank/embeddings/generate - Generate embeddings for all questions without them
pub async fn generate_question_embeddings(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<GenerateEmbeddingsResult>, (StatusCode, String)> {
    let start = std::time::Instant::now();
    
    // Create client that accepts invalid certificates (for dev with self-signed certs)
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("HTTP client error: {}", e)))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Get questions without embeddings
    let questions: Vec<QuestionBank> = sqlx::query_as(
        r#"
        SELECT * FROM question_bank
        WHERE organization_id = $1
          AND (embedding IS NULL OR embedding_updated_at IS NULL)
        ORDER BY created_at DESC
        LIMIT 100
        "#
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let total = questions.len();
    let mut processed = 0;
    let mut failed = 0;
    
    for question in questions {
        // Generate embedding text (combine question + options + explanation)
        let mut embedding_text = question.question_text.clone();
        
        if let Some(options) = &question.options {
            if let Some(opts_str) = options.as_str() {
                embedding_text.push_str(" ");
                embedding_text.push_str(opts_str);
            } else if let Some(opts_arr) = options.as_array() {
                for opt in opts_arr {
                    if let Some(opt_str) = opt.as_str() {
                        embedding_text.push_str(" ");
                        embedding_text.push_str(opt_str);
                    }
                }
            }
        }
        
        if let Some(explanation) = &question.explanation {
            embedding_text.push_str(" ");
            embedding_text.push_str(explanation);
        }
        
        // Generate embedding
        match generate_embedding(&client, &ollama_url, &model, &embedding_text).await {
            Ok(response) => {
                let pgvector = ai::embedding_to_pgvector(&response.embedding);

                // Update question with embedding
                let result: Result<(i64,), sqlx::Error> = sqlx::query_as(
                    r#"
                    UPDATE question_bank
                    SET embedding = $1::vector,
                        embedding_updated_at = NOW()
                    WHERE id = $2
                    RETURNING 1
                    "#
                )
                .bind(&pgvector)
                .bind(question.id)
                .fetch_one(&pool)
                .await;

                match result {
                    Ok(_) => {
                        processed += 1;
                        tracing::debug!("Generated embedding for question {}", question.id);
                    }
                    Err(e) => {
                        failed += 1;
                        tracing::error!("Failed to update embedding for question {}: {}", question.id, e);
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to generate embedding for question {}: {}", question.id, e);
                failed += 1;
            }
        }
    }
    
    let duration_ms = start.elapsed().as_millis() as u64;
    
    tracing::info!(
        "Generated embeddings: {} processed, {} failed in {}ms",
        processed,
        failed,
        duration_ms
    );
    
    Ok(Json(GenerateEmbeddingsResult {
        processed,
        failed,
        duration_ms,
    }))
}

/// POST /api/question-bank/:id/embedding/regenerate - Regenerate embedding for a specific question
pub async fn regenerate_question_embedding(
    Org(org_ctx): Org,
    Path(question_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Create client that accepts invalid certificates
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("HTTP client error: {}", e)))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Get question
    let question: QuestionBank = sqlx::query_as(
        "SELECT * FROM question_bank WHERE id = $1 AND organization_id = $2"
    )
    .bind(question_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Question not found".to_string()))?;
    
    // Generate embedding text
    let mut embedding_text = question.question_text.clone();
    
    if let Some(options) = &question.options {
        if let Some(opts_str) = options.as_str() {
            embedding_text.push_str(" ");
            embedding_text.push_str(opts_str);
        } else if let Some(opts_arr) = options.as_array() {
            for opt in opts_arr {
                if let Some(opt_str) = opt.as_str() {
                    embedding_text.push_str(" ");
                    embedding_text.push_str(opt_str);
                }
            }
        }
    }
    
    if let Some(explanation) = &question.explanation {
        embedding_text.push_str(" ");
        embedding_text.push_str(explanation);
    }
    
    // Generate embedding
    let response = generate_embedding(&client, &ollama_url, &model, &embedding_text)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("AI error: {}", e)))?;
    
    let pgvector = ai::embedding_to_pgvector(&response.embedding);
    
    // Update question
    sqlx::query(
        r#"
        UPDATE question_bank
        SET embedding = $1::vector,
            embedding_updated_at = NOW()
        WHERE id = $2
        "#
    )
    .bind(&pgvector)
    .bind(question_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(StatusCode::OK)
}

// ==================== Semantic Search ====================

/// GET /api/question-bank/semantic-search - Search questions by semantic similarity
pub async fn semantic_search(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<SemanticSearchFilters>,
) -> Result<Json<Vec<SemanticSearchResult>>, (StatusCode, String)> {
    // Create client that accepts invalid certificates
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("HTTP client error: {}", e)))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Generate embedding for query
    let embedding_response = generate_embedding(&client, &ollama_url, &model, &filters.query)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("AI error: {}", e)))?;
    
    let pgvector = ai::embedding_to_pgvector(&embedding_response.embedding);
    
    let limit = filters.limit.unwrap_or(20);
    let threshold = filters.threshold.unwrap_or(0.5);
    
    // Build query with optional filters
    let mut query = String::from(
        r#"
        SELECT
            id,
            question_text,
            question_type::text,
            1 - (embedding <=> $1::vector) AS similarity,
            tags,
            difficulty,
            points
        FROM question_bank
        WHERE organization_id = $2
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) >= $3
        "#
    );
    
    let mut param_idx = 3;
    
    if let Some(ref question_type) = filters.question_type {
        param_idx += 1;
        query.push_str(&format!(" AND question_type::text = ${}", param_idx));
    }
    
    if let Some(ref difficulty) = filters.difficulty {
        param_idx += 1;
        query.push_str(&format!(" AND difficulty = ${}", param_idx));
    }
    
    param_idx += 1;
    query.push_str(&format!(" ORDER BY embedding <=> $1::vector LIMIT ${}", param_idx));
    
    let mut sql_query = sqlx::query_as::<_, SemanticSearchResult>(&query)
        .bind(&pgvector)
        .bind(org_ctx.id)
        .bind(threshold);
    
    if let Some(ref question_type) = filters.question_type {
        sql_query = sql_query.bind(question_type);
    }
    
    if let Some(ref difficulty) = filters.difficulty {
        sql_query = sql_query.bind(difficulty);
    }
    
    sql_query = sql_query.bind(limit);
    
    let results = sql_query
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(results))
}

/// GET /api/question-bank/similar/:id - Find questions similar to a given question
pub async fn find_similar_questions(
    Org(org_ctx): Org,
    Path(question_id): Path<Uuid>,
    Query(params): Query<SimilarityParams>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<SemanticSearchResult>>, (StatusCode, String)> {
    let threshold = params.threshold.unwrap_or(0.85);
    let limit = params.limit.unwrap_or(10);
    
    let results = sqlx::query_as::<_, SemanticSearchResult>(
        r#"
        SELECT 
            id,
            question_text,
            question_type::text,
            1 - (embedding <=> (SELECT embedding FROM question_bank WHERE id = $1)) AS similarity,
            tags,
            difficulty,
            points
        FROM question_bank
        WHERE id != $1
          AND organization_id = $2
          AND embedding IS NOT NULL
        ORDER BY embedding <=> (SELECT embedding FROM question_bank WHERE id = $1)
        LIMIT $3
        "#
    )
    .bind(question_id)
    .bind(org_ctx.id)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .into_iter()
    .filter(|r| r.similarity >= threshold)
    .collect();

    Ok(Json(results))
}

#[derive(Debug, Deserialize)]
pub struct SimilarityParams {
    pub threshold: Option<f64>,
    pub limit: Option<i32>,
}
