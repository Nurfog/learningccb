/// SAM (Sistema de Administración Académica) Integration Handlers
/// 
/// This module handles synchronization between OpenCCB and the external SAM system.
/// SAM tables: sige_sam_v3.alumnos, sige_sam_v3.detalle_contrato

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::handlers::Claims;
use crate::handlers::Org;

/// SAM Student info from external database
#[derive(Debug, Serialize, Deserialize)]
pub struct SamStudentInfo {
    pub id_alumno: String,
    pub nombre: String,
    pub email: String,
    pub telefono: Option<String>,
    pub activo: bool,
}

/// SAM Course Assignment from detalle_contrato
#[derive(Debug, Serialize, Deserialize)]
pub struct SamAssignmentInfo {
    pub id_contrato: String,
    pub id_alumno: String,
    pub id_curso_abierto: i32,
    pub estado: String,
}

/// Response for sync operation
#[derive(Debug, Serialize)]
pub struct SamSyncResponse {
    pub students_synced: usize,
    pub assignments_synced: usize,
    pub errors: Vec<String>,
}

/// Filters for SAM queries
#[derive(Debug, Deserialize)]
pub struct SamStudentFilters {
    pub email: Option<String>,
    pub nombre: Option<String>,
}

/// ==================== SAM Sync Handlers ====================

/// POST /api/sam/sync-students
/// Sync students from sige_sam_v3.alumnos to OpenCCB users table
pub async fn sync_sam_students(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<SamSyncResponse>, (StatusCode, String)> {
    // Connect to external SAM database
    let sam_url = std::env::var("SAM_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "SAM_DATABASE_URL not configured".to_string()))?;

    let sam_pool = sqlx::PgPool::connect(&sam_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to SAM DB: {}", e)))?;

    let mut errors = Vec::new();
    let mut students_synced = 0;

    // Fetch active students from SAM using generic query
    let rows = sqlx::query(
        r#"
        SELECT 
            id_alumno,
            nombre,
            email,
            telefono,
            activo
        FROM sige_sam_v3.alumnos
        WHERE activo = true AND email IS NOT NULL
        "#
    )
    .fetch_all(&sam_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch SAM students: {}", e)))?;

    // Convert to SamStudentInfo
    let sam_students: Vec<SamStudentInfo> = rows.iter().map(|row| {
        SamStudentInfo {
            id_alumno: row.get("id_alumno"),
            nombre: row.get("nombre"),
            email: row.get("email"),
            telefono: row.get::<Option<String>, _>("telefono"),
            activo: row.get("activo"),
        }
    }).collect();

    // Sync each student to OpenCCB
    for sam_student in sam_students {
        // Check if user exists by email
        let existing_user: Option<(Uuid, Option<String>)> = sqlx::query_as(
            "SELECT id, sam_student_id FROM users WHERE email = $1"
        )
        .bind(&sam_student.email)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            errors.push(format!("Error checking user {}: {}", sam_student.email, e));
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })
        .ok()
        .flatten();

        match existing_user {
            Some((user_id, existing_sam_id)) => {
                // Update existing user with SAM info
                let update_result = sqlx::query(
                    r#"
                    UPDATE users 
                    SET sam_student_id = $1, 
                        is_sam_student = TRUE, 
                        sam_verified_at = NOW(),
                        full_name = COALESCE($2, full_name)
                    WHERE id = $3
                    "#
                )
                .bind(&sam_student.id_alumno)
                .bind(&sam_student.nombre)
                .bind(user_id)
                .execute(&pool)
                .await;

                if update_result.is_ok() {
                    students_synced += 1;
                } else {
                    errors.push(format!("Failed to update user {}", sam_student.email));
                }
            }
            None => {
                // Create new user for SAM student
                let insert_result = sqlx::query(
                    r#"
                    INSERT INTO users (
                        email, 
                        password_hash, 
                        full_name, 
                        role, 
                        organization_id,
                        sam_student_id,
                        is_sam_student,
                        sam_verified_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
                    RETURNING id
                    "#
                )
                .bind(&sam_student.email)
                .bind(format!("sam_managed_{}", sam_student.id_alumno)) // Placeholder password
                .bind(&sam_student.nombre)
                .bind("student")
                .bind(Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()) // Default org
                .bind(&sam_student.id_alumno)
                .fetch_optional(&pool)
                .await;

                match insert_result {
                    Ok(Some(_)) => students_synced += 1,
                    Ok(None) => errors.push(format!("Failed to create user for {}", sam_student.email)),
                    Err(e) => errors.push(format!("Error creating user {}: {}", sam_student.email, e)),
                }
            }
        }
    }

    sam_pool.close().await;

    Ok(Json(SamSyncResponse {
        students_synced,
        assignments_synced: 0,
        errors,
    }))
}

/// POST /api/sam/sync-assignments
/// Sync course assignments from sige_sam_v3.detalle_contrato
pub async fn sync_sam_assignments(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<SamSyncResponse>, (StatusCode, String)> {
    // Connect to external SAM database
    let sam_url = std::env::var("SAM_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "SAM_DATABASE_URL not configured".to_string()))?;

    let sam_pool = sqlx::PgPool::connect(&sam_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to SAM DB: {}", e)))?;

    let mut errors = Vec::new();
    let mut assignments_synced = 0;

    // Fetch active course assignments from SAM
    let rows = sqlx::query(
        r#"
        SELECT 
            id_contrato,
            id_alumno,
            id_curso_abierto,
            estado
        FROM sige_sam_v3.detalle_contrato
        WHERE estado = 'activo' OR estado = 'vigente'
        "#
    )
    .fetch_all(&sam_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch assignments: {}", e)))?;

    // Convert to SamAssignmentInfo
    let sam_assignments: Vec<SamAssignmentInfo> = rows.iter().map(|row| {
        SamAssignmentInfo {
            id_contrato: row.get("id_contrato"),
            id_alumno: row.get("id_alumno"),
            id_curso_abierto: row.get("id_curso_abierto"),
            estado: row.get("estado"),
        }
    }).collect();

    // Sync each assignment
    for assignment in sam_assignments {
        // Get the OpenCCB course ID from SAM course ID
        // This assumes you have a mapping table or the SAM course ID matches OpenCCB course external_id
        let course_result = sqlx::query_as::<_, (Uuid,)>(
            "SELECT id FROM courses WHERE external_sam_id = $1 OR id = $2"
        )
        .bind(assignment.id_curso_abierto as i64)
        .bind(assignment.id_curso_abierto)
        .fetch_optional(&pool)
        .await;

        let course_id = match course_result {
            Ok(Some((id,))) => Some(id),
            Ok(None) => None,
            Err(e) => {
                errors.push(format!("Error finding course {}: {}", assignment.id_curso_abierto, e));
                continue;
            }
        };

        if let Some(course_id) = course_id {
            // Upsert assignment
            let upsert_result = sqlx::query(
                r#"
                INSERT INTO sam_course_assignments (sam_student_id, sam_contrato_id, course_id, is_active, synced_at)
                VALUES ($1, $2, $3, TRUE, NOW())
                ON CONFLICT (sam_student_id, course_id) 
                DO UPDATE SET 
                    is_active = TRUE,
                    sam_contrato_id = EXCLUDED.sam_contrato_id,
                    synced_at = NOW()
                "#
            )
            .bind(&assignment.id_alumno)
            .bind(&assignment.id_contrato)
            .bind(course_id)
            .execute(&pool)
            .await;

            if upsert_result.is_ok() {
                assignments_synced += 1;
            } else {
                errors.push(format!("Failed to sync assignment for student {}", assignment.id_alumno));
            }
        }
    }

    sam_pool.close().await;

    Ok(Json(SamSyncResponse {
        students_synced: 0,
        assignments_synced,
        errors,
    }))
}

/// GET /api/sam/students
/// List SAM students with optional filters
pub async fn list_sam_students(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<SamStudentFilters>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let mut query = r#"
        SELECT 
            u.id,
            u.email,
            u.full_name,
            u.sam_student_id,
            u.is_sam_student,
            u.sam_verified_at,
            u.created_at
        FROM users u
        WHERE u.is_sam_student = TRUE
    "#.to_string();

    if let Some(email) = filters.email {
        query.push_str(&format!(" AND u.email ILIKE '%{}%'", email));
    }

    if let Some(nombre) = filters.nombre {
        query.push_str(&format!(" AND u.full_name ILIKE '%{}%'", nombre));
    }

    query.push_str(" ORDER BY u.full_name");

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch students: {}", e)))?;

    let students: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<Uuid, _>("id"),
            "email": row.get::<String, _>("email"),
            "full_name": row.get::<String, _>("full_name"),
            "sam_student_id": row.get::<String, _>("sam_student_id"),
            "is_sam_student": row.get::<bool, _>("is_sam_student"),
            "sam_verified_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("sam_verified_at"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        })
    }).collect();

    Ok(Json(students))
}

/// GET /api/sam/students/{student_id}/courses
/// Get courses assigned to a specific SAM student
pub async fn get_sam_student_courses(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(sam_student_id): Path<String>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"
        SELECT c.*, sca.is_active, sca.synced_at
        FROM courses c
        INNER JOIN sam_course_assignments sca ON c.id = sca.course_id
        WHERE sca.sam_student_id = $1 AND sca.is_active = TRUE
        ORDER BY c.title
        "#
    )
    .bind(&sam_student_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch courses: {}", e)))?;

    let courses: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<Uuid, _>("id"),
            "title": row.get::<String, _>("title"),
            "description": row.get::<Option<String>, _>("description"),
            "is_active": row.get::<bool, _>("is_active"),
            "synced_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("synced_at"),
        })
    }).collect();

    Ok(Json(courses))
}

/// POST /api/sam/sync-all
/// Full synchronization: students + assignments
pub async fn sync_all_sam(
    org: Org,
    claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<SamSyncResponse>, (StatusCode, String)> {
    let mut errors = Vec::new();
    let mut students_synced = 0;
    let mut assignments_synced = 0;

    // Connect to external SAM database
    let sam_url = std::env::var("SAM_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "SAM_DATABASE_URL not configured".to_string()))?;

    let sam_pool = sqlx::PgPool::connect(&sam_url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to connect to SAM DB: {}", e)))?;

    // Sync students first
    {
        // Fetch active students from SAM
        let rows = sqlx::query(
            r#"
            SELECT id_alumno, nombre, email, telefono, activo
            FROM sige_sam_v3.alumnos
            WHERE activo = true AND email IS NOT NULL
            "#
        )
        .fetch_all(&sam_pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch SAM students: {}", e)))?;

        let sam_students: Vec<SamStudentInfo> = rows.iter().map(|row| {
            SamStudentInfo {
                id_alumno: row.get("id_alumno"),
                nombre: row.get("nombre"),
                email: row.get("email"),
                telefono: row.get::<Option<String>, _>("telefono"),
                activo: row.get("activo"),
            }
        }).collect();

        // Sync each student
        for sam_student in sam_students {
            let existing_user: Option<(Uuid, Option<String>)> = sqlx::query_as(
                "SELECT id, sam_student_id FROM users WHERE email = $1"
            )
            .bind(&sam_student.email)
            .fetch_optional(&pool)
            .await
            .map_err(|e| {
                errors.push(format!("Error checking user {}: {}", sam_student.email, e));
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })
            .ok()
            .flatten();

            match existing_user {
                Some((user_id, _existing_sam_id)) => {
                    let update_result = sqlx::query(
                        "UPDATE users SET sam_student_id = $1, is_sam_student = TRUE, sam_verified_at = NOW(), full_name = COALESCE($2, full_name) WHERE id = $3"
                    )
                    .bind(&sam_student.id_alumno)
                    .bind(&sam_student.nombre)
                    .bind(user_id)
                    .execute(&pool)
                    .await;

                    if update_result.is_ok() { students_synced += 1; } else { errors.push(format!("Failed to update user {}", sam_student.email)); }
                }
                None => {
                    let insert_result = sqlx::query(
                        "INSERT INTO users (email, password_hash, full_name, role, organization_id, sam_student_id, is_sam_student, sam_verified_at) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW()) RETURNING id"
                    )
                    .bind(&sam_student.email)
                    .bind(format!("sam_managed_{}", sam_student.id_alumno))
                    .bind(&sam_student.nombre)
                    .bind("student")
                    .bind(Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
                    .bind(&sam_student.id_alumno)
                    .fetch_optional(&pool)
                    .await;

                    match insert_result {
                        Ok(Some(_)) => students_synced += 1,
                        Ok(None) => errors.push(format!("Failed to create user for {}", sam_student.email)),
                        Err(e) => errors.push(format!("Error creating user {}: {}", sam_student.email, e)),
                    }
                }
            }
        }
    }

    // Sync assignments
    {
        let rows = sqlx::query(
            "SELECT id_contrato, id_alumno, id_curso_abierto, estado FROM sige_sam_v3.detalle_contrato WHERE estado = 'activo' OR estado = 'vigente'"
        )
        .fetch_all(&sam_pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch assignments: {}", e)))?;

        let sam_assignments: Vec<SamAssignmentInfo> = rows.iter().map(|row| {
            SamAssignmentInfo {
                id_contrato: row.get("id_contrato"),
                id_alumno: row.get("id_alumno"),
                id_curso_abierto: row.get("id_curso_abierto"),
                estado: row.get("estado"),
            }
        }).collect();

        for assignment in sam_assignments {
            let course_result = sqlx::query_as::<_, (Uuid,)>(
                "SELECT id FROM courses WHERE external_sam_id = $1 OR id = $2"
            )
            .bind(assignment.id_curso_abierto as i64)
            .bind(assignment.id_curso_abierto)
            .fetch_optional(&pool)
            .await;

            let course_id = match course_result {
                Ok(Some((id,))) => Some(id),
                Ok(None) => continue,
                Err(e) => { errors.push(format!("Error finding course {}: {}", assignment.id_curso_abierto, e)); continue; }
            };

            if let Some(course_id) = course_id {
                let upsert_result = sqlx::query(
                    "INSERT INTO sam_course_assignments (sam_student_id, sam_contrato_id, course_id, is_active, synced_at) VALUES ($1, $2, $3, TRUE, NOW()) ON CONFLICT (sam_student_id, course_id) DO UPDATE SET is_active = TRUE, sam_contrato_id = EXCLUDED.sam_contrato_id, synced_at = NOW()"
                )
                .bind(&assignment.id_alumno)
                .bind(&assignment.id_contrato)
                .bind(course_id)
                .execute(&pool)
                .await;

                if upsert_result.is_ok() { assignments_synced += 1; } else { errors.push(format!("Failed to sync assignment for student {}", assignment.id_alumno)); }
            }
        }
    }

    sam_pool.close().await;

    Ok(Json(SamSyncResponse {
        students_synced,
        assignments_synced,
        errors,
    }))
}
