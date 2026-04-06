use axum::{
    Json,
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
};
use aws_config::BehaviorVersion;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::{
    Client as S3Client,
    config::{Credentials, Region},
};
use common::models::{Asset};
use common::ai::{self, generate_embedding};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;
use std::env;
use std::path::Path as StdPath;
use tokio::process::Command;

#[derive(Debug, Serialize)]
pub struct AssetUploadResponse {
    pub id: Uuid,
    pub filename: String,
    pub url: String,
    pub mimetype: String,
    pub size_bytes: i64,
}

#[derive(Debug, Serialize)]
pub struct AssetRagIngestResponse {
    pub asset_id: Uuid,
    pub source: String,
    pub chunks_ingested: usize,
    pub chars_ingested: usize,
}

#[derive(Debug, Serialize)]
pub struct AssetZipImportResponse {
    pub imported_assets: usize,
    pub rag_ingested_assets: usize,
    pub rag_chunks_ingested: usize,
    pub failed_entries: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetFilters {
    pub mimetype: Option<String>,
    pub course_id: Option<Uuid>,
    pub search: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone)]
struct S3Settings {
    bucket: String,
    region: String,
    endpoint: Option<String>,
    public_base_url: Option<String>,
    force_path_style: bool,
}

fn get_s3_settings() -> Option<S3Settings> {
    let enabled = env::var("ASSETS_STORAGE")
        .unwrap_or_else(|_| "local".to_string())
        .to_lowercase();

    if enabled != "s3" {
        return None;
    }

    let bucket = env::var("S3_BUCKET").ok()?;
    let region = env::var("S3_REGION").unwrap_or_else(|_| "us-east-2".to_string());
    let endpoint = env::var("S3_ENDPOINT").ok().filter(|v| !v.trim().is_empty());
    let public_base_url = env::var("S3_PUBLIC_BASE_URL")
        .ok()
        .filter(|v| !v.trim().is_empty());
    let force_path_style = env::var("S3_FORCE_PATH_STYLE")
        .map(|v| {
            let lower = v.to_lowercase();
            lower == "1" || lower == "true" || lower == "yes"
        })
        .unwrap_or(false);

    Some(S3Settings {
        bucket,
        region,
        endpoint,
        public_base_url,
        force_path_style,
    })
}

async fn build_s3_client(settings: &S3Settings) -> Result<S3Client, (StatusCode, String)> {
    let region_provider = RegionProviderChain::first_try(Some(Region::new(settings.region.clone())))
        .or_default_provider();

    let mut loader = aws_config::defaults(BehaviorVersion::latest()).region(region_provider);

    let access_key = env::var("AWS_ACCESS_KEY_ID").ok();
    let secret_key = env::var("AWS_SECRET_ACCESS_KEY").ok();
    if let (Some(ak), Some(sk)) = (access_key, secret_key) {
        let creds = Credentials::new(ak, sk, None, None, "env");
        loader = loader.credentials_provider(creds);
    }

    let shared_config = loader.load().await;
    let mut s3_builder = aws_sdk_s3::config::Builder::from(&shared_config);
    if let Some(endpoint) = &settings.endpoint {
        s3_builder = s3_builder.endpoint_url(endpoint);
    }
    if settings.force_path_style {
        s3_builder = s3_builder.force_path_style(true);
    }

    Ok(S3Client::from_conf(s3_builder.build()))
}

fn build_s3_object_key(org_id: Uuid, course_id: Option<Uuid>, storage_filename: &str) -> String {
    match course_id {
        Some(cid) => format!("org/{}/course/{}/assets/{}", org_id, cid, storage_filename),
        None => format!("org/{}/shared/assets/{}", org_id, storage_filename),
    }
}

fn build_s3_public_url(settings: &S3Settings, key: &str) -> String {
    if let Some(base) = &settings.public_base_url {
        return format!("{}/{}", base.trim_end_matches('/'), key);
    }

    format!(
        "https://{}.s3.{}.amazonaws.com/{}",
        settings.bucket, settings.region, key
    )
}

async fn maybe_push_local_file_to_s3(
    local_path: &str,
    storage_filename: &str,
    mimetype: &str,
    org_id: Uuid,
    course_id: Option<Uuid>,
) -> Result<Option<(String, String)>, (StatusCode, String)> {
    let settings = match get_s3_settings() {
        Some(s) => s,
        None => return Ok(None),
    };

    let bytes = tokio::fs::read(local_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Read local file failed: {}", e)))?;

    let client = build_s3_client(&settings).await?;
    let key = build_s3_object_key(org_id, course_id, storage_filename);

    client
        .put_object()
        .bucket(&settings.bucket)
        .key(&key)
        .content_type(mimetype)
        .body(bytes.into())
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("S3 upload failed: {}", e)))?;

    let storage_path = format!("s3://{}/{}", settings.bucket, key);
    let public_url = build_s3_public_url(&settings, &key);
    Ok(Some((storage_path, public_url)))
}

async fn delete_storage_path(storage_path: &str) -> Result<(), (StatusCode, String)> {
    if let Some((bucket, key)) = parse_s3_storage_path(storage_path) {
        let settings = get_s3_settings().ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "S3 storage path found but S3 is not configured".to_string(),
        ))?;
        let client = build_s3_client(&settings).await?;
        client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("S3 delete failed: {}", e)))?;
        return Ok(());
    }

    let _ = tokio::fs::remove_file(storage_path).await;
    Ok(())
}

fn parse_s3_storage_path(path: &str) -> Option<(&str, &str)> {
    let without_prefix = path.strip_prefix("s3://")?;
    let (bucket, key) = without_prefix.split_once('/')?;
    if bucket.is_empty() || key.is_empty() {
        return None;
    }
    Some((bucket, key))
}

async fn read_storage_bytes(storage_path: &str) -> Result<Vec<u8>, (StatusCode, String)> {
    if let Some((bucket, key)) = parse_s3_storage_path(storage_path) {
        let settings = get_s3_settings().ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "S3 storage path found but S3 is not configured".to_string(),
        ))?;
        let client = build_s3_client(&settings).await?;
        let output = client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("S3 read failed: {}", e)))?;
        let data = output
            .body
            .collect()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("S3 stream read failed: {}", e)))?;
        return Ok(data.into_bytes().to_vec());
    }

    tokio::fs::read(storage_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Read failed: {}", e)))
}

/// POST /api/assets/upload - Subir un archivo a la biblioteca global
pub async fn upload_asset(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    mut multipart: Multipart,
) -> Result<Json<AssetUploadResponse>, (StatusCode, String)> {
    let mut filename = String::new();
    let mut data = Vec::new();
    let mut mimetype = String::new();
    let mut course_id: Option<Uuid> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            filename = field.file_name().unwrap_or("unnamed").to_string();
            mimetype = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_string();
            data = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
                .to_vec();
        } else if name == "course_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = Uuid::parse_str(&txt) {
                    course_id = Some(id);
                }
            }
        }
    }

    if data.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No file uploaded".to_string()));
    }

    let asset_id = Uuid::new_v4();

    // Ensure uploads directory exists
    tokio::fs::create_dir_all("uploads")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (storage_filename, storage_path, stored_filename, stored_mimetype) =
        if is_flv_media(&filename, &mimetype) {
            let temp_storage_filename = format!("{}.flv", asset_id);
            let temp_storage_path = format!("uploads/{}", temp_storage_filename);
            tokio::fs::write(&temp_storage_path, data)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let final_storage_filename = format!("{}.mp4", asset_id);
            let final_storage_path = format!("uploads/{}", final_storage_filename);
            transcode_flv_to_mp4(&temp_storage_path, &final_storage_path).await?;
            let _ = tokio::fs::remove_file(&temp_storage_path).await;

            (
                final_storage_filename,
                final_storage_path,
                replace_extension(&filename, "mp4"),
                "video/mp4".to_string(),
            )
        } else {
            let extension = StdPath::new(&filename)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            let storage_filename = if extension.is_empty() {
                asset_id.to_string()
            } else {
                format!("{}.{}", asset_id, extension)
            };
            let storage_path = format!("uploads/{}", storage_filename);

            tokio::fs::write(&storage_path, data)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            (storage_filename, storage_path, filename.clone(), mimetype.clone())
        };

    let size_bytes = tokio::fs::metadata(&storage_path)
        .await
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    let (db_storage_path, asset_url) = if let Some((s3_path, public_url)) = maybe_push_local_file_to_s3(
        &storage_path,
        &storage_filename,
        &stored_mimetype,
        org_ctx.id,
        course_id,
    )
    .await?
    {
        let _ = tokio::fs::remove_file(&storage_path).await;
        (s3_path, public_url)
    } else {
        (storage_path.clone(), format!("/assets/{}", storage_filename))
    };

    // Record in DB
    sqlx::query(
        r#"
        INSERT INTO assets (id, organization_id, uploaded_by, course_id, filename, storage_path, mimetype, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(asset_id)
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(course_id)
    .bind(&stored_filename)
    .bind(&db_storage_path)
    .bind(&stored_mimetype)
    .bind(size_bytes)
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AssetUploadResponse {
        id: asset_id,
        filename: stored_filename,
        url: asset_url,
        mimetype: stored_mimetype,
        size_bytes,
    }))
}

/// GET /api/assets - Listar activos de la organización
pub async fn list_assets(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<AssetFilters>,
) -> Result<Json<Vec<Asset>>, (StatusCode, String)> {
    let limit = filters.limit.unwrap_or(50) as i64;
    let offset = ((filters.page.unwrap_or(1).max(1) - 1) * filters.limit.unwrap_or(50)) as i64;

    let mut query = String::from("SELECT * FROM assets WHERE organization_id = $1");
    let mut param_index = 2;

    if filters.mimetype.is_some() {
        query.push_str(&format!(" AND mimetype ILIKE ${}", param_index));
        param_index += 1;
    }

    if filters.course_id.is_some() {
        query.push_str(&format!(" AND course_id = ${}", param_index));
        param_index += 1;
    }

    if filters.search.is_some() {
        query.push_str(&format!(" AND filename ILIKE ${}", param_index));
        param_index += 1;
    }

    query.push_str(&format!(" ORDER BY created_at DESC LIMIT ${} OFFSET ${}", param_index, param_index + 1));

    let mut sql_query = sqlx::query_as::<_, Asset>(&query).bind(org_ctx.id);

    if let Some(mt) = &filters.mimetype {
        sql_query = sql_query.bind(format!("%{}%", mt));
    }

    if let Some(cid) = filters.course_id {
        sql_query = sql_query.bind(cid);
    }

    if let Some(search) = &filters.search {
        sql_query = sql_query.bind(format!("%{}%", search));
    }

    let assets = sql_query
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(assets))
}

/// DELETE /api/assets/:id - Eliminar un activo y su archivo físico
pub async fn delete_asset(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 1. Get asset metadata to find file path
    let asset: Asset = sqlx::query_as(
        "SELECT * FROM assets WHERE id = $1 AND organization_id = $2"
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    // 2. Delete from DB
    sqlx::query("DELETE FROM assets WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Delete physical file or S3 object
    let _ = delete_storage_path(&asset.storage_path).await;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/assets/:id/ingest-rag - Ingesta un asset (PDF/audio/video/texto) en chunks para RAG
pub async fn ingest_asset_for_rag(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<AssetRagIngestResponse>, (StatusCode, String)> {
    let asset: Asset = sqlx::query_as(
        "SELECT * FROM assets WHERE id = $1 AND organization_id = $2"
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    let extracted = extract_asset_text(&asset).await?;
    let content = extracted.trim();

    if content.len() < 80 {
        return Err((
            StatusCode::BAD_REQUEST,
            "No se encontró suficiente texto utilizable en el archivo".to_string(),
        ));
    }

    let chunks = chunk_text(content, 900);
    if chunks.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "No se pudo generar contenido para RAG".to_string(),
        ));
    }

    sqlx::query(
        r#"
        DELETE FROM question_bank
        WHERE organization_id = $1
          AND source = 'imported-material'
          AND source_metadata->>'asset_id' = $2
        "#,
    )
    .bind(org_ctx.id)
    .bind(asset.id.to_string())
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Cleanup failed: {}", e)))?;

    let source_kind = if asset.mimetype.starts_with("audio/") || asset.mimetype.starts_with("video/") {
        "audio-transcription"
    } else if asset.mimetype.contains("pdf") {
        "pdf"
    } else {
        "text"
    };

    let skill = if asset.mimetype.starts_with("audio/") || asset.mimetype.starts_with("video/") {
        Some("listening")
    } else {
        Some("reading")
    };

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("HTTP client error: {}", e)))?;
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();

    ingest_chunks_to_question_bank(
        &pool,
        org_ctx.id,
        claims.sub,
        &asset,
        &source_kind,
        skill,
        &chunks,
        &client,
        &ollama_url,
        &model,
    )
    .await?;

    Ok(Json(AssetRagIngestResponse {
        asset_id: asset.id,
        source: source_kind.to_string(),
        chunks_ingested: chunks.len(),
        chars_ingested: content.len(),
    }))
}

/// POST /api/assets/import-zip - Importa todos los archivos de un ZIP a la biblioteca.
/// Campos multipart:
/// - file: ZIP requerido
/// - course_id: UUID opcional
/// - ingest_rag: true/false opcional (default false)
pub async fn import_assets_zip(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    mut multipart: Multipart,
) -> Result<Json<AssetZipImportResponse>, (StatusCode, String)> {
    let mut zip_data = Vec::new();
    let mut course_id: Option<Uuid> = None;
    let mut ingest_rag = false;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();

        if name == "file" {
            zip_data = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
                .to_vec();
        } else if name == "course_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = Uuid::parse_str(txt.trim()) {
                    course_id = Some(id);
                }
            }
        } else if name == "ingest_rag" {
            if let Ok(txt) = field.text().await {
                let v = txt.trim().to_lowercase();
                ingest_rag = v == "1" || v == "true" || v == "yes";
            }
        }
    }

    if zip_data.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No ZIP file uploaded".to_string()));
    }

    let reader = std::io::Cursor::new(zip_data);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ZIP file".to_string()))?;

    let mut imported_assets = 0usize;
    let mut rag_ingested_assets = 0usize;
    let mut rag_chunks_ingested = 0usize;
    let mut failed_entries: Vec<String> = Vec::new();

    let rag_client = if ingest_rag {
        Some(
            reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .danger_accept_invalid_hostnames(true)
                .build()
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("HTTP client error: {}", e)))?,
        )
    } else {
        None
    };
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();

    let len = archive.len();
    for i in 0..len {
        let (entry_name, safe_filename, content): (String, String, Vec<u8>) = {
            let mut file = archive
                .by_index(i)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP read error: {}", e)))?;

            if !file.is_file() {
                continue;
            }

            let entry_name = file.name().to_string();
            if entry_name.starts_with("__MACOSX/") || entry_name.ends_with(".DS_Store") {
                continue;
            }

            let safe_filename = std::path::Path::new(&entry_name)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("unnamed")
                .to_string();

            let mut content = Vec::new();
            std::io::Read::read_to_end(&mut file, &mut content)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP entry read failed: {}", e)))?;

            (entry_name, safe_filename, content)
        };

        let asset_id = Uuid::new_v4();
        let guessed_mimetype = mime_guess::from_path(&safe_filename)
            .first_or_octet_stream()
            .to_string();

        let (storage_path, stored_filename, mimetype) = if is_flv_media(&safe_filename, &guessed_mimetype) {
            let temp_storage_filename = format!("{}.flv", asset_id);
            let temp_storage_path = format!("uploads/{}", temp_storage_filename);
            tokio::fs::create_dir_all("uploads")
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            tokio::fs::write(&temp_storage_path, &content)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let final_storage_filename = format!("{}.mp4", asset_id);
            let final_storage_path = format!("uploads/{}", final_storage_filename);
            if let Err((_, msg)) = transcode_flv_to_mp4(&temp_storage_path, &final_storage_path).await {
                let _ = tokio::fs::remove_file(&temp_storage_path).await;
                failed_entries.push(format!("{}: flv transcode failed ({})", entry_name, msg));
                continue;
            }
            let _ = tokio::fs::remove_file(&temp_storage_path).await;

            (final_storage_path, replace_extension(&safe_filename, "mp4"), "video/mp4".to_string())
        } else {
            let extension = StdPath::new(&safe_filename)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            let storage_filename = if extension.is_empty() {
                asset_id.to_string()
            } else {
                format!("{}.{}", asset_id, extension)
            };
            let storage_path = format!("uploads/{}", storage_filename);

            tokio::fs::create_dir_all("uploads")
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            tokio::fs::write(&storage_path, &content)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            (storage_path, safe_filename.clone(), guessed_mimetype)
        };

        let storage_filename_for_s3 = StdPath::new(&storage_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        let (db_storage_path, _asset_url) = if !storage_filename_for_s3.is_empty() {
            if let Some((s3_path, public_url)) = maybe_push_local_file_to_s3(
                &storage_path,
                &storage_filename_for_s3,
                &mimetype,
                org_ctx.id,
                course_id,
            )
            .await?
            {
                let _ = tokio::fs::remove_file(&storage_path).await;
                (s3_path, public_url)
            } else {
                (
                    storage_path.clone(),
                    format!("/assets/{}", storage_filename_for_s3),
                )
            }
        } else {
            (storage_path.clone(), storage_path.clone())
        };

        let persisted_size = if db_storage_path == storage_path {
            tokio::fs::metadata(&storage_path)
                .await
                .map(|m| m.len() as i64)
                .unwrap_or(content.len() as i64)
        } else {
            content.len() as i64
        };

        let insert_result = sqlx::query(
            r#"
            INSERT INTO assets (id, organization_id, uploaded_by, course_id, filename, storage_path, mimetype, size_bytes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(asset_id)
        .bind(org_ctx.id)
        .bind(claims.sub)
        .bind(course_id)
        .bind(&stored_filename)
        .bind(&db_storage_path)
        .bind(&mimetype)
        .bind(persisted_size)
        .execute(&pool)
        .await;

        if let Err(e) = insert_result {
            failed_entries.push(format!("{}: db insert failed ({})", entry_name, e));
            continue;
        }

        imported_assets += 1;

        if ingest_rag {
            let asset = Asset {
                id: asset_id,
                organization_id: org_ctx.id,
                uploaded_by: Some(claims.sub),
                course_id,
                filename: stored_filename.clone(),
                storage_path: db_storage_path.clone(),
                mimetype: mimetype.clone(),
                size_bytes: persisted_size,
                created_at: chrono::Utc::now(),
            };

            match extract_asset_text(&asset).await {
                Ok(extracted) => {
                    let trimmed = extracted.trim();
                    if trimmed.len() < 80 {
                        failed_entries.push(format!("{}: contenido insuficiente para RAG", entry_name));
                        continue;
                    }

                    let chunks = chunk_text(trimmed, 900);
                    if chunks.is_empty() {
                        failed_entries.push(format!("{}: no se pudieron generar chunks", entry_name));
                        continue;
                    }

                    let source_kind = if mimetype.starts_with("audio/") || mimetype.starts_with("video/") {
                        "audio-transcription"
                    } else if mimetype.contains("pdf") {
                        "pdf"
                    } else {
                        "text"
                    };

                    let skill = if mimetype.starts_with("audio/") || mimetype.starts_with("video/") {
                        Some("listening")
                    } else {
                        Some("reading")
                    };

                    if let Some(client) = &rag_client {
                        match ingest_chunks_to_question_bank(
                            &pool,
                            org_ctx.id,
                            claims.sub,
                            &asset,
                            source_kind,
                            skill,
                            &chunks,
                            client,
                            &ollama_url,
                            &model,
                        )
                        .await
                        {
                            Ok(()) => {
                                rag_ingested_assets += 1;
                                rag_chunks_ingested += chunks.len();
                            }
                            Err((_, msg)) => {
                                failed_entries.push(format!("{}: rag ingest failed ({})", entry_name, msg));
                            }
                        }
                    }
                }
                Err((_, msg)) => {
                    failed_entries.push(format!("{}: extract failed ({})", entry_name, msg));
                }
            }
        }
    }

    Ok(Json(AssetZipImportResponse {
        imported_assets,
        rag_ingested_assets,
        rag_chunks_ingested,
        failed_entries,
    }))
}

fn is_flv_media(filename: &str, mimetype: &str) -> bool {
    let lower_name = filename.to_lowercase();
    let lower_mt = mimetype.to_lowercase();
    lower_name.ends_with(".flv")
        || lower_mt == "video/x-flv"
        || lower_mt == "video/flv"
        || lower_mt.ends_with("/x-flv")
}

fn replace_extension(filename: &str, new_ext: &str) -> String {
    let base = StdPath::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    format!("{}.{}", base, new_ext)
}

async fn transcode_flv_to_mp4(input_path: &str, output_path: &str) -> Result<(), (StatusCode, String)> {
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-i")
        .arg(input_path)
        .arg("-c:v")
        .arg("libx264")
        .arg("-c:a")
        .arg("aac")
        .arg("-movflags")
        .arg("+faststart")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("No se pudo convertir FLV a MP4 (ffmpeg no disponible): {}", e),
            )
        })?;

    if !output.status.success() {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Error convirtiendo FLV a MP4: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        ));
    }

    Ok(())
}

async fn ingest_chunks_to_question_bank(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    asset: &Asset,
    source_kind: &str,
    skill: Option<&str>,
    chunks: &[String],
    client: &reqwest::Client,
    ollama_url: &str,
    model: &str,
) -> Result<(), (StatusCode, String)> {
    for (idx, chunk) in chunks.iter().enumerate() {
        let metadata = json!({
            "asset_id": asset.id,
            "asset_filename": asset.filename,
            "mimetype": asset.mimetype,
            "course_id": asset.course_id,
            "source_kind": source_kind,
            "chunk_index": idx + 1,
            "chunk_total": chunks.len(),
        });

        let inserted_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO question_bank (
                organization_id,
                created_by,
                question_text,
                question_type,
                explanation,
                difficulty,
                skill_assessed,
                source,
                source_metadata,
                is_active,
                is_archived
            )
            VALUES ($1, $2, $3, 'short-answer', $4, 'medium', $5, 'imported-material', $6, true, false)
            RETURNING id
            "#,
        )
        .bind(org_id)
        .bind(user_id)
        .bind(chunk)
        .bind("RAG material chunk from uploaded asset")
        .bind(skill)
        .bind(&metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Insert failed: {}", e)))?;

        if let Ok(embedding_res) = generate_embedding(client, ollama_url, model, chunk).await {
            let pgvector = ai::embedding_to_pgvector(&embedding_res.embedding);
            let _ = sqlx::query(
                r#"
                UPDATE question_bank
                SET embedding = $1::vector,
                    embedding_updated_at = NOW()
                WHERE id = $2
                "#,
            )
            .bind(&pgvector)
            .bind(inserted_id)
            .execute(pool)
            .await;
        }
    }

    Ok(())
}

async fn extract_asset_text(asset: &Asset) -> Result<String, (StatusCode, String)> {
    let lower_name = asset.filename.to_lowercase();
    let mimetype = asset.mimetype.to_lowercase();

    if mimetype.starts_with("audio/") || mimetype.starts_with("video/") {
        let bytes = read_storage_bytes(&asset.storage_path).await?;
        return transcribe_media_bytes(bytes, &asset.filename).await;
    }

    if mimetype.contains("pdf") || lower_name.ends_with(".pdf") {
        let bytes = read_storage_bytes(&asset.storage_path).await?;
        return extract_pdf_text_from_bytes(bytes).await;
    }

    if mimetype.starts_with("text/")
        || lower_name.ends_with(".txt")
        || lower_name.ends_with(".md")
        || lower_name.ends_with(".csv")
        || lower_name.ends_with(".json")
        || lower_name.ends_with(".log")
    {
        let bytes = read_storage_bytes(&asset.storage_path).await?;
        return Ok(String::from_utf8_lossy(&bytes).replace('\0', " "));
    }

    Err((
        StatusCode::BAD_REQUEST,
        "Formato no soportado para ingesta RAG. Usa PDF, TXT/MD/CSV/JSON o audio/video".to_string(),
    ))
}

async fn extract_pdf_text_from_bytes(bytes: Vec<u8>) -> Result<String, (StatusCode, String)> {
    let temp_name = format!("uploads/tmp-pdf-{}.pdf", Uuid::new_v4());
    tokio::fs::create_dir_all("uploads")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Create temp dir failed: {}", e)))?;
    tokio::fs::write(&temp_name, bytes)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Write temp pdf failed: {}", e)))?;

    let output = Command::new("pdftotext")
        .arg("-layout")
        .arg(&temp_name)
        .arg("-")
        .output()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!(
                    "No se pudo extraer texto del PDF (pdftotext no disponible o falló): {}",
                    e
                ),
            )
        })?;

    let _ = tokio::fs::remove_file(&temp_name).await;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err((
            StatusCode::BAD_REQUEST,
            format!("pdftotext devolvió error: {}", err),
        ));
    }

    let text = String::from_utf8_lossy(&output.stdout).replace('\0', " ");
    Ok(text)
}

async fn transcribe_media_bytes(file_data: Vec<u8>, filename: &str) -> Result<String, (StatusCode, String)> {
    let whisper_url = std::env::var("WHISPER_URL")
        .unwrap_or_else(|_| "http://localhost:8000".to_string());
    let client = reqwest::Client::new();

    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(file_data).file_name(filename.to_string()),
        )
        .text("model", "whisper-1")
        .text("response_format", "json");

    let response = client
        .post(format!("{}/v1/audio/transcriptions", whisper_url))
        .multipart(form)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Whisper request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("Whisper API error {}: {}", status, body),
        ));
    }

    let transcription: serde_json::Value = response
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Invalid Whisper response: {}", e)))?;

    let text = transcription
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if text.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Whisper no pudo extraer texto del audio/video".to_string(),
        ));
    }

    Ok(text)
}

fn chunk_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();

    for word in text.split_whitespace() {
        if current.len() + word.len() + 1 > max_chars && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current.clear();
        }

        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
}
