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

const QUESTION_BANK_SELECT_COLUMNS: &str = r#"
id,
organization_id,
question_text,
question_type,
options,
correct_answer,
explanation,
audio_url,
audio_text,
audio_status,
audio_metadata,
media_url,
media_type,
points,
difficulty,
tags,
skill_assessed,
source,
source_metadata,
imported_mysql_id,
imported_mysql_course_id,
usage_count,
last_used_at,
is_active,
is_archived,
created_by,
created_at,
updated_at,
embedding::text AS embedding,
embedding_updated_at,
source_asset_id,
unit_number
"#;

async fn connect_mysql_pool(env_var: &str) -> Result<sqlx::MySqlPool, (StatusCode, String)> {
    use sqlx::mysql::MySqlPoolOptions;

    let mysql_url = std::env::var(env_var)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, format!("{} not configured", env_var)))?;

    let mut last_error = String::new();

    for attempt in 1..=3 {
        let result = MySqlPoolOptions::new()
            // Keep per-request pools small to avoid exhausting remote MySQL.
            .max_connections(2)
            .min_connections(0)
            .acquire_timeout(std::time::Duration::from_secs(15))
            .idle_timeout(std::time::Duration::from_secs(30))
            .max_lifetime(std::time::Duration::from_secs(300))
            .connect(&mysql_url)
            .await;

        match result {
            Ok(pool) => return Ok(pool),
            Err(e) => {
                last_error = e.to_string();
                tracing::warn!(
                    "MySQL connection attempt {}/3 failed for {}: {}",
                    attempt,
                    env_var,
                    last_error
                );

                if attempt < 3 {
                    tokio::time::sleep(std::time::Duration::from_secs(2 * attempt)).await;
                }
            }
        }
    }

    Err((
        StatusCode::INTERNAL_SERVER_ERROR,
        format!(
            "Failed to connect to MySQL after 3 attempts: {}",
            last_error
        ),
    ))
}

// ==================== MySQL Study Plans & Courses ====================

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct MySqlStudyPlan {
    pub id: i32,
    pub mysql_id: i32,
    pub organization_id: Uuid,
    pub name: String,
    pub course_type: String,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct MySqlCourse {
    pub id: i32,
    pub mysql_id: i32,
    pub organization_id: Uuid,
    pub study_plan_id: i32,
    pub name: String,
    pub level: Option<i32>,
    pub course_type: String,
    pub level_calculated: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Save or update study plans and courses from MySQL during import
pub async fn save_mysql_courses_and_plans(
    pool: &PgPool,
    org_id: Uuid,
    plans: Vec<MySqlPlanInfo>,
    courses: Vec<MySqlCourseInfo>,
) -> Result<(), String> {
    let plans_count = plans.len();
    let courses_count = courses.len();
    tracing::info!("Saving {} study plans and {} courses from MySQL", plans_count, courses_count);
    
    // Save study plans first
    for plan in plans {
        let course_type = calculate_course_type(&plan.nombre_plan);
        tracing::debug!("Saving study plan: {} (ID: {})", plan.nombre_plan, plan.id_plan_de_estudios);

        // Mirror SAM structure in PostgreSQL using SAM-native column names.
        sqlx::query(
            r#"
            INSERT INTO sam_study_plans (organization_id, idPlanDeEstudios, Nombre, Activo)
            VALUES ($1, $2, $3, TRUE)
            ON CONFLICT (organization_id, idPlanDeEstudios) DO UPDATE SET
                Nombre = EXCLUDED.Nombre,
                Activo = EXCLUDED.Activo,
                updated_at = NOW()
            "#
        )
        .bind(org_id)
        .bind(plan.id_plan_de_estudios)
        .bind(&plan.nombre_plan)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to save SAM study plan mirror: {}", e))?;

        sqlx::query(
            r#"
            INSERT INTO mysql_study_plans (mysql_id, organization_id, name, course_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (mysql_id) DO UPDATE SET
                name = EXCLUDED.name,
                course_type = EXCLUDED.course_type,
                updated_at = NOW()
            "#
        )
        .bind(plan.id_plan_de_estudios)
        .bind(org_id)
        .bind(&plan.nombre_plan)
        .bind(&course_type)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to save study plan: {}", e))?;
    }

    // Save courses
    for course in courses {
        // Determine course_type from duration (40h = regular, 80h = intensive)
        let course_type = calculate_course_type_from_duration(course.duracion);
        let level_calculated = calculate_course_level(course.nivel_curso);
        tracing::debug!("Saving course: {} (ID: {}, Plan ID: {})", course.nombre_curso, course.id_cursos, course.id_plan_de_estudios);

        sqlx::query(
            r#"
            INSERT INTO sam_courses (
                organization_id, idCursos, idPlanDeEstudios, NombreCurso, NivelCurso, Duracion, Activo
            )
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            ON CONFLICT (organization_id, idCursos) DO UPDATE SET
                idPlanDeEstudios = EXCLUDED.idPlanDeEstudios,
                NombreCurso = EXCLUDED.NombreCurso,
                NivelCurso = EXCLUDED.NivelCurso,
                Duracion = EXCLUDED.Duracion,
                Activo = EXCLUDED.Activo,
                updated_at = NOW()
            "#,
        )
        .bind(org_id)
        .bind(course.id_cursos)
        .bind(course.id_plan_de_estudios)
        .bind(&course.nombre_curso)
        .bind(course.nivel_curso)
        .bind(course.duracion)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to save SAM course mirror: {}", e))?;

        // Get study_plan_id from mysql_study_plans
        let study_plan_id: i32 = sqlx::query_scalar(
            "SELECT id FROM mysql_study_plans WHERE mysql_id = $1 AND organization_id = $2"
        )
        .bind(course.id_plan_de_estudios)
        .bind(org_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to find study plan: {}", e))?;

        sqlx::query(
            r#"
            INSERT INTO mysql_courses (
                mysql_id, organization_id, study_plan_id, name, level, duracion,
                course_type, level_calculated
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (mysql_id) DO UPDATE SET
                name = EXCLUDED.name,
                level = EXCLUDED.level,
                duracion = EXCLUDED.duracion,
                course_type = EXCLUDED.course_type,
                level_calculated = EXCLUDED.level_calculated,
                updated_at = NOW()
            "#
        )
        .bind(course.id_cursos)
        .bind(org_id)
        .bind(study_plan_id)
        .bind(&course.nombre_curso)
        .bind(course.nivel_curso)
        .bind(course.duracion)
        .bind(&course_type)
        .bind(&level_calculated)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to save course: {}", e))?;
    }

    tracing::info!("Successfully saved {} study plans and {} courses", plans_count, courses_count);
    Ok(())
}

fn calculate_course_type(plan_name: &str) -> String {
    let plan_lower = plan_name.to_lowercase();
    if plan_lower.contains("intensive") || plan_lower.contains("intensivo") {
        "intensive".to_string()
    } else {
        "regular".to_string()
    }
}

fn calculate_course_type_from_duration(duracion: Option<f64>) -> String {
    match duracion {
        Some(d) if d as i64 >= 70 => "intensive".to_string(),  // 80h or more = intensive
        _ => "regular".to_string(),  // 40h or less = regular
    }
}

fn calculate_course_level(nivel: Option<i32>) -> String {
    match nivel {
        None => "intermediate".to_string(),
        Some(n) if n <= 2 => "beginner".to_string(),
        Some(n) if n <= 4 => "beginner_1".to_string(),
        Some(n) if n <= 6 => "beginner_2".to_string(),
        Some(n) if n <= 8 => "intermediate".to_string(),
        Some(n) if n <= 10 => "intermediate_1".to_string(),
        Some(n) if n <= 12 => "intermediate_2".to_string(),
        Some(_) => "advanced".to_string(),
    }
}

// ==================== Create ====================

/// POST /api/question-bank - Create a new question in the bank
pub async fn create_question(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateQuestionBankPayload>,
) -> Result<Json<QuestionBank>, (StatusCode, String)> {
    let create_question_sql = format!(
        r#"
        INSERT INTO question_bank (
            organization_id, created_by, question_text, question_type,
            options, correct_answer, explanation, points, difficulty,
            tags, skill_assessed, media_url, media_type, audio_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
        RETURNING {}
        "#,
        QUESTION_BANK_SELECT_COLUMNS
    );

    let question: QuestionBank = sqlx::query_as(
        &create_question_sql
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
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    } else if filters.question_type.is_some() {
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND question_type = $2 ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .bind(filters.question_type.unwrap())
        .fetch_all(&pool)
        .await
    } else if filters.difficulty.is_some() {
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND difficulty = $2 ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .bind(filters.difficulty.as_ref().unwrap())
        .fetch_all(&pool)
        .await
    } else if filters.source.is_some() {
        let source_filter = filters.source.as_ref().unwrap().to_lowercase();
        match source_filter.as_str() {
            "mysql" => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source IN ('imported-mysql', 'sam-diagnostico') ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
            }
            "materials" | "materials-zip" => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source = 'imported-material' ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
            }
            "ai" => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source = 'ai-generated' ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
            }
            _ => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source = $2 ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .bind(filters.source.as_ref().unwrap())
                .fetch_all(&pool)
                .await
            }
        }
    } else if filters.has_audio == Some(true) {
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND audio_status = 'ready' ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    } else {
        // Default fallback
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
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
    let get_question_sql = format!(
        r#"
        SELECT {} FROM question_bank
        WHERE id = $1 AND organization_id = $2 AND is_archived = false
        "#,
        QUESTION_BANK_SELECT_COLUMNS
    );

    let question: QuestionBank = sqlx::query_as(
        &get_question_sql
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
    let update_question_sql = format!(
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
        RETURNING {}
        "#,
        QUESTION_BANK_SELECT_COLUMNS
    );

    let question: QuestionBank = sqlx::query_as(
        &update_question_sql
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
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;

    // Fetch all study plans and courses from MySQL to sync them
    let mysql_plans: Vec<MySqlPlanInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan
        FROM plandeestudios pe
        WHERE pe.Activo = 1
        ORDER BY pe.Nombre
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| {
        let error_msg = format!("Failed to fetch: {}", e);
        tracing::error!("MySQL Error: {}", error_msg);
        tracing::error!("Check column names in your MySQL database (plandeestudios, curso tables)");
        (StatusCode::INTERNAL_SERVER_ERROR, error_msg)
    })?;

    tracing::info!("Fetched {} study plans from MySQL", mysql_plans.len());

    let mysql_courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.Activo = 1
          AND pe.Activo = 1
        ORDER BY pe.Nombre, c.NivelCurso
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch courses: {}", e)))?;

    tracing::info!("Fetched {} courses from MySQL", mysql_courses.len());

    // Save plans and courses to PostgreSQL
    tracing::info!("Saving plans and courses to PostgreSQL...");
    save_mysql_courses_and_plans(&pool, org_ctx.id, mysql_plans, mysql_courses)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to save courses/plans: {}", e)))?;

    // Fetch questions from MySQL
    let mysql_questions: Vec<MySqlQuestion> = if payload.import_all.unwrap_or(false) {
        // Import ALL questions (no limit)
        sqlx::query_as(
            r#"
            SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                   c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.activo = 1
              AND c.Activo = 1
              AND pe.Activo = 1
            ORDER BY bp.idPregunta
            "#
        )
        .fetch_all(&mysql_pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch questions: {}", e)))?
    } else if let Some(course_id) = payload.mysql_course_id {
        // Import all questions for a specific course (no limit)
        sqlx::query_as(
            r#"
            SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                   c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.idCursos = ? AND bp.activo = 1
              AND c.Activo = 1
              AND pe.Activo = 1
            ORDER BY bp.idPregunta
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
                  AND c.Activo = 1
                  AND pe.Activo = 1
                "#
            )
            .bind(q_id)
            .fetch_optional(&mysql_pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch question {}: {}", q_id, e)))?;
            
            if let Some(question) = mq {
                // Map MySQL question type to platform question type
                let question_type = map_mysql_question_type(question.id_tipo_pregunta, None);

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
                    &format!(
                        r#"
                        INSERT INTO question_bank (
                            organization_id, created_by, question_text, question_type,
                            options, correct_answer, source, source_metadata,
                            audio_status, is_active
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, 'pending', true)
                        RETURNING {}
                        "#,
                        QUESTION_BANK_SELECT_COLUMNS
                    )
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
        let question_type = map_mysql_question_type(mq.id_tipo_pregunta, None);

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
            &format!(
                r#"
                INSERT INTO question_bank (
                    organization_id, created_by, question_text, question_type,
                    options, correct_answer, source, source_metadata,
                    imported_mysql_id, imported_mysql_course_id,
                    audio_status, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, $8, $9, 'pending', true)
                RETURNING {}
                "#,
                QUESTION_BANK_SELECT_COLUMNS
            )
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

// ==================== Helpers ====================

fn map_mysql_question_type(mysql_type: i32, tipo_nombre: Option<&str>) -> QuestionBankType {
    // Map MySQL question types to platform types
    // First try by name, then by ID as fallback
    if let Some(nombre) = tipo_nombre {
        let nombre_lower = nombre.to_lowercase();
        if nombre_lower.contains("selecc") || nombre_lower.contains("múltiple") || nombre_lower.contains("multiple") || nombre_lower.contains("alternativa") {
            return QuestionBankType::MultipleChoice;
        }
        if nombre_lower.contains("verdadero") || nombre_lower.contains("falso") {
            return QuestionBankType::TrueFalse;
        }
        if nombre_lower.contains("emparej") || nombre_lower.contains("match") {
            return QuestionBankType::Matching;
        }
        if nombre_lower.contains("orden") {
            return QuestionBankType::Ordering;
        }
        if nombre_lower.contains("complet") {
            return QuestionBankType::FillInTheBlanks;
        }
        if nombre_lower.contains("ensayo") || nombre_lower.contains("essay") {
            return QuestionBankType::Essay;
        }
        if nombre_lower.contains("corta") || nombre_lower.contains("short") || nombre_lower.contains("texto") {
            return QuestionBankType::ShortAnswer;
        }
        // Audio type in MySQL is typically listening comprehension with multiple choice answers
        if nombre_lower.contains("audio") || nombre_lower.contains("listening") {
            return QuestionBankType::MultipleChoice;
        }
    }

    // Fallback to ID mapping
    match mysql_type {
        1 => QuestionBankType::MultipleChoice, // Alternativa
        2 => QuestionBankType::MultipleChoice, // Audio (listening comprehension)
        3 => QuestionBankType::ShortAnswer,    // Texto
        4 => QuestionBankType::Matching,
        5 => QuestionBankType::Ordering,
        6 => QuestionBankType::FillInTheBlanks,
        7 => QuestionBankType::Essay,
        _ => QuestionBankType::MultipleChoice,
    }
}

/// Parse MySQL answers JSON and extract options and correct answer
fn parse_mysql_answers(
    answers_json: Option<&str>,
    question_type: QuestionBankType,
) -> (Option<serde_json::Value>, Option<serde_json::Value>) {
    if let Some(json_str) = answers_json {
        if let Ok(answers) = serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
            if !answers.is_empty() {
                // Extract options (all answer texts)
                let options: Vec<String> = answers
                    .iter()
                    .filter_map(|a| a.get("texto").and_then(|t| t.as_str()).map(String::from))
                    .collect();
                
                // Extract correct answer(s)
                let correct_indices: Vec<usize> = answers
                    .iter()
                    .enumerate()
                    .filter(|(_, a)| a.get("es_correcta").and_then(|c| c.as_bool()).unwrap_or(false))
                    .map(|(i, _)| i)
                    .collect();
                
                let options_json = if !options.is_empty() {
                    Some(serde_json::json!(options))
                } else {
                    None
                };
                
                let correct_answer = if question_type == QuestionBankType::TrueFalse || 
                    question_type == QuestionBankType::MultipleChoice {
                    // For multiple choice, store index/indices
                    if correct_indices.len() == 1 {
                        Some(serde_json::json!(correct_indices[0]))
                    } else if correct_indices.len() > 1 {
                        Some(serde_json::json!(correct_indices))
                    } else {
                        Some(serde_json::json!(0)) // Default to first
                    }
                } else {
                    // For other types, store the text
                    correct_indices.first()
                        .and_then(|&i| answers.get(i))
                        .and_then(|a| a.get("texto").and_then(|t| t.as_str()))
                        .map(|t| serde_json::json!(t))
                };
                
                return (options_json, correct_answer);
            }
        }
    }
    
    // Default values if no answers provided
    let default_options = match question_type {
        QuestionBankType::MultipleChoice => Some(serde_json::json!(["Opción A", "Opción B", "Opción C", "Opción D"])),
        QuestionBankType::TrueFalse => Some(serde_json::json!(["Verdadero", "Falso"])),
        _ => None,
    };
    
    (default_options, Some(serde_json::json!(0)))
}

// ==================== MySQL Integration ====================

/// GET /api/question-bank/mysql-courses - List courses from MySQL for import
pub async fn list_mysql_courses(
    Org(_org_ctx): Org,
    State(_pool): State<PgPool>,
) -> Result<Json<Vec<MySqlCourseInfo>>, (StatusCode, String)> {
    // Connect to MySQL
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;
    
    // Fetch courses with their plan names
    let courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.Activo = 1
          AND pe.Activo = 1
        ORDER BY pe.Nombre, c.NivelCurso
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch courses: {}", e)))?;
    
    mysql_pool.close().await;
    
    Ok(Json(courses))
}

/// GET /api/question-bank/mysql-plans - Get all study plans from PostgreSQL (imported from MySQL)
pub async fn get_mysql_plans(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<MySqlPlanInfo>>, (StatusCode, String)> {
    // Read from SAM mirror in PostgreSQL with SAM-native fields.
    let mut plans: Vec<MySqlPlanInfo> = sqlx::query_as(
        r#"
        SELECT
            idPlanDeEstudios AS id_plan_de_estudios,
            Nombre AS nombre_plan
        FROM sam_study_plans
        WHERE organization_id = $1 AND Activo = TRUE
        ORDER BY Nombre
        "#
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch plans: {}", e)))?;

    // Backward-compatible fallback: if SAM mirror is empty, use legacy metadata mirror.
    if plans.is_empty() {
        plans = sqlx::query_as(
            r#"
            SELECT
                mysql_id AS id_plan_de_estudios,
                name AS nombre_plan
            FROM mysql_study_plans
            WHERE organization_id = $1 AND is_active = TRUE
            ORDER BY name
            "#,
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch legacy plans: {}", e)))?;
    }

    // Last-resort auto-sync: if still empty, pull metadata from MySQL and persist it.
    if plans.is_empty() {
        match connect_mysql_pool("MYSQL_DATABASE_URL").await {
            Ok(mysql_pool) => {
                let mysql_plans: Result<Vec<MySqlPlanInfo>, sqlx::Error> = sqlx::query_as(
                    r#"
                    SELECT DISTINCT
                        pe.idPlanDeEstudios AS id_plan_de_estudios,
                        pe.Nombre AS nombre_plan
                    FROM plandeestudios pe
                    WHERE pe.Activo = 1
                    ORDER BY pe.Nombre
                    "#,
                )
                .fetch_all(&mysql_pool)
                .await;

                let mysql_courses: Result<Vec<MySqlCourseInfo>, sqlx::Error> = sqlx::query_as(
                    r#"
                    SELECT DISTINCT
                        c.idCursos AS id_cursos,
                        c.NombreCurso AS nombre_curso,
                        c.NivelCurso AS nivel_curso,
                        pe.idPlanDeEstudios AS id_plan_de_estudios,
                        pe.Nombre AS nombre_plan,
                        c.Duracion AS duracion
                    FROM curso c
                    JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
                    WHERE c.Activo = 1
                      AND pe.Activo = 1
                    ORDER BY pe.Nombre, c.NivelCurso
                    "#,
                )
                .fetch_all(&mysql_pool)
                .await;

                match (mysql_plans, mysql_courses) {
                    (Ok(p), Ok(c)) => {
                        if let Err(err) = save_mysql_courses_and_plans(&pool, org_ctx.id, p, c).await {
                            tracing::warn!("Auto-sync MySQL metadata failed: {}", err);
                        }
                    }
                    (Err(e), _) => tracing::warn!("Auto-sync plans query failed: {}", e),
                    (_, Err(e)) => tracing::warn!("Auto-sync courses query failed: {}", e),
                }

                mysql_pool.close().await;
            }
            Err(e) => {
                tracing::warn!("Auto-sync could not connect to MySQL: {:?}", e);
            }
        }

        // Reload plans after auto-sync attempt.
        plans = sqlx::query_as(
            r#"
            SELECT
                idPlanDeEstudios AS id_plan_de_estudios,
                Nombre AS nombre_plan
            FROM sam_study_plans
            WHERE organization_id = $1 AND Activo = TRUE
            ORDER BY Nombre
            "#,
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        if plans.is_empty() {
            plans = sqlx::query_as(
                r#"
                SELECT
                    mysql_id AS id_plan_de_estudios,
                    name AS nombre_plan
                FROM mysql_study_plans
                WHERE organization_id = $1 AND is_active = TRUE
                ORDER BY name
                "#,
            )
            .bind(org_ctx.id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default();
        }
    }

    Ok(Json(plans))
}

/// GET /api/question-bank/mysql-courses - Get courses filtered by plan from PostgreSQL
pub async fn get_mysql_courses_by_plan(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<MySqlCoursesFilters>,
) -> Result<Json<Vec<MySqlCourseInfo>>, (StatusCode, String)> {
    // Read from SAM mirror in PostgreSQL with SAM-native fields.
    let mut courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            c.idPlanDeEstudios AS id_plan_de_estudios,
            p.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM sam_courses c
        JOIN sam_study_plans p
          ON p.organization_id = c.organization_id
         AND p.idPlanDeEstudios = c.idPlanDeEstudios
        WHERE c.organization_id = $1
          AND c.Activo = TRUE
          AND p.Activo = TRUE
          AND c.idPlanDeEstudios = $2
        ORDER BY c.NivelCurso
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.plan_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch courses: {}", e)))?;

    // Backward-compatible fallback: if SAM mirror is empty, use legacy metadata mirror.
    if courses.is_empty() {
        courses = sqlx::query_as(
            r#"
            SELECT
                c.mysql_id AS id_cursos,
                c.name AS nombre_curso,
                c.level AS nivel_curso,
                sp.mysql_id AS id_plan_de_estudios,
                sp.name AS nombre_plan,
                c.duracion::double precision AS duracion
            FROM mysql_courses c
            JOIN mysql_study_plans sp ON c.study_plan_id = sp.id
            WHERE c.organization_id = $1
              AND c.is_active = TRUE
              AND sp.is_active = TRUE
              AND sp.mysql_id = $2
            ORDER BY c.level
            "#,
        )
        .bind(org_ctx.id)
        .bind(filters.plan_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch legacy courses: {}", e)))?;
    }

    Ok(Json(courses))
}

#[derive(Debug, Deserialize)]
pub struct MySqlCoursesFilters {
    pub plan_id: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MySqlPlanInfo {
    pub id_plan_de_estudios: i32,
    pub nombre_plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MySqlCourseInfo {
    pub id_cursos: i32,
    pub nombre_curso: String,
    pub nivel_curso: Option<i32>,
    pub id_plan_de_estudios: i32,
    pub nombre_plan: String,
    pub duracion: Option<f64>,  // Duration in hours (40=regular, 80=intensive) - MySQL float type
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportAllFromMySQLPayload {
    pub import_metadata_only: Option<bool>,  // Only import metadata (courses/plans), not questions
}

/// POST /api/question-bank/import-mysql-all - Import ALL questions from MySQL (bulk import)
pub async fn import_all_from_mysql(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    body: String,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    use serde_json::json;

    // Parse optional JSON body
    let import_metadata_only = if body.trim().is_empty() {
        false
    } else {
        serde_json::from_str::<ImportAllFromMySQLPayload>(&body)
            .map(|p| p.import_metadata_only.unwrap_or(false))
            .unwrap_or(false)
    };

    // Connect to MySQL
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;

    // Fetch all study plans and courses from MySQL to sync them
    let mysql_plans: Vec<MySqlPlanInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan
        FROM plandeestudios pe
        WHERE pe.Activo = 1
        ORDER BY pe.Nombre
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| {
        let error_msg = format!("Failed to fetch: {}", e);
        tracing::error!("MySQL Error: {}", error_msg);
        tracing::error!("Check column names in your MySQL database (plandeestudios, curso tables)");
        (StatusCode::INTERNAL_SERVER_ERROR, error_msg)
    })?;

    tracing::info!("Fetched {} study plans from MySQL", mysql_plans.len());

    let mysql_courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.Activo = 1
          AND pe.Activo = 1
        ORDER BY pe.Nombre, c.NivelCurso
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch courses: {}", e)))?;

    tracing::info!("Fetched {} courses from MySQL", mysql_courses.len());

    // Save plans and courses to PostgreSQL
    tracing::info!("Saving plans and courses to PostgreSQL...");
    save_mysql_courses_and_plans(&pool, org_ctx.id, mysql_plans.clone(), mysql_courses.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to save courses/plans: {}", e)))?;

    // If only metadata import is requested, return early
    if import_metadata_only {
        return Ok(Json(json!({
            "success": true,
            "message": "Metadatos importados exitosamente",
            "metadata": {
                "study_plans_imported": mysql_plans.len(),
                "courses_imported": mysql_courses.len(),
                "courses": mysql_courses.iter().map(|c| json!({
                    "id_cursos": c.id_cursos,
                    "nombre_curso": c.nombre_curso,
                    "nombre_plan": c.nombre_plan,
                    "duracion": c.duracion,
                    "nivel_curso": c.nivel_curso
                })).collect::<Vec<_>>()
            }
        })));
    }

    // Fetch ALL questions from MySQL with answers (using JSON aggregation for answers)
    let mysql_questions: Vec<MySqlQuestionFull> = sqlx::query_as(
        r#"
        SELECT
            bp.idPregunta AS id_pregunta,
            bp.descripcion AS descripcion,
            bp.idTipoPregunta AS id_tipo_pregunta,
            bp.activo AS activo,
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS plan_nombre,
            tp.descripcion AS tipo_pregunta_nombre,
            CAST(
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'idRespuesta', br.idRespuesta,
                            'texto', br.descripcion,
                            'es_correcta', br.resultado = 1
                        )
                    )
                    FROM bancorespuestas br
                    WHERE br.idPregunta = bp.idPregunta
                    AND br.activo = 1
                ) AS CHAR
            ) AS respuestas_json
        FROM bancopreguntas bp
        JOIN curso c ON bp.idCursos = c.idCursos
        JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
        JOIN tipopregunta tp ON bp.idTipoPregunta = tp.idTipoPregunta
        WHERE bp.activo = 1
          AND pe.Activo = 1
          AND c.Activo = 1
        ORDER BY pe.Nombre, c.NombreCurso, bp.idPregunta
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch questions: {}", e)))?;
    
    mysql_pool.close().await;

    if mysql_questions.is_empty() {
        return Ok(Json(json!({
            "success": false,
            "imported": 0,
            "skipped": 0,
            "updated": 0,
            "error": "No questions found in MySQL"
        })));
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
                // New question - insert with answers from MySQL
                let question_type = map_mysql_question_type(mq.id_tipo_pregunta, mq.tipo_pregunta_nombre.as_deref());
                
                // Parse answers from MySQL
                let (options, correct_answer) = parse_mysql_answers(mq.respuestas_json.as_deref(), question_type);

                let has_answers = mq.respuestas_json.is_some();
                let question_type_name = mq.tipo_pregunta_nombre.clone();
                
                let source_metadata = serde_json::json!({
                    "mysql_table": "bancopreguntas",
                    "idPregunta": mq.id_pregunta,
                    "idCursos": mq.id_cursos,
                    "nombre_curso": mq.nombre_curso,
                    "nivel_curso": mq.nivel_curso,
                    "idPlanDeEstudios": mq.id_plan_de_estudios,
                    "plan_nombre": mq.plan_nombre,
                    "idTipoPregunta": mq.id_tipo_pregunta,
                    "tipo_pregunta_nombre": question_type_name,
                    "imported_at": chrono::Utc::now().to_rfc3339(),
                    "import_method": "bulk_import_all",
                    "has_answers": has_answers,
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
                .bind(&correct_answer)
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

    Ok(Json(json!({
        "success": true,
        "imported": imported_count,
        "skipped": skipped_count,
        "updated": updated_count,
        "metadata": {
            "study_plans_imported": mysql_plans.len(),
            "courses_imported": mysql_courses.len()
        }
    })))
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: i32,
    pub skipped: i32,
    pub updated: i32,
    pub error: Option<String>,
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
    pub respuestas_json: Option<String>, // JSON array de respuestas
    pub tipo_pregunta_nombre: Option<String>, // Nombre del tipo de pregunta
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

// ==================== AI Generation ====================

#[derive(Debug, Deserialize)]
pub struct AIGenerateQuestionPayload {
    pub question_text: Option<String>,
    pub question_type: Option<String>,
    pub difficulty: Option<String>,
    pub skill: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIQuestionResponse {
    pub question_text: String,
    pub options: Vec<String>,
    pub correct_answer: serde_json::Value,
    pub explanation: String,
}

/// POST /question-bank/ai-generate - Generate question options/answers using AI (Ollama only)
pub async fn ai_generate_question(
    _org_ctx: Org,
    _claims: Claims,
    Json(payload): Json<AIGenerateQuestionPayload>,
) -> Result<Json<AIQuestionResponse>, (StatusCode, String)> {
    use std::env;
    use std::time::Duration;

    let question_text = payload.question_text.unwrap_or_else(|| "English grammar question".to_string());
    let difficulty = payload.difficulty.unwrap_or_else(|| "medium".to_string());
    let skill = payload.skill.unwrap_or_else(|| "grammar".to_string());

    // Build prompt for AI
    let system_prompt = format!(
        r#"You are an expert English Teacher creating quiz questions.

        Create a multiple-choice question with the following parameters:
        - Topic/Context: {}
        - Difficulty: {}
        - Skill assessed: {}

        Return ONLY a JSON object with this exact structure:
        {{
            "question_text": "The question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 0,
            "explanation": "Detailed explanation of why this is correct"
        }}"#,
        question_text, difficulty, skill
    );

    // Call Ollama AI with extended timeout
    let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
    let url = format!("{}/api/chat", base_url);
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600)) // 10 minutes timeout for slower machines
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    tracing::info!("Calling Ollama at {} with model {}", url, model);

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": "Generate the question in JSON format" }
            ],
            "stream": false,
            "format": "json"
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("AI request failed: {}", e)))?;

    if !response.status().is_success() {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("AI API error: {}", response.status())));
    }

    let result: serde_json::Value = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse AI response: {}", e)))?;

    // Extract content from Ollama response
    let content = result
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Invalid AI response format".to_string()))?;

    // Parse AI response as JSON
    let ai_question: AIQuestionResponse = serde_json::from_str(content)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse question JSON: {}", e)))?;

    Ok(Json(ai_question))
}

// ==================== Import Courses from MySQL ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportCourseFromMySQLPayload {
    pub mysql_course_id: i32,
    pub title: Option<String>,        // Optional custom title (defaults to MySQL course name)
    pub description: Option<String>,  // Optional description
    pub pacing_mode: Option<String>,  // self_paced or instructor_led
}

#[derive(Debug, Serialize)]
pub struct ImportCourseResult {
    pub course_id: Uuid,
    pub course_title: String,
    pub mysql_course_id: i32,
    pub modules_created: i32,
    pub lessons_created: i32,
    pub message: String,
}

/// POST /api/question-bank/import-course-mysql - Import a course from MySQL with basic structure
pub async fn import_course_from_mysql(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ImportCourseFromMySQLPayload>,
) -> Result<Json<ImportCourseResult>, (StatusCode, String)> {
    use common::models::Course;

    // Connect to MySQL
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;

    // Fetch course info from MySQL
    let mysql_course: MySqlCourseInfo = sqlx::query_as(
        r#"
        SELECT 
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.idCursos = ? AND c.Activo = 1 AND pe.Activo = 1
        "#
    )
    .bind(payload.mysql_course_id)
    .fetch_one(&mysql_pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::RowNotFound = e {
            (StatusCode::NOT_FOUND, format!("Course with ID {} not found in MySQL", payload.mysql_course_id))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch course from MySQL: {}", e))
        }
    })?;

    tracing::info!("Importing course from MySQL: {} (ID: {})", mysql_course.nombre_curso, mysql_course.id_cursos);

    // Start transaction
    let mut tx = pool.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to start transaction: {}", e)))?;

    // Determine course type and level for structure generation
    let course_type = calculate_course_type_from_duration(mysql_course.duracion);
    let level = calculate_course_level(mysql_course.nivel_curso);
    
    tracing::info!("Course type: {}, Level: {}", course_type, level);

    // Create course in PostgreSQL
    let course_title = payload.title.unwrap_or_else(|| format!("{} ({})", mysql_course.nombre_curso, mysql_course.nombre_plan));
    let pacing_mode = payload.pacing_mode.unwrap_or_else(|| "self_paced".to_string());
    let description = payload.description.unwrap_or_else(|| format!("Curso importado desde MySQL - Plan: {}", mysql_course.nombre_plan));

    let new_course: Course = sqlx::query_as(
        r#"
        INSERT INTO courses (
            organization_id, instructor_id, title, pacing_mode, description,
            passing_percentage, certificate_template, imported_mysql_course_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(&course_title)
    .bind(&pacing_mode)
    .bind(&description)
    .bind(60.0)  // Default passing percentage
    .bind(serde_json::json!({
        "template": "default",
        "show_logo": true,
        "show_instructor": true
    }))
    .bind(mysql_course.id_cursos)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create course: {}", e)))?;

    tracing::info!("Created course in PostgreSQL: {}", new_course.id);

    // Generate basic course structure based on course type and level
    let (modules_count, lessons_count) = generate_course_structure(
        &mut tx,
        new_course.id,
        org_ctx.id,
        &course_type,
        &level,
        &mysql_course.nombre_curso,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // Commit transaction
    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to commit transaction: {}", e)))?;

    tracing::info!(
        "Successfully imported course {} with {} modules and {} lessons",
        new_course.id,
        modules_count,
        lessons_count
    );

    Ok(Json(ImportCourseResult {
        course_id: new_course.id,
        course_title: new_course.title.clone(),
        mysql_course_id: mysql_course.id_cursos,
        modules_created: modules_count,
        lessons_created: lessons_count,
        message: format!("Curso '{}' importado exitosamente con {} módulos y {} lecciones",
            new_course.title, modules_count, lessons_count),
    }))
}

/// Generate basic course structure based on type and level
async fn generate_course_structure<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Postgres>,
    course_id: Uuid,
    org_id: Uuid,
    course_type: &str,
    level: &str,
    course_name: &str,
) -> Result<(i32, i32), String> {
    // Define module structure based on course type
    // Regular (40h): 4 modules
    // Intensive (80h): 8 modules
    let modules_config = match course_type {
        "intensive" => vec![
            ("Fundamentos Básicos", 6),
            ("Gramática Esencial", 6),
            ("Vocabulario Intermedio", 6),
            ("Comprensión Auditiva", 6),
            ("Expresión Oral", 6),
            ("Lectura y Escritura", 6),
            ("Práctica Avanzada", 6),
            ("Proyecto Final", 4),
        ],
        _ => vec![
            ("Introducción y Fundamentos", 5),
            ("Gramática Básica", 5),
            ("Vocabulario Esencial", 5),
            ("Práctica Integradora", 5),
        ],
    };

    let mut total_modules = 0;
    let mut total_lessons = 0;

    for (module_idx, (module_name, lessons_count)) in modules_config.iter().enumerate() {
        // Create module
        let module: common::models::Module = sqlx::query_as(
            r#"
            INSERT INTO modules (course_id, organization_id, title, position)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#
        )
        .bind(course_id)
        .bind(org_id)
        .bind(format!("Módulo {}: {}", module_idx + 1, module_name))
        .bind(module_idx as i32)
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| format!("Failed to create module {}: {}", module_idx + 1, e))?;

        total_modules += 1;

        // Create lessons for this module
        for lesson_idx in 0..*lessons_count {
            let lesson_position = (module_idx * lessons_count + lesson_idx) as i32;
            let lesson_title = format!("Lección {}.{}", module_idx + 1, lesson_idx + 1);
            
            // Determine content type based on position (rotate through types)
            let content_types = ["video", "document", "interactive", "quiz"];
            let content_type = content_types[lesson_idx % content_types.len()];

            sqlx::query(
                r#"
                INSERT INTO lessons (
                    module_id, organization_id, title, content_type,
                    content_url, position, is_graded, summary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                "#
            )
            .bind(module.id)
            .bind(org_id)
            .bind(&lesson_title)
            .bind(content_type)
            .bind("")  // Empty content URL (to be filled by instructor)
            .bind(lesson_position)
            .bind(lesson_idx % 4 == 3)  // Every 4th lesson is graded (quiz)
            .bind(format!("Contenido de la lección: {}", lesson_title))
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("Failed to create lesson {}: {}", lesson_position, e))?;

            total_lessons += 1;
        }
    }

    Ok((total_modules, total_lessons))
}

// ==================== Import from SAM Diagnostico ====================

/// Row retornada por GROUP BY sobre las tablas de SAM_diagnostico
#[derive(Debug, sqlx::FromRow)]
struct SamDiagnosticoQuestion {
    pub id_test: i32,
    pub id_curso: i32,
    pub id_pregunta: i32,
    pub pregunta_nombre: Option<String>,
    pub tipo_pregunta: Option<String>,
    /// Opciones separadas por '|||' (GROUP_CONCAT)
    pub opciones: Option<String>,
    /// Texto de la respuesta correcta (valorRespuesta = 1)
    pub respuesta_correcta: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct ImportSamDiagnosticoPayload {
    /// "adultos", "kids", "teens" o null para importar las tres audiencias
    pub audience: Option<String>,
    /// Filtra por idTest específico (opcional)
    pub test_id: Option<i32>,
    /// Filtra por idCurso específico (opcional)
    pub curso_id: Option<i32>,
}

/// POST /api/question-bank/import-sam-diagnostico
/// Importa preguntas desde las tablas SAM_diagnostico (preguntasadultos,
/// preguntaskid, preguntasteens) al banco de preguntas de PostgreSQL.
pub async fn import_from_sam_diagnostico(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ImportSamDiagnosticoPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    use serde_json::json;

    let mysql_pool = connect_mysql_pool("SAM_DIAGNOSTICO_DATABASE_URL").await?;

    // Determinar qué tablas procesar según la audiencia solicitada
    let tables: Vec<(&str, &str)> = match payload.audience.as_deref() {
        Some("adultos") => vec![("adultos", "preguntasadultos")],
        Some("kids")    => vec![("kids",    "preguntaskid")],
        Some("teens")   => vec![("teens",   "preguntasteens")],
        _               => vec![
            ("adultos", "preguntasadultos"),
            ("kids",    "preguntaskid"),
            ("teens",   "preguntasteens"),
        ],
    };

    let mut total_imported: i64 = 0;
    let mut total_skipped: i64  = 0;
    let mut errors: Vec<String> = Vec::new();

    for (audience_label, table_name) in &tables {
        // GROUP_CONCAT agrupa todas las opciones de cada pregunta en una sola fila.
        // El separador '|||' no puede aparecer en los textos de respuesta normales.
        let base_query = format!(
            r#"
            SELECT
                idTest                                                          AS id_test,
                idCurso                                                         AS id_curso,
                idPregunta                                                      AS id_pregunta,
                CAST(MAX(preguntaNombre) AS CHAR CHARACTER SET utf8mb4)        AS pregunta_nombre,
                CAST(MAX(tipoPregunta) AS CHAR CHARACTER SET utf8mb4)          AS tipo_pregunta,
                GROUP_CONCAT(
                    CAST(respuestaNombre AS CHAR CHARACTER SET utf8mb4)
                    ORDER BY idOpcion
                    SEPARATOR '|||'
                )                                                               AS opciones,
                CAST(MAX(CASE WHEN valorRespuesta = 1 THEN respuestaNombre ELSE NULL END) AS CHAR CHARACTER SET utf8mb4)
                                                                                AS respuesta_correcta
            FROM {}
            WHERE 1=1
            {}
            {}
            GROUP BY idTest, idCurso, idPregunta
            ORDER BY idTest, idCurso, idPregunta
            "#,
            table_name,
            if payload.test_id.is_some()  { "AND idTest  = ?"  } else { "" },
            if payload.curso_id.is_some() { "AND idCurso = ?"  } else { "" },
        );

        // Bind parámetros opcionales de forma dinámica
        let rows: Vec<SamDiagnosticoQuestion> = {
            let mut q = sqlx::query_as::<_, SamDiagnosticoQuestion>(&base_query);
            if let Some(tid) = payload.test_id  { q = q.bind(tid); }
            if let Some(cid) = payload.curso_id { q = q.bind(cid); }
            q.fetch_all(&mysql_pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Failed to fetch from {}: {}", table_name, e),
                    )
                })?
        };

        tracing::info!(
            "SAM_diagnostico {}: {} preguntas encontradas",
            table_name, rows.len()
        );

        for question in rows {
            let question_text = match &question.pregunta_nombre {
                Some(t) if !t.trim().is_empty() => t.clone(),
                _ => continue, // Saltar preguntas sin texto
            };

            // Clave única para detectar duplicados
            let sam_id = format!(
                "{}-{}-{}-{}",
                audience_label, question.id_test, question.id_curso, question.id_pregunta
            );

            let exists: (bool,) = sqlx::query_as(
                "SELECT EXISTS(SELECT 1 FROM question_bank \
                 WHERE source_metadata->>'sam_id' = $1 AND organization_id = $2)"
            )
            .bind(&sam_id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to check duplicate: {}", e),
                )
            })?;

            if exists.0 {
                total_skipped += 1;
                continue;
            }

            // Convertir GROUP_CONCAT → Vec<String>
            let options_vec: Vec<String> = question
                .opciones
                .as_deref()
                .unwrap_or("")
                .split("|||")
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty())
                .collect();

            let options_json = if options_vec.is_empty() {
                serde_json::Value::Null
            } else {
                json!(options_vec)
            };

            let correct_json = question
                .respuesta_correcta
                .as_ref()
                .map(|a| json!(a))
                .unwrap_or(serde_json::Value::Null);

            let source_metadata = json!({
                "sam_id":       sam_id,
                "audience":     audience_label,
                "tabla":        table_name,
                "idTest":       question.id_test,
                "idCurso":      question.id_curso,
                "idPregunta":   question.id_pregunta,
                "imported_at":  chrono::Utc::now().to_rfc3339(),
            });

            match sqlx::query(
                r#"
                INSERT INTO question_bank (
                    organization_id, created_by, question_text, question_type,
                    options, correct_answer, source, source_metadata,
                    audio_status, is_active
                )
                VALUES ($1, $2, $3, 'multiple-choice', $4, $5, 'sam-diagnostico', $6, 'pending', true)
                "#
            )
            .bind(org_ctx.id)
            .bind(claims.sub)
            .bind(&question_text)
            .bind(&options_json)
            .bind(&correct_json)
            .bind(&source_metadata)
            .execute(&pool)
            .await
            {
                Ok(_)  => total_imported += 1,
                Err(e) => errors.push(format!(
                    "Error importando pregunta {} ({}): {}",
                    question.id_pregunta, table_name, e
                )),
            }
        }
    }

    mysql_pool.close().await;

    tracing::info!(
        "SAM_diagnostico import done: imported={} skipped={} errors={}",
        total_imported, total_skipped, errors.len()
    );

    Ok(Json(json!({
        "imported": total_imported,
        "skipped":  total_skipped,
        "errors":   errors,
    })))
}
