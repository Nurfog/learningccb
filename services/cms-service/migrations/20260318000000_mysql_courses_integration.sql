-- MySQL Courses Integration
-- Store imported course and study plan data from external MySQL database
-- Used for test template creation with automatic level/course_type detection

-- Study Plans from MySQL
CREATE TABLE mysql_study_plans (
    id SERIAL PRIMARY KEY,
    mysql_id INTEGER NOT NULL UNIQUE,  -- idPlanDeEstudios from MySQL
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,  -- Nombre from MySQL
    
    -- Course type detection
    course_type VARCHAR(20) NOT NULL DEFAULT 'regular',  -- 'regular' (40h) or 'intensive' (80h)
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(organization_id, mysql_id)
);

-- Courses from MySQL
CREATE TABLE IF NOT EXISTS mysql_courses (
    id SERIAL PRIMARY KEY,
    mysql_id INTEGER NOT NULL UNIQUE,  -- idCursos from MySQL
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    study_plan_id INTEGER NOT NULL REFERENCES mysql_study_plans(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,  -- NombreCurso from MySQL
    level INTEGER,  -- NivelCurso from MySQL (1-12+)
    duracion INTEGER,  -- Duracion from MySQL (40h or 80h)
    
    -- Auto-calculated fields
    course_type VARCHAR(20) NOT NULL DEFAULT 'regular',  -- 'regular' (40h) or 'intensive' (80h)
    level_calculated VARCHAR(20),  -- Calculated from NivelCurso: beginner, beginner_1, etc.
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(organization_id, mysql_id)
);

-- Indexes for performance
CREATE INDEX idx_mysql_courses_study_plan ON mysql_courses(study_plan_id);
CREATE INDEX idx_mysql_courses_org ON mysql_courses(organization_id);
CREATE INDEX idx_mysql_plans_org ON mysql_study_plans(organization_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mysql_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_mysql_study_plans_updated_at
    BEFORE UPDATE ON mysql_study_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_mysql_integration_updated_at();

CREATE TRIGGER update_mysql_courses_updated_at
    BEFORE UPDATE ON mysql_courses
    FOR EACH ROW
    EXECUTE FUNCTION update_mysql_integration_updated_at();

-- Function to determine course level from NivelCurso
CREATE OR REPLACE FUNCTION calculate_course_level(nivel INTEGER)
RETURNS TEXT AS $$
BEGIN
    IF nivel IS NULL THEN
        RETURN 'intermediate';
    ELSIF nivel <= 2 THEN
        RETURN 'beginner';
    ELSIF nivel <= 4 THEN
        RETURN 'beginner_1';
    ELSIF nivel <= 6 THEN
        RETURN 'beginner_2';
    ELSIF nivel <= 8 THEN
        RETURN 'intermediate';
    ELSIF nivel <= 10 THEN
        RETURN 'intermediate_1';
    ELSIF nivel <= 12 THEN
        RETURN 'intermediate_2';
    ELSE
        RETURN 'advanced';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to determine course type from plan name
CREATE OR REPLACE FUNCTION calculate_course_type(plan_name TEXT)
RETURNS TEXT AS $$
BEGIN
    IF LOWER(plan_name) LIKE '%intensive%' OR LOWER(plan_name) LIKE '%intensivo%' THEN
        RETURN 'intensive';
    ELSE
        RETURN 'regular';
    END IF;
END;
$$ LANGUAGE plpgsql;
