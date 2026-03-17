use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::models::{
    CourseLevel, CourseType, CreateTestTemplatePayload, TestTemplate, TestTemplateQuestion,
    TestTemplateSection, TestTemplateWithQuestions, TestType, UpdateTestTemplatePayload,
};
use common::{auth::Claims, middleware::Org};
use serde::Deserialize;
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

// ==================== Query Parameters ====================

#[derive(Debug, Deserialize)]
pub struct TestTemplateFilters {
    pub level: Option<CourseLevel>,
    pub course_type: Option<CourseType>,
    pub test_type: Option<TestType>,
    pub tags: Option<String>, // Comma-separated list
    pub search: Option<String>,
}

// ==================== Create ====================

/// POST /api/test-templates - Create a new test template
pub async fn create_test_template(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateTestTemplatePayload>,
) -> Result<Json<TestTemplate>, (StatusCode, String)> {
    let template: TestTemplate = sqlx::query_as(
        r#"
        INSERT INTO test_templates (
            organization_id, created_by, name, description, level, course_type, 
            test_type, duration_minutes, passing_score, total_points, 
            instructions, template_data, tags
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, organization_id, created_by, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_at, updated_at
        "#
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.level)
    .bind(&payload.course_type)
    .bind(&payload.test_type)
    .bind(payload.duration_minutes)
    .bind(payload.passing_score)
    .bind(payload.total_points)
    .bind(&payload.instructions)
    .bind(&payload.template_data)
    .bind(payload.tags.as_deref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(template))
}

// ==================== Read ====================

/// GET /api/test-templates - List test templates with filters
pub async fn list_test_templates(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<TestTemplateFilters>,
) -> Result<Json<Vec<TestTemplate>>, (StatusCode, String)> {
    // Base query
    let mut query = String::from("SELECT * FROM test_templates WHERE organization_id = $1");
    let mut param_count = 1;

    // Filter by level
    if filters.level.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND level = ${}", param_count));
    }

    // Filter by course type
    if filters.course_type.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND course_type = ${}", param_count));
    }

    // Filter by test type
    if filters.test_type.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND test_type = ${}", param_count));
    }

    // Filter by tags (array overlap)
    if filters.tags.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND tags && ${}", param_count));
    }

    // Search in name and description
    if filters.search.is_some() {
        param_count += 1;
        query.push_str(&format!(
            " AND (name ILIKE ${0} OR description ILIKE ${0})",
            param_count
        ));
    }

    query.push_str(" ORDER BY created_at DESC");

    // Build query with dynamic binds
    let mut sql_query = sqlx::query_as::<_, TestTemplate>(&query).bind(org_ctx.id);

    if let Some(level) = &filters.level {
        sql_query = sql_query.bind(level);
    }

    if let Some(course_type) = &filters.course_type {
        sql_query = sql_query.bind(course_type);
    }

    if let Some(test_type) = &filters.test_type {
        sql_query = sql_query.bind(test_type);
    }

    if let Some(tags_str) = &filters.tags {
        let tags: Vec<String> = tags_str.split(',').map(|s| s.trim().to_string()).collect();
        sql_query = sql_query.bind(tags);
    }

    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    if let Some(ref pattern) = search_pattern {
        sql_query = sql_query.bind(pattern);
    }

    let templates = sql_query
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(templates))
}

/// GET /api/test-templates/:id - Get a specific test template with questions
pub async fn get_test_template(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<TestTemplateWithQuestions>, (StatusCode, String)> {
    // Get template
    let template: TestTemplate = sqlx::query_as(
        r#"
        SELECT id, organization_id, created_by, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_at, updated_at
        FROM test_templates
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Template not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    // Get sections
    let sections: Vec<TestTemplateSection> = sqlx::query_as(
        r#"
        SELECT id, template_id, title, description, section_order, points, instructions, section_data, created_at
        FROM test_template_sections
        WHERE template_id = $1
        ORDER BY section_order
        "#
    )
    .bind(template_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get questions
    let questions: Vec<TestTemplateQuestion> = sqlx::query_as(
        r#"
        SELECT id, template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata, created_at
        FROM test_template_questions
        WHERE template_id = $1
        ORDER BY section_id, question_order
        "#
    )
    .bind(template_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(TestTemplateWithQuestions {
        template,
        sections,
        questions,
    }))
}

// ==================== Update ====================

/// PUT /api/test-templates/:id - Update a test template
pub async fn update_test_template(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateTestTemplatePayload>,
) -> Result<Json<TestTemplate>, (StatusCode, String)> {
    let template: TestTemplate = sqlx::query_as(
        r#"
        UPDATE test_templates
        SET 
            name = COALESCE($3, name),
            description = COALESCE($4, description),
            level = COALESCE($5, level),
            course_type = COALESCE($6, course_type),
            test_type = COALESCE($7, test_type),
            duration_minutes = COALESCE($8, duration_minutes),
            passing_score = COALESCE($9, passing_score),
            total_points = COALESCE($10, total_points),
            instructions = COALESCE($11, instructions),
            template_data = COALESCE($12, template_data),
            tags = COALESCE($13, tags),
            is_active = COALESCE($14, is_active),
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, organization_id, created_by, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_at, updated_at
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .bind(payload.name)
    .bind(payload.description)
    .bind(payload.level)
    .bind(payload.course_type)
    .bind(payload.test_type)
    .bind(payload.duration_minutes)
    .bind(payload.passing_score)
    .bind(payload.total_points)
    .bind(payload.instructions)
    .bind(payload.template_data)
    .bind(payload.tags)
    .bind(payload.is_active)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Template not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    Ok(Json(template))
}

// ==================== Delete ====================

/// DELETE /api/test-templates/:id - Delete a test template
pub async fn delete_test_template(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        r#"
        DELETE FROM test_templates
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Template not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Template Questions Management ====================

/// POST /api/test-templates/:id/questions - Add a question to a template
pub async fn create_template_question(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateQuestionPayload>,
) -> Result<Json<TestTemplateQuestion>, (StatusCode, String)> {
    // Verify template exists and belongs to organization
    let exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM test_templates WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Template not found".to_string()));
    }

    let question: TestTemplateQuestion = sqlx::query_as(
        r#"
        INSERT INTO test_template_questions (
            template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata, created_at
        "#
    )
    .bind(template_id)
    .bind(payload.section_id)
    .bind(payload.question_order)
    .bind(&payload.question_type)
    .bind(&payload.question_text)
    .bind(payload.options.as_ref())
    .bind(payload.correct_answer.as_ref())
    .bind(&payload.explanation)
    .bind(payload.points)
    .bind(payload.metadata.as_ref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(question))
}

#[derive(Debug, Deserialize)]
pub struct CreateQuestionPayload {
    pub section_id: Option<Uuid>,
    pub question_order: i32,
    pub question_type: String,
    pub question_text: String,
    pub options: Option<serde_json::Value>,
    pub correct_answer: Option<serde_json::Value>,
    pub explanation: Option<String>,
    pub points: i32,
    pub metadata: Option<serde_json::Value>,
}

/// DELETE /api/test-templates/:template_id/questions/:question_id - Delete a question
pub async fn delete_template_question(
    Org(org_ctx): Org,
    Path((template_id, question_id)): Path<(Uuid, Uuid)>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verify template exists and belongs to organization
    let exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM test_templates WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Template not found".to_string()));
    }

    let result = sqlx::query(
        r#"
        DELETE FROM test_template_questions
        WHERE id = $1 AND template_id = $2
        "#
    )
    .bind(question_id)
    .bind(template_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Question not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Template Sections Management ====================

/// POST /api/test-templates/:id/sections - Add a section to a template
pub async fn create_template_section(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateSectionPayload>,
) -> Result<Json<TestTemplateSection>, (StatusCode, String)> {
    // Verify template exists
    let exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM test_templates WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Template not found".to_string()));
    }

    let section: TestTemplateSection = sqlx::query_as(
        r#"
        INSERT INTO test_template_sections (
            template_id, title, description, section_order, points, instructions, section_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, template_id, title, description, section_order, points, instructions, section_data, created_at
        "#
    )
    .bind(template_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(payload.section_order)
    .bind(payload.points)
    .bind(&payload.instructions)
    .bind(payload.section_data.as_ref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(section))
}

#[derive(Debug, Deserialize)]
pub struct CreateSectionPayload {
    pub title: String,
    pub description: Option<String>,
    pub section_order: i32,
    pub points: i32,
    pub instructions: Option<String>,
    pub section_data: Option<serde_json::Value>,
}

/// DELETE /api/test-templates/:template_id/sections/:section_id - Delete a section
pub async fn delete_template_section(
    Org(org_ctx): Org,
    Path((template_id, section_id)): Path<(Uuid, Uuid)>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        r#"
        DELETE FROM test_template_sections
        WHERE id = $1 AND template_id = $2
        "#
    )
    .bind(section_id)
    .bind(template_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Section not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Apply Template to Lesson ====================

/// POST /api/test-templates/:id/apply - Apply a template to a lesson
pub async fn apply_template_to_lesson(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ApplyTemplatePayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verify template exists and belongs to organization
    let template: TestTemplate = sqlx::query_as(
        r#"
        SELECT id, organization_id, created_by, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_at, updated_at
        FROM test_templates
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Template not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    // Verify lesson exists and belongs to organization
    let lesson_exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM lessons WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(payload.lesson_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !lesson_exists.0 {
        return Err((StatusCode::NOT_FOUND, "Lesson not found".to_string()));
    }

    // Get template questions with their sections
    let template_questions: Vec<TestTemplateQuestion> = sqlx::query_as(
        r#"
        SELECT id, template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata, created_at
        FROM test_template_questions
        WHERE template_id = $1
        ORDER BY section_id, question_order
        "#
    )
    .bind(template_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if template_questions.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Template has no questions".to_string()));
    }

    // Build quiz_data JSON from template questions
    let questions_json: Vec<serde_json::Value> = template_questions
        .iter()
        .map(|q| {
            serde_json::json!({
                "id": q.id.to_string(),
                "type": q.question_type,
                "question": q.question_text,
                "options": q.options.clone().unwrap_or(serde_json::Value::Null),
                "correct": q.correct_answer.clone().unwrap_or(serde_json::Value::Null),
                "explanation": q.explanation.clone().unwrap_or_default(),
                "points": q.points,
            })
        })
        .collect();

    let quiz_data = serde_json::json!({
        "questions": questions_json,
        "template_id": template_id.to_string(),
        "template_name": template.name,
        "test_type": template.test_type.to_string(),
        "duration_minutes": template.duration_minutes,
        "passing_score": template.passing_score,
        "total_points": template.total_points,
        "instructions": template.instructions,
        "max_attempts": 1, // Single attempt as requested
        "show_feedback": true, // Show explanations after answering
        "permanent_history": true, // Student can always view their responses
    });

    // Update lesson with quiz data and configuration
    sqlx::query(
        r#"
        UPDATE lessons 
        SET content_type = 'quiz',
            content_url = NULL,
            metadata = $1,
            is_graded = true,
            max_attempts = 1,
            allow_retry = false,
            grading_category_id = $2,
            updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        "#
    )
    .bind(&quiz_data)
    .bind(payload.grading_category_id)
    .bind(payload.lesson_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Increment template usage count
    sqlx::query("SELECT increment_template_usage($1)")
        .bind(template_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!(
        "Applied template '{}' to lesson '{}' with {} questions",
        template.name,
        payload.lesson_id,
        template_questions.len()
    );

    Ok(StatusCode::OK)
}

#[derive(Debug, Deserialize)]
pub struct ApplyTemplatePayload {
    pub lesson_id: Uuid,
    pub grading_category_id: Option<Uuid>,
}

// ==================== RAG Question Generation ====================

/// POST /api/test-templates/generate-with-rag - Generate questions using RAG from MySQL question bank
pub async fn generate_questions_with_rag(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Json(payload): Json<RagGenerationPayload>,
) -> Result<Json<Vec<TestTemplateQuestion>>, (StatusCode, String)> {
    use serde_json::json;
    
    // 1. Fetch questions from external MySQL database (RAG context)
    let mysql_url = std::env::var("MYSQL_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "MYSQL_DATABASE_URL not configured".to_string()))?;
    
    // Create MySQL pool connection
    let mysql_pool = sqlx::MySqlPool::connect(&mysql_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to MySQL: {}", e)))?;
    
    // Fetch questions from MySQL bank filtered by course if provided
    let mysql_questions: Vec<MySqlQuestion> = if let Some(course_id) = payload.course_id {
        sqlx::query_as(
            r#"
            SELECT 
                bp.descripcion, 
                bp.idTipoPregunta AS id_tipo_pregunta, 
                c.NombreCurso AS nombre_curso, 
                pe.Nombre as plan_nombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.idCursos = ? AND bp.activo = 1
            LIMIT 20
            "#
        )
        .bind(course_id)
        .fetch_all(&mysql_pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch questions: {}", e)))?
    } else {
        sqlx::query_as(
            r#"
            SELECT 
                bp.descripcion, 
                bp.idTipoPregunta AS id_tipo_pregunta, 
                c.NombreCurso AS nombre_curso, 
                pe.Nombre as plan_nombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.activo = 1
            LIMIT 20
            "#
        )
        .fetch_all(&mysql_pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch questions: {}", e)))?
    };

    mysql_pool.close().await;

    if mysql_questions.is_empty() && payload.course_id.is_some() {
        return Err((StatusCode::NOT_FOUND, "No questions found in MySQL bank for this course".to_string()));
    }

    // 2. Build RAG context from MySQL questions (lightweight format)
    let rag_context: String = mysql_questions
        .iter()
        .take(15) // Use only first 15 for context
        .map(|q| format!("* {}", q.descripcion))
        .collect::<Vec<_>>()
        .join("\n");

    tracing::info!("RAG context built with {} questions", mysql_questions.len().min(15));
    
    // 3. Call AI to generate new questions based on RAG context (Ollama only)
    let base_url = std::env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let model = std::env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
    let url = format!("{}/api/chat", base_url);
    
    // Create client with extended timeout for slower Ollama instances
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600)) // 10 minutes timeout for slower machines
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    tracing::info!("Calling Ollama at {} with model {}", url, model);

    // Simplified system prompt for better performance on slower machines
    let system_prompt = format!(
        r#"You are an English Teacher creating quiz questions.

        Use these examples as inspiration (do NOT copy):
        {}

        Create {} ORIGINAL multiple-choice questions about: {}

        Return ONLY a JSON array with this structure:
        [
            {{
                "question_text": "Question text",
                "question_type": "multiple-choice",
                "options": ["A", "B", "C", "D"],
                "correct_answer": 0,
                "explanation": "Why this is correct",
                "points": 1,
                "skill_assessed": "reading"
            }}
        ]

        Skills: reading, listening, speaking, writing. Distribute across all 4."#,
        rag_context,
        payload.num_questions.unwrap_or(5),
        payload.topic.unwrap_or_else(|| "English grammar".to_string())
    );

    tracing::debug!("System prompt length: {} chars", system_prompt.len());
    
    let request = client
        .post(&url)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": "Generate the questions in valid JSON format."
                }
            ],
            "stream": false,
            "format": "json"  // Ollama native JSON mode
        }));

    tracing::info!("Sending request to Ollama (model: {}, prompt length: {} chars)", model, system_prompt.len());
    
    let response = request.send().await.map_err(|e| {
        tracing::error!("AI request failed after timeout: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Ollama timeout - el equipo t-800 está tardando en responder. Intenta nuevamente: {}", e))
    })?;

    tracing::info!("Ollama response status: {}", response.status());

    let response_json: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Failed to parse AI response: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Invalid AI response".to_string())
    })?;

    tracing::debug!("Ollama response: {:?}", response_json);

    // Parse questions from Ollama response
    let questions_data = response_json
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|content| content.as_str())
        .and_then(|content| serde_json::from_str::<serde_json::Value>(content).ok())
        .and_then(|data| {
            if let Some(questions) = data.get("questions").or(data.get("items")) {
                questions.as_array().cloned()
            } else if let Some(arr) = data.as_array() {
                Some(arr.clone())
            } else {
                None
            }
        })
        .unwrap_or_default();
    
    // Convert to TestTemplateQuestion format
    let generated_questions: Vec<TestTemplateQuestion> = questions_data
        .iter()
        .enumerate()
        .map(|(idx, q)| {
            TestTemplateQuestion {
                id: Uuid::new_v4(),
                template_id: Uuid::nil(),
                section_id: None,
                question_order: idx as i32,
                question_type: q.get("question_type").and_then(|v| v.as_str()).unwrap_or("multiple-choice").to_string(),
                question_text: q.get("question_text").and_then(|v| v.as_str()).unwrap_or("Question").to_string(),
                options: q.get("options").cloned(),
                correct_answer: q.get("correct_answer").or(q.get("correct")).cloned(),
                explanation: q.get("explanation").and_then(|v| v.as_str()).map(String::from),
                points: q.get("points").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                metadata: Some(json!({
                    "generated_by": "rag-ai",
                    "source": "mysql-bank",
                    "generated_at": chrono::Utc::now().to_rfc3339(),
                })),
                created_at: chrono::Utc::now(),
            }
        })
        .collect();
    
    if generated_questions.is_empty() {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "AI failed to generate questions".to_string()));
    }
    
    tracing::info!("Generated {} questions using RAG from MySQL bank", generated_questions.len());
    
    Ok(Json(generated_questions))
}

#[derive(Debug, Deserialize)]
pub struct RagGenerationPayload {
    pub course_id: Option<i32>, // MySQL course ID
    pub topic: Option<String>,
    pub num_questions: Option<i32>,
}

#[derive(Debug, sqlx::FromRow)]
struct MySqlQuestion {
    descripcion: String,
    id_tipo_pregunta: i32,
    nombre_curso: String,
    plan_nombre: String,
}
