use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::models::{
    CreateQuestionBankPayload, ImportQuestionFromMySQLPayload, QuestionBank, QuestionBankFilters,
    QuestionBankType, UpdateQuestionBankPayload,
};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ==================== Create ====================

/// POST /api/question-bank - Create a new question in the bank
pub async fn create_question(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateQuestionBankPayload>,
) -> Result<Json<QuestionBank>, (StatusCode, String)> {
    let question: QuestionBank = sqlx::query_as(
        r#"
        INSERT INTO question_bank (
            organization_id, created_by, question_text, question_type,
            options, correct_answer, explanation, points, difficulty,
            tags, skill_assessed, media_url, media_type, audio_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
        RETURNING *
        "#
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(&payload.question_text)
    .bind(&payload.question_type)
    .bind(&payload.options)
    .bind(&payload.correct_answer)
    .bind(&payload.explanation)
    .bind(payload.points.unwrap_or(1))
    .bind(payload.difficulty.as_deref().unwrap_or("medium"))
    .bind(payload.tags.as_deref())
    .bind(payload.skill_assessed.as_deref())
    .bind(payload.media_url.as_deref())
    .bind(payload.media_type.as_deref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // If audio generation requested, trigger it asynchronously
    if payload.generate_audio.unwrap_or(false) {
        tokio::spawn(async move {
            let _ = generate_audio_for_question(question.id, pool.clone()).await;
        });
    }

    Ok(Json(question))
}

// ==================== List ====================

/// GET /api/question-bank - List questions with filters
pub async fn list_questions(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<QuestionBankFilters>,
) -> Result<Json<Vec<QuestionBank>>, (StatusCode, String)> {
    let questions = if filters.question_type.is_none() 
        && filters.difficulty.is_none() 
        && filters.source.is_none()
        && filters.search.is_none()
        && filters.has_audio.is_none()
    {
        // No filters - simple query
        sqlx::query_as::<_, QuestionBank>(
            "SELECT * FROM question_bank WHERE organization_id = $1 AND is_archived = false ORDER BY created_at DESC"
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    } else if filters.question_type.is_some() {
        sqlx::query_as::<_, QuestionBank>(
            "SELECT * FROM question_bank WHERE organization_id = $1 AND is_archived = false AND question_type = $2 ORDER BY created_at DESC"
        )
        .bind(org_ctx.id)
        .bind(filters.question_type.unwrap())
        .fetch_all(&pool)
        .await
    } else if filters.difficulty.is_some() {
        sqlx::query_as::<_, QuestionBank>(
            "SELECT * FROM question_bank WHERE organization_id = $1 AND is_archived = false AND difficulty = $2 ORDER BY created_at DESC"
        )
        .bind(org_ctx.id)
        .bind(filters.difficulty.as_ref().unwrap())
        .fetch_all(&pool)
        .await
    } else if filters.source.is_some() {
        sqlx::query_as::<_, QuestionBank>(
            "SELECT * FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source = $2 ORDER BY created_at DESC"
        )
        .bind(org_ctx.id)
        .bind(filters.source.as_ref().unwrap())
        .fetch_all(&pool)
        .await
    } else if filters.has_audio == Some(true) {
        sqlx::query_as::<_, QuestionBank>(
            "SELECT * FROM question_bank WHERE organization_id = $1 AND is_archived = false AND audio_status = 'ready' ORDER BY created_at DESC"
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    } else {
        // Default fallback
        sqlx::query_as::<_, QuestionBank>(
            "SELECT * FROM question_bank WHERE organization_id = $1 AND is_archived = false ORDER BY created_at DESC"
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(questions))
}

// ==================== Get ====================

/// GET /api/question-bank/{id} - Get a single question
pub async fn get_question(
    Org(org_ctx): Org,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<QuestionBank>, (StatusCode, String)> {
    let question: QuestionBank = sqlx::query_as(
        r#"
        SELECT * FROM question_bank
        WHERE id = $1 AND organization_id = $2 AND is_archived = false
        "#
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Question not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    Ok(Json(question))
}

// ==================== Update ====================

/// PUT /api/question-bank/{id} - Update a question
pub async fn update_question(
    Org(org_ctx): Org,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateQuestionBankPayload>,
) -> Result<Json<QuestionBank>, (StatusCode, String)> {
    let question: QuestionBank = sqlx::query_as(
        r#"
        UPDATE question_bank
        SET
            question_text = COALESCE($3, question_text),
            question_type = COALESCE($4, question_type),
            options = COALESCE($5, options),
            correct_answer = COALESCE($6, correct_answer),
            explanation = COALESCE($7, explanation),
            points = COALESCE($8, points),
            difficulty = COALESCE($9, difficulty),
            tags = COALESCE($10, tags),
            is_active = COALESCE($11, is_active),
            is_archived = COALESCE($12, is_archived),
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *
        "#
    )
    .bind(id)
    .bind(org_ctx.id)
    .bind(payload.question_text)
    .bind(payload.question_type.map(|t| t.to_string()))
    .bind(&payload.options)
    .bind(&payload.correct_answer)
    .bind(&payload.explanation)
    .bind(payload.points)
    .bind(payload.difficulty)
    .bind(payload.tags.as_deref())
    .bind(payload.is_active)
    .bind(payload.is_archived)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Question not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    Ok(Json(question))
}

// ==================== Delete ====================

/// DELETE /api/question-bank/{id} - Delete (archive) a question
pub async fn delete_question(
    Org(org_ctx): Org,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        r#"
        UPDATE question_bank
        SET is_archived = true, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Question not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Import from MySQL ====================

/// POST /api/question-bank/import-mysql - Import questions from MySQL question bank
pub async fn import_from_mysql(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ImportQuestionFromMySQLPayload>,
) -> Result<Json<Vec<QuestionBank>>, (StatusCode, String)> {
    use serde_json::json;
    
    // Connect to MySQL
    let mysql_url = std::env::var("MYSQL_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "MYSQL_DATABASE_URL not configured".to_string()))?;
    
    let mysql_pool = sqlx::MySqlPool::connect(&mysql_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to MySQL: {}", e)))?;
    
    // Fetch questions from MySQL
    let mysql_questions: Vec<MySqlQuestion> = if payload.import_all.unwrap_or(false) {
        sqlx::query_as(
            r#"
            SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                   c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.activo = 1
            LIMIT 200
            "#
        )
        .fetch_all(&mysql_pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch questions: {}", e)))?
    } else if let Some(course_id) = payload.mysql_course_id {
        sqlx::query_as(
            r#"
            SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                   c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.idCursos = ? AND bp.activo = 1
            LIMIT 100
            "#
        )
        .bind(course_id)
        .fetch_all(&mysql_pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch questions: {}", e)))?
    } else if let Some(question_ids) = payload.question_ids {
        // Fetch specific question IDs - use simple approach
        let mut imported_questions: Vec<QuestionBank> = vec![];
        
        for q_id in question_ids {
            let mq: Option<MySqlQuestion> = sqlx::query_as(
                r#"
                SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                       c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
                FROM bancopreguntas bp
                JOIN curso c ON bp.idCursos = c.idCursos
                JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
                WHERE bp.idPregunta = ? AND bp.activo = 1
                "#
            )
            .bind(q_id)
            .fetch_optional(&mysql_pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch question {}: {}", q_id, e)))?;
            
            if let Some(question) = mq {
                // Map MySQL question type to platform question type
                let question_type = map_mysql_question_type(question.id_tipo_pregunta);
                
                let options = if question_type == QuestionBankType::MultipleChoice {
                    Some(json!(["Opción A", "Opción B", "Opción C", "Opción D"]))
                } else if question_type == QuestionBankType::TrueFalse {
                    Some(json!(["Verdadero", "Falso"]))
                } else {
                    None
                };
                
                let source_metadata = json!({
                    "mysql_table": "bancopreguntas",
                    "idPregunta": question.id_pregunta,
                    "idCursos": question.id_cursos,
                    "nombre_curso": question.nombre_curso,
                    "idPlanDeEstudios": question.id_plan_de_estudios,
                    "plan_nombre": question.plan_nombre,
                    "idTipoPregunta": question.id_tipo_pregunta,
                    "imported_at": chrono::Utc::now().to_rfc3339(),
                });
                
                let qb: QuestionBank = sqlx::query_as(
                    r#"
                    INSERT INTO question_bank (
                        organization_id, created_by, question_text, question_type,
                        options, correct_answer, source, source_metadata,
                        audio_status, is_active
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, 'pending', true)
                    RETURNING *
                    "#
                )
                .bind(org_ctx.id)
                .bind(claims.sub)
                .bind(&question.descripcion)
                .bind(&question_type)
                .bind(&options)
                .bind(&serde_json::Value::Null)
                .bind(&source_metadata)
                .fetch_one(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to import question {}: {}", question.id_pregunta, e)))?;
                
                imported_questions.push(qb);
            }
        }
        
        mysql_pool.close().await;
        return Ok(Json(imported_questions));
    } else {
        return Err((StatusCode::BAD_REQUEST, "Must provide course_id, question_ids, or import_all".to_string()));
    };
    
    mysql_pool.close().await;
    
    if mysql_questions.is_empty() {
        return Err((StatusCode::NOT_FOUND, "No questions found in MySQL to import".to_string()));
    }
    
    // Import questions into PostgreSQL
    let mut imported_questions: Vec<QuestionBank> = vec![];
    let mut skipped_count = 0;

    for mq in mysql_questions {
        // Check if question already imported
        let exists: (bool,) = sqlx::query_as(
            "SELECT EXISTS(SELECT 1 FROM question_bank WHERE imported_mysql_id = $1 AND organization_id = $2)"
        )
        .bind(mq.id_pregunta)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to check existing: {}", e)))?;

        if exists.0 {
            skipped_count += 1;
            continue; // Skip already imported question
        }

        // Map MySQL question type to platform question type
        let question_type = map_mysql_question_type(mq.id_tipo_pregunta);

        // Create options for multiple choice (if applicable)
        let options = if question_type == QuestionBankType::MultipleChoice {
            Some(json!(["Opción A", "Opción B", "Opción C", "Opción D"]))
        } else if question_type == QuestionBankType::TrueFalse {
            Some(json!(["Verdadero", "Falso"]))
        } else {
            None
        };

        let source_metadata = json!({
            "mysql_table": "bancopreguntas",
            "idPregunta": mq.id_pregunta,
            "idCursos": mq.id_cursos,
            "nombre_curso": mq.nombre_curso,
            "idPlanDeEstudios": mq.id_plan_de_estudios,
            "plan_nombre": mq.plan_nombre,
            "idTipoPregunta": mq.id_tipo_pregunta,
            "imported_at": chrono::Utc::now().to_rfc3339(),
        });

        let question: QuestionBank = sqlx::query_as(
            r#"
            INSERT INTO question_bank (
                organization_id, created_by, question_text, question_type,
                options, correct_answer, source, source_metadata,
                imported_mysql_id, imported_mysql_course_id,
                audio_status, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, $8, $9, 'pending', true)
            RETURNING *
            "#
        )
        .bind(org_ctx.id)
        .bind(claims.sub)
        .bind(&mq.descripcion)
        .bind(&question_type)
        .bind(&options)
        .bind(&serde_json::Value::Null) // Correct answer to be filled by user
        .bind(&source_metadata)
        .bind(mq.id_pregunta)
        .bind(mq.id_cursos)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to import question {}: {}", mq.id_pregunta, e)))?;

        imported_questions.push(question);
    }

    tracing::info!("Imported {} questions from MySQL (skipped {} already imported)", imported_questions.len(), skipped_count);

    Ok(Json(imported_questions))
}

// ==================== Audio Generation ====================

/// POST /api/question-bank/{id}/generate-audio - Generate audio for a question using Bark
pub async fn generate_audio(
    Org(org_ctx): Org,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
    payload: Option<Json<common::models::GenerateAudioPayload>>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Get question
    let question: QuestionBank = sqlx::query_as(
        "SELECT * FROM question_bank WHERE id = $1 AND organization_id = $2"
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Question not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;
    
    // Spawn async task for audio generation
    tokio::spawn(async move {
        let _ = generate_audio_for_question_with_params(id, pool, payload.map(|p| p.0)).await;
    });
    
    Ok(StatusCode::ACCEPTED)
}

async fn generate_audio_for_question(
    question_id: Uuid,
    pool: PgPool,
) -> Result<(), String> {
    generate_audio_for_question_with_params(question_id, pool, None).await
}

async fn generate_audio_for_question_with_params(
    question_id: Uuid,
    pool: PgPool,
    payload: Option<common::models::GenerateAudioPayload>,
) -> Result<(), String> {
    use reqwest::Client;
    use serde_json::json;
    
    // Get question text
    let question_text: String = sqlx::query_scalar("SELECT audio_text FROM question_bank WHERE id = $1")
        .bind(question_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("Failed to get question: {}", e))?
        .unwrap_or_default();
    
    let text = payload.as_ref().map(|p| p.text.clone()).unwrap_or(question_text);
    
    // Update status to generating
    sqlx::query("UPDATE question_bank SET audio_status = 'generating' WHERE id = $1")
        .bind(question_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update status: {}", e))?;
    
    // Call Bark TTS API
    let bark_url = std::env::var("BARK_API_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());
    let client = Client::new();
    
    let voice = payload.as_ref().and_then(|p| p.voice.clone()).unwrap_or_else(|| "v2/en_speaker_1".to_string());
    let speed = payload.as_ref().and_then(|p| p.speed).unwrap_or(1.0);
    
    let response = client
        .post(&format!("{}/api/generate", bark_url))
        .json(&json!({
            "text": text,
            "voice": voice,
            "speed": speed,
            "output_format": "mp3"
        }))
        .send()
        .await
        .map_err(|e| format!("Bark API request failed: {}", e))?;
    
    if !response.status().is_success() {
        sqlx::query("UPDATE question_bank SET audio_status = 'failed' WHERE id = $1")
            .bind(question_id)
            .execute(&pool)
            .await
            .map_err(|_| "Failed to update status".to_string())?;
        
        return Err(format!("Bark API returned error: {}", response.status()));
    }
    
    // Save audio file
    let audio_bytes = response.bytes().await.map_err(|e| format!("Failed to get audio bytes: {}", e))?;
    
    // Save to uploads directory
    let filename = format!("question_{}.mp3", question_id);
    let file_path = format!("uploads/audio/{}", filename);
    
    std::fs::create_dir_all("uploads/audio").map_err(|e| format!("Failed to create directory: {}", e))?;
    std::fs::write(&file_path, &audio_bytes).map_err(|e| format!("Failed to save audio: {}", e))?;
    
    // Update question with audio URL
    let audio_url = format!("/audio/{}", filename);
    sqlx::query(
        "UPDATE question_bank SET audio_url = $1, audio_status = 'ready', audio_metadata = $2 WHERE id = $3"
    )
    .bind(&audio_url)
    .bind(&json!({
        "voice": voice,
        "speed": speed,
        "generated_at": chrono::Utc::now().to_rfc3339(),
        "file_size": audio_bytes.len(),
    }))
    .bind(question_id)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to update question: {}", e))?;
    
    tracing::info!("Generated audio for question {}", question_id);
    
    Ok(())
}

// ==================== Helpers ====================

fn map_mysql_question_type(mysql_type: i32) -> QuestionBankType {
    // Map MySQL question types to platform types
    // This depends on how tipos are defined in the MySQL database
    match mysql_type {
        1 => QuestionBankType::MultipleChoice,
        2 => QuestionBankType::TrueFalse,
        3 => QuestionBankType::ShortAnswer,
        4 => QuestionBankType::Matching,
        _ => QuestionBankType::MultipleChoice, // Default
    }
}

// ==================== MySQL Integration ====================

/// GET /api/question-bank/mysql-courses - List courses from MySQL for import
pub async fn list_mysql_courses(
    Org(_org_ctx): Org,
    State(_pool): State<PgPool>,
) -> Result<Json<Vec<MySqlCourseInfo>>, (StatusCode, String)> {
    // Connect to MySQL
    let mysql_url = std::env::var("MYSQL_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "MYSQL_DATABASE_URL not configured".to_string()))?;
    
    let mysql_pool = sqlx::MySqlPool::connect(&mysql_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to MySQL: {}", e)))?;
    
    // Fetch courses with their plan names
    let courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT 
            c.idCursos,
            c.NombreCurso,
            c.NivelCurso,
            pe.idPlanDeEstudios,
            pe.Nombre as NombrePlan
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.Activo = 1
        ORDER BY pe.Nombre, c.NombreCurso
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch courses: {}", e)))?;
    
    mysql_pool.close().await;
    
    Ok(Json(courses))
}

/// POST /api/question-bank/import-mysql-all - Import ALL questions from MySQL (bulk import)
pub async fn import_all_from_mysql(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<ImportResult>, (StatusCode, String)> {
    // Connect to MySQL
    let mysql_url = std::env::var("MYSQL_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "MYSQL_DATABASE_URL not configured".to_string()))?;
    
    let mysql_pool = sqlx::MySqlPool::connect(&mysql_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to MySQL: {}", e)))?;
    
    // Fetch ALL questions from MySQL
    let mysql_questions: Vec<MySqlQuestionFull> = sqlx::query_as(
        r#"
        SELECT 
            bp.idPregunta,
            bp.descripcion,
            bp.idTipoPregunta,
            bp.activo,
            c.idCursos,
            c.NombreCurso,
            c.NivelCurso,
            pe.idPlanDeEstudios,
            pe.Nombre as PlanNombre
        FROM bancopreguntas bp
        JOIN curso c ON bp.idCursos = c.idCursos
        JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE bp.activo = 1
        ORDER BY pe.Nombre, c.NombreCurso, bp.idPregunta
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch questions: {}", e)))?;
    
    mysql_pool.close().await;
    
    if mysql_questions.is_empty() {
        return Ok(Json(ImportResult {
            imported: 0,
            skipped: 0,
            updated: 0,
            error: Some("No questions found in MySQL".to_string()),
        }));
    }
    
    // Import questions into PostgreSQL
    let mut imported_count = 0;
    let mut skipped_count = 0;
    let mut updated_count = 0;
    
    for mq in mysql_questions {
        // Check if question already exists
        let existing: Option<(Uuid, bool)> = sqlx::query_as(
            "SELECT id, is_active FROM question_bank WHERE imported_mysql_id = $1 AND organization_id = $2"
        )
        .bind(mq.id_pregunta)
        .bind(org_ctx.id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Check failed: {}", e)))?;
        
        match existing {
            Some((id, is_active)) => {
                // Question exists - update if it was inactive or has new data
                if !is_active {
                    // Reactivate and update
                    let _ = sqlx::query(
                        "UPDATE question_bank SET is_active = true, question_text = $3, updated_at = NOW() WHERE id = $1 AND organization_id = $2"
                    )
                    .bind(id)
                    .bind(org_ctx.id)
                    .bind(&mq.descripcion)
                    .execute(&pool)
                    .await;
                    updated_count += 1;
                } else {
                    skipped_count += 1; // Already exists and active, skip
                }
            }
            None => {
                // New question - insert
                let question_type = map_mysql_question_type(mq.id_tipo_pregunta);
                let options = if question_type == QuestionBankType::MultipleChoice {
                    Some(serde_json::json!(["Opción A", "Opción B", "Opción C", "Opción D"]))
                } else if question_type == QuestionBankType::TrueFalse {
                    Some(serde_json::json!(["Verdadero", "Falso"]))
                } else {
                    None
                };
                
                let source_metadata = serde_json::json!({
                    "mysql_table": "bancopreguntas",
                    "idPregunta": mq.id_pregunta,
                    "idCursos": mq.id_cursos,
                    "nombre_curso": mq.nombre_curso,
                    "nivel_curso": mq.nivel_curso,
                    "idPlanDeEstudios": mq.id_plan_de_estudios,
                    "plan_nombre": mq.plan_nombre,
                    "idTipoPregunta": mq.id_tipo_pregunta,
                    "imported_at": chrono::Utc::now().to_rfc3339(),
                    "import_method": "bulk_import_all",
                });
                
                let _ = sqlx::query(
                    r#"
                    INSERT INTO question_bank (
                        organization_id, created_by, question_text, question_type,
                        options, correct_answer, source, source_metadata,
                        imported_mysql_id, imported_mysql_course_id,
                        audio_status, is_active
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, $8, $9, 'pending', true)
                    "#
                )
                .bind(org_ctx.id)
                .bind(claims.sub)
                .bind(&mq.descripcion)
                .bind(&question_type)
                .bind(&options)
                .bind(&serde_json::Value::Null)
                .bind(&source_metadata)
                .bind(mq.id_pregunta)
                .bind(mq.id_cursos)
                .execute(&pool)
                .await;
                
                imported_count += 1;
            }
        }
    }
    
    tracing::info!(
        "Bulk import from MySQL: {} imported, {} skipped, {} updated",
        imported_count,
        skipped_count,
        updated_count
    );
    
    Ok(Json(ImportResult {
        imported: imported_count,
        skipped: skipped_count,
        updated: updated_count,
        error: None,
    }))
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: i32,
    pub skipped: i32,
    pub updated: i32,
    pub error: Option<String>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct MySqlCourseInfo {
    pub id_cursos: i32,
    pub nombre_curso: String,
    pub nivel_curso: Option<i32>,
    pub id_plan_de_estudios: i32,
    pub nombre_plan: String,
}

// Excel import - pendiente de fix
// /// POST /api/question-bank/import-excel - Import questions from Excel file
// pub async fn import_from_excel(
//     Org(org_ctx): Org,
//     claims: Claims,
//     State(pool): State<PgPool>,
//     multipart: axum::extract::Multipart,
// ) -> Result<Json<ImportResult>, (StatusCode, String)> {
//     // Implementation pending
//     unimplemented!()
// }

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct MySqlQuestionFull {
    pub id_pregunta: i32,
    pub descripcion: String,
    pub id_tipo_pregunta: i32,
    pub activo: bool,
    pub id_cursos: i32,
    pub nombre_curso: String,
    pub nivel_curso: Option<i32>,
    pub id_plan_de_estudios: i32,
    pub plan_nombre: String,
}

#[derive(Debug, sqlx::FromRow)]
struct MySqlQuestion {
    id_pregunta: i32,
    descripcion: String,
    id_tipo_pregunta: i32,
    activo: bool,
    id_cursos: i32,
    nombre_curso: String,
    id_plan_de_estudios: i32,
    plan_nombre: String,
}
