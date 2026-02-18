use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::middleware::Org;
use common::models::LessonDependency;
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct AssignDependencyPayload {
    pub prerequisite_lesson_id: Uuid,
    pub min_score_percentage: Option<f64>,
}

pub async fn assign_dependency(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
    Json(payload): Json<AssignDependencyPayload>,
) -> Result<Json<LessonDependency>, StatusCode> {
    // 1. Validar que ambas lecciones pertenecen a la organización
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM lessons WHERE id IN ($1, $2) AND organization_id = $3",
    )
    .bind(lesson_id)
    .bind(payload.prerequisite_lesson_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if count != 2 {
        return Err(StatusCode::NOT_FOUND);
    }

    // 2. Insertar la dependencia
    let dependency = sqlx::query_as!(
        LessonDependency,
        r#"
        INSERT INTO lesson_dependencies (organization_id, lesson_id, prerequisite_lesson_id, min_score_percentage)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (lesson_id, prerequisite_lesson_id) 
        DO UPDATE SET min_score_percentage = EXCLUDED.min_score_percentage
        RETURNING id, organization_id, lesson_id, prerequisite_lesson_id, min_score_percentage, created_at
        "#,
        org_ctx.id,
        lesson_id,
        payload.prerequisite_lesson_id,
        payload.min_score_percentage
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to assign dependency: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(dependency))
}

pub async fn remove_dependency(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path((lesson_id, prerequisite_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM lesson_dependencies WHERE lesson_id = $1 AND prerequisite_lesson_id = $2 AND organization_id = $3",
        lesson_id,
        prerequisite_id,
        org_ctx.id
    )
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_lesson_dependencies(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
) -> Result<Json<Vec<LessonDependency>>, StatusCode> {
    let dependencies = sqlx::query_as!(
        LessonDependency,
        "SELECT * FROM lesson_dependencies WHERE lesson_id = $1 AND organization_id = $2",
        lesson_id,
        org_ctx.id
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(dependencies))
}
