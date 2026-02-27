#![allow(dead_code)]
use utoipa::OpenApi;

// ─── Modelos de Esquema ───────────────────────────────────────────────────────

/// Petición de inscripción externa. Se usa cuando la otra plataforma inscribe a un estudiante.
#[derive(utoipa::ToSchema, serde::Deserialize, serde::Serialize)]
pub struct EnrollRequest {
    /// UUID del curso al cual inscribirse
    pub course_id: String,
    /// idDetalleContrato del sistema externo — requerido para sincronizar notas a MySQL
    pub external_id: Option<i32>,
}

/// Payload de envío de nota
#[derive(utoipa::ToSchema, serde::Deserialize, serde::Serialize)]
pub struct GradeSubmissionRequest {
    pub user_id: String,
    pub course_id: String,
    pub lesson_id: String,
    /// Puntaje entre 0.0 y 1.0 — se convertirá a la escala local (ej: 1-7)
    pub score: f32,
    pub metadata: Option<serde_json::Value>,
}

/// Categoría de Evaluación (Ponderación)
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct GradingCategorySchema {
    pub id: String,
    pub course_id: String,
    pub name: String,
    /// Ponderación como porcentaje (0-100)
    pub weight: i32,
    pub drop_count: i32,
    /// idTipoNota del catálogo tiponota (ej. 1=CA, 2=MWT, 6=FWT)
    pub tipo_nota_id: Option<i32>,
    pub created_at: String,
}

/// Lección dentro de un módulo de curso
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct LessonSchema {
    pub id: String,
    pub module_id: String,
    pub title: String,
    pub content_type: String,
    pub position: i32,
    pub is_graded: bool,
    pub grading_category_id: Option<String>,
    pub created_at: String,
}

/// Módulo de curso
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct ModuleSchema {
    pub id: String,
    pub title: String,
    pub position: i32,
    pub created_at: String,
}

/// Organización
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct OrgSchema {
    pub id: String,
    pub name: String,
    pub domain: String,
}

/// Curso
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct CourseSchema {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub price: f64,
    pub currency: String,
    pub status: String,
    pub created_at: String,
}

/// Payload completo de ingesta de curso — usado por el sistema externo para crear/actualizar cursos
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct IngestCourseRequest {
    pub organization: OrgSchema,
    pub course: CourseSchema,
    pub grading_categories: Vec<GradingCategorySchema>,
    pub modules: Vec<ModuleSchema>,
    pub lessons: Vec<LessonSchema>,
    pub instructors: Vec<String>,
}

/// Entrada del catálogo Tipo Nota
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct TipoNotaSchema {
    pub id_tipo_nota: i32,
    pub nombre: String,
    pub descripcion: Option<String>,
    /// 1 = activo, 0 = inactivo
    pub activo: i16,
}

// ─── Definición de la API ─────────────────────────────────────────────────────

#[derive(OpenApi)]
#[openapi(
    info(
        title = "OpenCCB LMS — API de Integración",
        version = "1.0.0",
        description = "API para integrar plataformas externas: creación de cursos, inscripción de alumnos y sincronización de notas."
    ),
    paths(
        ingest_course,
        enroll_user,
        submit_lesson_score,
        get_tipo_nota,
        get_course_outline,
    ),
    components(
        schemas(
            IngestCourseRequest,
            OrgSchema,
            CourseSchema,
            ModuleSchema,
            LessonSchema,
            GradingCategorySchema,
            EnrollRequest,
            GradeSubmissionRequest,
            TipoNotaSchema,
        )
    ),
    tags(
        (name = "Cursos",        description = "Creación y lectura de cursos"),
        (name = "Inscripciones", description = "Inscripción de alumnos desde plataforma externa"),
        (name = "Notas",         description = "Envío de notas y sincronización a MySQL"),
        (name = "Catálogos",     description = "Catálogos de datos de referencia"),
    )
)]
pub struct ApiDoc;

// ─── Stubs de Rutas — proveen documentación para handlers definidos en handlers.rs ─

/// **Crear o actualizar un curso (ingesta externa)**
///
/// Llama a este endpoint cuando un curso es creado o actualizado en la plataforma externa.
/// Creará o actualizará el curso, sus módulos, lecciones, ponderaciones e instructores en OpenCCB.
#[utoipa::path(
    post,
    path = "/ingest",
    tag = "Cursos",
    request_body = IngestCourseRequest,
    responses(
        (status = 200, description = "Curso ingestada exitosamente"),
        (status = 400, description = "Payload inválido o JSON mal formado"),
        (status = 500, description = "Error interno del servidor"),
    )
)]
pub fn ingest_course() {}

/// **Inscribir un alumno en un curso**
///
/// Inscribe un estudiante en un curso específico. Debes incluir `external_id` (idDetalleContrato)
/// para habilitar la sincronización automática de notas a la base de datos externa MySQL (tabla `notas`).
///
/// Requiere un token JWT válido en la cabecera Authorization (correspondiente al alumno).
#[utoipa::path(
    post,
    path = "/enroll",
    tag = "Inscripciones",
    security(("Bearer" = [])),
    request_body = EnrollRequest,
    responses(
        (status = 200, description = "Inscripción exitosa"),
        (status = 400, description = "Falta el course_id o es inválido"),
        (status = 402, description = "Se requiere pago para cursos de pago"),
        (status = 500, description = "Error interno del servidor"),
    )
)]
pub fn enroll_user() {}

/// **Enviar nota de una lección**
///
/// Envía el puntaje de un alumno para una lección calificada. La nota se guarda
/// localmente en PostgreSQL y se sincroniza automáticamente a MySQL en la tabla `notas`
/// usando el `idDetalleContrato` guardado al momento de la inscripción.
///
/// El campo `score` debe estar entre 0.0 y 1.0 — se convertirá a la escala
/// entera configurada (por defecto a escala chilena 1–7).
#[utoipa::path(
    post,
    path = "/grades",
    tag = "Notas",
    security(("Bearer" = [])),
    request_body = GradeSubmissionRequest,
    responses(
        (status = 200, description = "Nota ingresada y sincronizada exitosamente"),
        (status = 403, description = "Cantidad máxima de intentos alcanzada"),
        (status = 500, description = "Error interno del servidor"),
    )
)]
pub fn submit_lesson_score() {}

/// **Obtener estructura del curso (outline)**
///
/// Devuelve el contenido completo del curso incluyendo módulos, lecciones y 
/// las categorías de evaluación (ponderaciones). Útil para verificar la 
/// estructura luego de llamar al endpoint de ingesta.
#[utoipa::path(
    get,
    path = "/courses/{id}/outline",
    tag = "Cursos",
    security(("Bearer" = [])),
    params(
        ("id" = String, Path, description = "UUID del Curso")
    ),
    responses(
        (status = 200, description = "Estructura del curso obtenida exitosamente"),
        (status = 404, description = "Curso no encontrado"),
    )
)]
pub fn get_course_outline() {}

/// **Obtener catálogo Tipo Nota**
///
/// Devuelve la lista de tipos de evaluación activos (`tiponota`).
/// Utiliza el valor `id_tipo_nota` al crear categorías de evaluación mediante el endpoint `/ingest`.
///
/// | id | nombre | descripcion |
/// |----|--------|-------------|
/// | 1 | CA | Continuous Assessment |
/// | 2 | MWT | Midterm Written Test |
/// | 3 | MOT | Midterm Oral Test |
/// | 5 | FOT | Final Oral Test |
/// | 6 | FWT | Final written test |
#[utoipa::path(
    get,
    path = "/tipo-nota",
    tag = "Catálogos",
    responses(
        (status = 200, description = "Lista de tipos de evaluación activos", body = Vec<TipoNotaSchema>),
    )
)]
pub fn get_tipo_nota() {}
