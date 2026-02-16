-- Content Libraries: Repositorio reutilizable de bloques y lecciones
-- Permite a instructores guardar y reutilizar componentes de contenido

-- Bloques reutilizables guardados en la biblioteca
CREATE TABLE library_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL, -- El instructor que lo guardó
    name TEXT NOT NULL, -- Nombre descriptivo dado por el instructor
    description TEXT, -- Descripción opcional
    block_type TEXT NOT NULL, -- 'quiz', 'peer-review', 'hotspot', etc.
    block_data JSONB NOT NULL, -- El bloque completo (mismo formato que metadata.blocks)
    tags TEXT[], -- Array de etiquetas para búsqueda
    usage_count INTEGER DEFAULT 0, -- Contador de cuántas veces se ha usado
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsqueda eficiente
CREATE INDEX idx_library_blocks_org ON library_blocks(organization_id);
CREATE INDEX idx_library_blocks_type ON library_blocks(block_type);
CREATE INDEX idx_library_blocks_tags ON library_blocks USING GIN(tags);
CREATE INDEX idx_library_blocks_created_by ON library_blocks(created_by);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_library_blocks_updated_at 
    BEFORE UPDATE ON library_blocks 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Plantillas de lecciones completas (para futuras expansiones)
CREATE TABLE library_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    lesson_data JSONB NOT NULL, -- Incluye metadata.blocks y configuración
    tags TEXT[],
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_library_templates_org ON library_templates(organization_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_library_templates_updated_at 
    BEFORE UPDATE ON library_templates 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();
