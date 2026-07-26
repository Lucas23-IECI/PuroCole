const express = require('express');

const {
  getStudentDetails,
  listCourses,
  listStudents,
  searchStudents
} = require('../services/coreQueryService');

const createCoreRouter = ({ pool, verifyToken, verifyAnyPermission }) => {
  const router = express.Router();

  router.get('/courses', verifyToken, async (req, res) => {
    try {
      res.json(await listCourses(pool));
    } catch (error) {
      console.error('[core/courses]', error.message);
      res.status(500).json({ message: 'Error al obtener cursos.' });
    }
  });

  router.get(
    '/students',
    verifyToken,
    verifyAnyPermission(['students.view', 'students.manage', 'students.import']),
    async (req, res) => {
      try {
        res.json(await listStudents(pool));
      } catch (error) {
        console.error('[core/students]', error.message);
        res.status(500).json({ message: 'Error al obtener miembros.' });
      }
    }
  );

  router.get(
    '/students/search',
    verifyToken,
    verifyAnyPermission(['punctuality.register', 'reports.generate', 'students.view', 'students.manage']),
    async (req, res) => {
      try {
        res.json(await searchStudents(pool, req.query.q));
      } catch (error) {
        console.error('[core/students/search]', error.message);
        res.status(500).json({ message: 'Error en búsqueda' });
      }
    }
  );

  router.get(
    '/students/:id/details',
    verifyToken,
    verifyAnyPermission(['students.view', 'students.manage']),
    async (req, res) => {
      try {
        const student = await getStudentDetails(pool, req.params.id);
        if (!student) return res.status(404).json({ message: 'Miembro no encontrado.' });
        res.json({ alumno: student });
      } catch (error) {
        console.error('[core/students/details]', error.message);
        res.status(500).json({ message: 'Error al obtener detalles.' });
      }
    }
  );

  return router;
};

module.exports = { createCoreRouter };
