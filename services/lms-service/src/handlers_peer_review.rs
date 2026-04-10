use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::models::{
    CourseSubmission, PeerReview, SubmissionWithReviews, SubmitAssignmentPayload,
    SubmitPeerReviewPayload,
};
use common::{auth::Claims, middleware::Org};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub async fn submit_assignment(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, lesson_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SubmitAssignmentPayload>,
) -> Result<Json<CourseSubmission>, (StatusCode, String)> {
    // Verificar si la entrega ya existe
    let existing: Option<CourseSubmission> = sqlx::query_as(
        "SELECT * FROM course_submissions WHERE user_id = $1 AND lesson_id = $2"
    )
    .bind(claims.sub)
    .bind(lesson_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(_) = existing {
        // Actualizar entrega existente
        let updated: CourseSubmission = sqlx::query_as(
            r#"
            UPDATE course_submissions 
            SET content = $1, updated_at = NOW() 
            WHERE user_id = $2 AND lesson_id = $3
            RETURNING *
            "#
        )
        .bind(&payload.content)
        .bind(claims.sub)
        .bind(lesson_id)
        .fetch_one(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(updated));
    }

    // Crear nueva entrega
    let submission: CourseSubmission = sqlx::query_as(
        r#"
        INSERT INTO course_submissions (user_id, course_id, lesson_id, organization_id, content)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#
    )
    .bind(claims.sub)
    .bind(course_id)
    .bind(lesson_id)
    .bind(org_ctx.id)
    .bind(&payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(submission))
}

pub async fn get_peer_review_assignment(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Option<CourseSubmission>>, (StatusCode, String)> {
    // Buscar una entrega que:
    // 1. No sea la mía propia
    // 2. Tenga menos de 2 revisiones (configurable, pero hardcoded por ahora)
    // 3. Yo no haya revisado aún
    let submission: Option<CourseSubmission> = sqlx::query_as(
        r#"
        SELECT s.* 
        FROM course_submissions s
        LEFT JOIN peer_reviews pr ON s.id = pr.submission_id
        WHERE s.course_id = $1 
          AND s.lesson_id = $2
          AND s.user_id != $3
          AND s.organization_id = $4
          AND NOT EXISTS (
              SELECT 1 FROM peer_reviews my_pr 
              WHERE my_pr.submission_id = s.id AND my_pr.reviewer_id = $3
          )
        GROUP BY s.id
        HAVING COUNT(pr.id) < 2
        ORDER BY s.submitted_at ASC
        LIMIT 1
        "#
    )
    .bind(course_id)
    .bind(lesson_id)
    .bind(claims.sub)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(submission))
}

pub async fn submit_peer_review(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, _lesson_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SubmitPeerReviewPayload>,
) -> Result<Json<PeerReview>, (StatusCode, String)> {
    // Verificar entrega válida
    let submission_row = sqlx::query(
        "SELECT user_id FROM course_submissions WHERE id = $1"
    )
    .bind(payload.submission_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let submission_user_id = match submission_row {
        Some(row) => row.get::<Uuid, _>("user_id"),
        None => return Err((StatusCode::NOT_FOUND, "Entrega no encontrada".to_string())),
    };

    if submission_user_id == claims.sub {
        return Err((
            StatusCode::BAD_REQUEST,
            "No puedes revisar tu propia entrega".to_string(),
        ));
    }

    // Verificar si ya fue revisada
    let existing = sqlx::query(
        "SELECT id FROM peer_reviews WHERE submission_id = $1 AND reviewer_id = $2"
    )
    .bind(payload.submission_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((
            StatusCode::CONFLICT,
            "Ya has revisado esta entrega".to_string(),
        ));
    }

    // Crear revisión
    let review: PeerReview = sqlx::query_as(
        r#"
        INSERT INTO peer_reviews (submission_id, reviewer_id, score, feedback, organization_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#
    )
    .bind(payload.submission_id)
    .bind(claims.sub)
    .bind(payload.score)
    .bind(&payload.feedback)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(review))
}

pub async fn get_my_submission_feedback(
    Org(_org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<PeerReview>>, (StatusCode, String)> {
    // Obtener revisiones para mi entrega en esta lección
    let reviews: Vec<PeerReview> = sqlx::query_as(
        r#"
        SELECT pr.* 
        FROM peer_reviews pr
        JOIN course_submissions cs ON pr.submission_id = cs.id
        WHERE cs.user_id = $1 AND cs.lesson_id = $2
        "#
    )
    .bind(claims.sub)
    .bind(lesson_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(reviews))
}

pub async fn list_lesson_submissions(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<SubmissionWithReviews>>, (StatusCode, String)> {
    let submissions: Vec<SubmissionWithReviews> = sqlx::query_as(
        r#"
        SELECT 
            s.id, s.user_id, u.full_name, u.email, s.submitted_at,
            COUNT(pr.id) as review_count,
            AVG(pr.score)::float8 as average_score
        FROM course_submissions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN peer_reviews pr ON s.id = pr.submission_id
        WHERE s.lesson_id = $1 AND s.organization_id = $2
        GROUP BY s.id, u.full_name, u.email
        ORDER BY s.submitted_at DESC
        "#
    )
    .bind(lesson_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(submissions))
}

pub async fn get_submission_reviews(
    Org(_org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(submission_id): Path<Uuid>,
) -> Result<Json<Vec<PeerReview>>, (StatusCode, String)> {
    let reviews: Vec<PeerReview> = sqlx::query_as(
        "SELECT * FROM peer_reviews WHERE submission_id = $1"
    )
    .bind(submission_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(reviews))
}
