// Manejadores de Marca de la Organización

use axum::{
    Json,
    extract::State,
    http::StatusCode,
};
use common::models::Organization;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::handlers::{log_action, Org};

#[derive(Deserialize, Serialize)]
pub struct BrandingPayload {
    pub name: Option<String>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub platform_name: Option<String>,
    pub logo_variant: Option<String>,
}

#[derive(Serialize)]
pub struct BrandingResponse {
    pub logo_url: Option<String>,
    pub favicon_url: Option<String>,
    pub platform_name: Option<String>,
    pub logo_variant: Option<String>,
    pub primary_color: String,
    pub secondary_color: String,
}

// Cargar logo de la organización
pub async fn upload_organization_logo(
    claims: common::auth::Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Solo los administradores pueden cargar logos
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    // Verificar que la organización existe y el usuario tiene acceso
    let _ = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Organización no encontrada".into()))?;

    // Procesar formulario multipart
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Error en multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let filename = field
                .file_name()
                .ok_or((StatusCode::BAD_REQUEST, "Faltan datos del nombre del archivo".into()))?
                .to_string();

            // Validar extensión del archivo
            let ext = filename.split('.').last().unwrap_or("");
            if !["png", "jpg", "jpeg", "svg"].contains(&ext.to_lowercase().as_str()) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Tipo de archivo inválido. Solo se permiten PNG, JPG y SVG".into(),
                ));
            }

            let data = field.bytes().await.map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al leer el archivo: {}", e),
                )
            })?;

            // Validar tamaño del archivo (máx. 2MB)
            if data.len() > 2 * 1024 * 1024 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Archivo demasiado grande. Se permite un máximo de 2MB".into(),
                ));
            }

            // Crear el directorio de subidas si no existe
            std::fs::create_dir_all("uploads/org-logos").map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al crear el directorio: {}", e),
                )
            })?;

            // Generar nombre de archivo único
            let unique_filename = format!("{}_{}.{}", org_ctx.id, uuid::Uuid::new_v4(), ext);
            let filepath = format!("uploads/org-logos/{}", unique_filename);

            // Guardar archivo
            std::fs::write(&filepath, &data).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al guardar el archivo: {}", e),
                )
            })?;

            // Actualizar organización en la base de datos
            let logo_url = format!("/{}", filepath);
            sqlx::query("UPDATE organizations SET logo_url = $1 WHERE id = $2")
                .bind(&logo_url)
                .bind(org_ctx.id)
                .execute(&pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Error de base de datos: {}", e),
                    )
                })?;

            log_action(
                &pool,
                claims.org,
                claims.sub,
                "UPDATE_LOGO",
                "Organization",
                org_ctx.id,
                json!({"logo_url": &logo_url}),
            )
            .await;

            return Ok(Json(json!({
                "logo_url": logo_url,
                "message": "Logo cargado con éxito"
            })));
        }
    }

    Err((StatusCode::BAD_REQUEST, "No se proporcionó ningún archivo".into()))
}

// Cargar favicon de la organización
pub async fn upload_organization_favicon(
    claims: common::auth::Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Solo los administradores pueden cargar favicons
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    // Verificar que la organización existe y el usuario tiene acceso
    let _ = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Organización no encontrada".into()))?;

    // Procesar formulario multipart
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Error en multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let filename = field
                .file_name()
                .ok_or((StatusCode::BAD_REQUEST, "Falta el nombre del archivo".into()))?
                .to_string();

            // Validar extensión del archivo
            let ext = filename.split('.').last().unwrap_or("");
            if !["png", "jpg", "jpeg", "svg", "ico"].contains(&ext.to_lowercase().as_str()) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Tipo de archivo inválido. Solo se permiten PNG, JPG, SVG e ICO".into(),
                ));
            }

            let data = field.bytes().await.map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al leer el archivo: {}", e),
                )
            })?;

            // Validar tamaño del archivo (el máx. razonable para favicons es 512KB, pero se mantiene en 1MB por seguridad)
            if data.len() > 1024 * 1024 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Archivo demasiado grande. Se permite un máximo de 1MB".into(),
                ));
            }

            // Crear el directorio de subidas si no existe
            std::fs::create_dir_all("uploads/org-favicons").map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al crear el directorio: {}", e),
                )
            })?;

            // Generar nombre de archivo único
            let unique_filename = format!("{}_{}.{}", org_ctx.id, uuid::Uuid::new_v4(), ext);
            let filepath = format!("uploads/org-favicons/{}", unique_filename);

            // Guardar archivo
            std::fs::write(&filepath, &data).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al guardar el archivo: {}", e),
                )
            })?;

            // Actualizar organización en la base de datos
            let favicon_url = format!("/{}", filepath);
            sqlx::query("UPDATE organizations SET favicon_url = $1 WHERE id = $2")
                .bind(&favicon_url)
                .bind(org_ctx.id)
                .execute(&pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Error de base de datos: {}", e),
                    )
                })?;

            log_action(
                &pool,
                claims.org,
                claims.sub,
                "UPDATE_FAVICON",
                "Organization",
                org_ctx.id,
                json!({"favicon_url": &favicon_url}),
            )
            .await;

            return Ok(Json(json!({
                "favicon_url": favicon_url,
                "message": "Favicon cargado con éxito"
            })));
        }
    }

    Err((StatusCode::BAD_REQUEST, "No se proporcionó ningún archivo".into()))
}

// Actualizar colores de marca de la organización
pub async fn update_organization_branding(
    claims: common::auth::Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Json(payload): Json<BrandingPayload>,
) -> Result<Json<Organization>, (StatusCode, String)> {
    // Solo los administradores pueden actualizar la marca
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    // Validar formato de color hexadecimal
    let validate_color = |color: &str| -> bool {
        color.len() == 7
            && color.starts_with('#')
            && color[1..].chars().all(|c| c.is_ascii_hexdigit())
    };

    if let Some(ref primary) = payload.primary_color {
        if !validate_color(primary) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Formato de primary_color inválido. Use #RRGGBB".into(),
            ));
        }
    }

    if let Some(ref secondary) = payload.secondary_color {
        if !validate_color(secondary) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Formato de secondary_color inválido. Use #RRGGBB".into(),
            ));
        }
    }

    // Actualizar organización
    let org = sqlx::query_as::<_, Organization>(
        "UPDATE organizations 
         SET name = COALESCE($1, name),
             primary_color = COALESCE($2, primary_color),
             secondary_color = COALESCE($3, secondary_color),
             platform_name = COALESCE($4, platform_name),
             logo_variant = COALESCE($5, logo_variant),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *",
    )
    .bind(&payload.name)
    .bind(&payload.primary_color)
    .bind(&payload.secondary_color)
    .bind(&payload.platform_name)
    .bind(&payload.logo_variant)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error de base de datos: {}", e),
        )
    })?;

    log_action(
        &pool,
        claims.org,
        claims.sub,
        "UPDATE_BRANDING",
        "Organization",
        org_ctx.id,
        json!(payload),
    )
    .await;

    Ok(Json(org))
}

// Obtener marca de la organización (punto de conexión público)
pub async fn get_organization_branding(
    State(pool): State<PgPool>,
) -> Result<Json<BrandingResponse>, StatusCode> {
    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(BrandingResponse {
        logo_url: org.logo_url,
        favicon_url: org.favicon_url,
        platform_name: org.platform_name,
        logo_variant: org.logo_variant,
        primary_color: org.primary_color.unwrap_or_else(|| "#3B82F6".to_string()),
        secondary_color: org.secondary_color.unwrap_or_else(|| "#8B5CF6".to_string()),
    }))
}
