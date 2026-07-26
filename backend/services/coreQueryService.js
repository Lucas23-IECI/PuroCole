const STUDENT_PUBLIC_FIELDS = `
  a.id_alumno, a.uuid_erp, a.rut, a.dv, a.nombres, a.paterno, a.materno,
  a.email, a.telefono, a.rol, a.seccion, a.genero, a.fecha_nacimiento,
  a.nombre_usuario, a.rut_apoderado, a.activo, a.fecha_actualizacion,
  a.codigo_barra
`;

const listCourses = async (queryable) => {
  const result = await queryable.query('SELECT * FROM curso ORDER BY nombre_curso ASC');
  return result.rows;
};

const listStudents = async (queryable) => {
  const result = await queryable.query(`
    SELECT ${STUDENT_PUBLIC_FIELDS}, c.nombre_curso as grade
    FROM alumno a
    LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
    LEFT JOIN curso c ON m.id_curso = c.id_curso
    ORDER BY a.paterno ASC, a.nombres ASC
  `);
  return result.rows;
};

const searchStudents = async (queryable, rawTerm) => {
  const searchTerm = `%${String(rawTerm || '').trim().toLowerCase()}%`;
  const result = await queryable.query(`
    SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv, a.rol, c.nombre_curso
    FROM alumno a
    LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
    LEFT JOIN curso c ON m.id_curso = c.id_curso
    WHERE a.activo = true
      AND (
        LOWER(a.nombres || ' ' || a.paterno || ' ' || COALESCE(a.materno, '')) LIKE $1
        OR LOWER(a.rut || '-' || COALESCE(a.dv, '')) LIKE $1
        OR LOWER(a.rut || COALESCE(a.dv, '')) LIKE $1
        OR LOWER(COALESCE(a.codigo_barra, '')) LIKE $1
        OR LOWER(a.rut) LIKE $1
        OR LOWER(COALESCE(a.nombre_usuario, '')) LIKE $1
      )
    LIMIT 15
  `, [searchTerm]);
  return result.rows;
};

const getStudentDetails = async (queryable, studentId) => {
  const result = await queryable.query(`
    SELECT ${STUDENT_PUBLIC_FIELDS}, c.nombre_curso as grade
    FROM alumno a
    LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
    LEFT JOIN curso c ON m.id_curso = c.id_curso
    WHERE a.id_alumno = $1
  `, [studentId]);
  return result.rows[0] || null;
};

module.exports = {
  STUDENT_PUBLIC_FIELDS,
  getStudentDetails,
  listCourses,
  listStudents,
  searchStudents
};
