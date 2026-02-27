-- Mirror the external tiponota table in Postgres for consistency
CREATE TABLE IF NOT EXISTS tipo_nota (
    id_tipo_nota  INTEGER PRIMARY KEY,
    nombre        VARCHAR(60) NOT NULL,
    descripcion   VARCHAR(60),
    activo        SMALLINT NOT NULL DEFAULT 1
);

-- Seed with the same values as the external MySQL database
INSERT INTO tipo_nota (id_tipo_nota, nombre, descripcion, activo) VALUES
    (1, 'CA',  'Continuous Assessment',     1),
    (2, 'MWT', 'Midterm Written Test',       1),
    (3, 'MOT', 'Midterm Oral Test',          1),
    (4, 'SAS', 'Self Assessment Student',    0),
    (5, 'FOT', 'Final Oral Test',            1),
    (6, 'FWT', 'Final written test',         1)
ON CONFLICT (id_tipo_nota) DO UPDATE SET
    nombre      = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    activo      = EXCLUDED.activo;

-- Add tipo_nota_id to grading_categories so each category maps to an assessment type
ALTER TABLE grading_categories
    ADD COLUMN IF NOT EXISTS tipo_nota_id INTEGER REFERENCES tipo_nota(id_tipo_nota);
