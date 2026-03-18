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

fn calculate_course_type_from_duration(duracion: Option<i32>) -> String {
    match duracion {
        Some(d) if d >= 70 => "intensive".to_string(),  // 80h or more = intensive
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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch plans: {}", e)))?;

    tracing::info!("Fetched {} study plans from MySQL", mysql_plans.len());

    let mysql_courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            CAST(c.Duracion AS SIGNED INTEGER) AS duracion
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
    let mysql_url = std::env::var("MYSQL_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "MYSQL_DATABASE_URL not configured".to_string()))?;
    
    let mysql_pool = sqlx::MySqlPool::connect(&mysql_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to MySQL: {}", e)))?;
    
    // Fetch courses with their plan names
    let courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            CAST(c.Duracion AS SIGNED INTEGER) AS duracion
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
    // Fetch all study plans from PostgreSQL
    let plans: Vec<MySqlPlanInfo> = sqlx::query_as(
        r#"
        SELECT
            mysql_id as "idPlanDeEstudios",
            name as "NombrePlan"
        FROM mysql_study_plans
        WHERE organization_id = $1 AND is_active = true
        ORDER BY name
        "#
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch plans: {}", e)))?;

    Ok(Json(plans))
}

/// GET /api/question-bank/mysql-courses - Get courses filtered by plan from PostgreSQL
pub async fn get_mysql_courses_by_plan(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<MySqlCoursesFilters>,
) -> Result<Json<Vec<MySqlCourseInfo>>, (StatusCode, String)> {
    // Fetch courses filtered by plan from PostgreSQL
    let courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT
            c.mysql_id as "idCursos",
            c.name as "NombreCurso",
            c.level as "NivelCurso",
            sp.mysql_id as "idPlanDeEstudios",
            sp.name as "NombrePlan",
            c.duracion as "Duracion"
        FROM mysql_courses c
        JOIN mysql_study_plans sp ON c.study_plan_id = sp.id
        WHERE c.organization_id = $1
            AND c.is_active = true
            AND sp.mysql_id = $2
        ORDER BY c.level
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.plan_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch courses: {}", e)))?;

    Ok(Json(courses))
}

#[derive(Debug, Deserialize)]
pub struct MySqlCoursesFilters {
    pub plan_id: i32,
}

#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct MySqlPlanInfo {
    #[sqlx(rename = "idPlanDeEstudios")]
    #[serde(rename = "idPlanDeEstudios")]
    pub id_plan_de_estudios: i32,
    #[sqlx(rename = "NombrePlan")]
    #[serde(rename = "NombrePlan")]
    pub nombre_plan: String,
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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch plans: {}", e)))?;

    tracing::info!("Fetched {} study plans from MySQL", mysql_plans.len());

    let mysql_courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            CAST(c.Duracion AS SIGNED INTEGER) AS duracion
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
    #[sqlx(rename = "idCursos")]
    #[serde(rename = "idCursos")]
    pub id_cursos: i32,
    #[sqlx(rename = "NombreCurso")]
    #[serde(rename = "NombreCurso")]
    pub nombre_curso: String,
    #[sqlx(rename = "NivelCurso")]
    #[serde(rename = "NivelCurso", skip_serializing_if = "Option::is_none")]
    pub nivel_curso: Option<i32>,
    #[sqlx(rename = "idPlanDeEstudios")]
    #[serde(rename = "idPlanDeEstudios")]
    pub id_plan_de_estudios: i32,
    #[sqlx(rename = "NombrePlan")]
    #[serde(rename = "NombrePlan")]
    pub nombre_plan: String,
    #[sqlx(rename = "Duracion")]
    #[serde(rename = "Duracion", skip_serializing_if = "Option::is_none")]
    pub duracion: Option<i32>,  // Duration in hours (40=regular, 80=intensive)
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
