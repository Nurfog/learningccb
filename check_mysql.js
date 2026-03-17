const mysql = require('mysql2/promise');

async function checkMySQL() {
    try {
        const conn = await mysql.createConnection('mysql://root:Smith3976!@ec2-18-222-25-254.us-east-2.compute.amazonaws.com:3306/sige_sam_v3');
        console.log('Conectado a MySQL\n');

        // Mostrar tablas
        const [tables] = await conn.query('SHOW TABLES');
        console.log('=== TABLAS ===');
        console.table(tables);

        // Estructura de curso
        console.log('\n=== ESTRUCTURA DE curso ===');
        const [cursoCols] = await conn.query('DESCRIBE curso');
        console.table(cursoCols);

        // Estructura de plandeestudios
        console.log('\n=== ESTRUCTURA DE plandeestudios ===');
        const [planCols] = await conn.query('DESCRIBE plandeestudios');
        console.table(planCols);

        // Ver algunos cursos de ejemplo
        console.log('\n=== CURSOS (ejemplo) ===');
        const [cursos] = await conn.query('SELECT * FROM curso LIMIT 5');
        console.table(cursos);

        // Ver planes de estudio
        console.log('\n=== PLANES DE ESTUDIO (ejemplo) ===');
        const [planes] = await conn.query('SELECT * FROM plandeestudios LIMIT 5');
        console.table(planes);

        // Buscar tabla con idDetalleContrato
        console.log('\n=== Buscando tablas con idDetalleContrato ===');
        const [detalleTables] = await conn.query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'sige_sam_v3' 
            AND COLUMN_NAME LIKE '%idDetalle%'
        `);
        console.table(detalleTables);

        // Estructura de detallecontrato
        console.log('\n=== ESTRUCTURA DE detallecontrato ===');
        const [detalleCols] = await conn.query('DESCRIBE detallecontrato');
        console.table(detalleCols);

        // Estructura de prueba (banco de preguntas)
        console.log('\n=== ESTRUCTURA DE prueba ===');
        const [pruebaCols] = await conn.query('DESCRIBE prueba');
        console.table(pruebaCols);

        // Ver algunos detallecontrato
        console.log('\n=== DETALLE CONTRATO (ejemplo) ===');
        const [detalles] = await conn.query('SELECT * FROM detallecontrato LIMIT 5');
        console.table(detalles);

        // Ver banco de preguntas
        console.log('\n=== BANCO DE PREGUNTAS (ejemplo) ===');
        const [preguntas] = await conn.query('SELECT * FROM bancopreguntas LIMIT 5');
        console.table(preguntas);

        // Ver tipo_nota
        console.log('\n=== TIPO NOTA ===');
        const [tiposNota] = await conn.query('SELECT * FROM tiponota');
        console.table(tiposNota);

        await conn.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkMySQL();
