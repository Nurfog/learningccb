-- Add external_id to enrollments to map idDetalleContrato from the external system
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS external_id INTEGER;
