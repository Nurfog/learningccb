CREATE TABLE IF NOT EXISTS sam_study_plans (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    idPlanDeEstudios INTEGER NOT NULL,
    Nombre TEXT NOT NULL,
    Activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, idPlanDeEstudios)
);

CREATE INDEX IF NOT EXISTS idx_sam_study_plans_org_activo
ON sam_study_plans (organization_id, Activo);

CREATE TABLE IF NOT EXISTS sam_courses (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    idCursos INTEGER NOT NULL,
    idPlanDeEstudios INTEGER NOT NULL,
    NombreCurso TEXT NOT NULL,
    NivelCurso INTEGER,
    Duracion DOUBLE PRECISION,
    Activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, idCursos),
    FOREIGN KEY (organization_id, idPlanDeEstudios)
        REFERENCES sam_study_plans (organization_id, idPlanDeEstudios)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sam_courses_org_plan
ON sam_courses (organization_id, idPlanDeEstudios, Activo);

-- Backfill from existing metadata tables when available.
INSERT INTO sam_study_plans (organization_id, idPlanDeEstudios, Nombre, Activo)
SELECT
    organization_id,
    mysql_id,
    name,
    COALESCE(is_active, TRUE)
FROM mysql_study_plans
ON CONFLICT (organization_id, idPlanDeEstudios) DO UPDATE SET
    Nombre = EXCLUDED.Nombre,
    Activo = EXCLUDED.Activo,
    updated_at = NOW();

INSERT INTO sam_courses (
    organization_id,
    idCursos,
    idPlanDeEstudios,
    NombreCurso,
    NivelCurso,
    Duracion,
    Activo
)
SELECT
    mc.organization_id,
    mc.mysql_id,
    msp.mysql_id,
    mc.name,
    mc.level,
    mc.duracion,
    COALESCE(mc.is_active, TRUE)
FROM mysql_courses mc
JOIN mysql_study_plans msp ON msp.id = mc.study_plan_id
ON CONFLICT (organization_id, idCursos) DO UPDATE SET
    idPlanDeEstudios = EXCLUDED.idPlanDeEstudios,
    NombreCurso = EXCLUDED.NombreCurso,
    NivelCurso = EXCLUDED.NivelCurso,
    Duracion = EXCLUDED.Duracion,
    Activo = EXCLUDED.Activo,
    updated_at = NOW();