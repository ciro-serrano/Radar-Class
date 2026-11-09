import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones

function generarCodigo(nombre) {
  const prefijo = nombre.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'CURS';
  let sufijo = '';
  for (let i = 0; i < 4; i++) sufijo += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return `${prefijo}-${sufijo}`;
}

async function insertarConCodigoUnico(nombre, materia, docenteId) {
  for (let intento = 0; intento < 5; intento++) {
    try {
      const r = await query('INSERT INTO cursos (nombre, materia, codigo_acceso, docente_id) VALUES (?,?,?,?)', [nombre, materia, generarCodigo(nombre), docenteId]);
      return r.insertId;
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
  throw new Error('No se pudo generar un código único, probá de nuevo');
}

// Docente crea curso
router.post('/', requireRol('docente'), async (req, res) => {
  const { nombre, materia } = req.body || {};
  if (!nombre || !materia) return res.status(400).json({ error: 'Completá nombre y materia' });
  const id = await insertarConCodigoUnico(nombre.trim(), materia.trim(), req.user.id);
  const [curso] = await query('SELECT * FROM cursos WHERE id = ?', [id]);
  res.status(201).json(curso);
});

// Lista: docente = sus cursos; alumno = cursos a los que se unió
router.get('/', async (req, res) => {
  if (req.user.rol === 'docente') {
    const filas = await query(
      `SELECT c.*, (SELECT COUNT(*) FROM curso_alumno ca WHERE ca.curso_id = c.id) AS alumnos
         FROM cursos c WHERE c.docente_id = ? ORDER BY c.id DESC`,
      [req.user.id]
    );
    return res.json(filas);
  }
  const filas = await query(
    `SELECT c.id, c.nombre, c.materia, u.nombre AS docente
       FROM curso_alumno ca JOIN cursos c ON c.id = ca.curso_id JOIN usuarios u ON u.id = c.docente_id
      WHERE ca.alumno_id = ? ORDER BY ca.unido_en DESC`,
    [req.user.id]
  );
  res.json(filas);
});

// Alumno se une con código
router.post('/unirse', requireRol('alumno'), async (req, res) => {
  const codigo = String(req.body?.codigo || '').trim().toUpperCase();
  const [curso] = await query('SELECT id, nombre FROM cursos WHERE codigo_acceso = ?', [codigo]);
  if (!curso) return res.status(404).json({ error: 'Ese código no existe, revisalo con tu profesor' });
  await query('INSERT IGNORE INTO curso_alumno (curso_id, alumno_id) VALUES (?,?)', [curso.id, req.user.id]);
  res.json({ ok: true, curso });
});

// Docente regenera el código
router.post('/:id/regenerar-codigo', requireRol('docente'), async (req, res) => {
  const [curso] = await query('SELECT * FROM cursos WHERE id = ? AND docente_id = ?', [req.params.id, req.user.id]);
  if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });
  for (let i = 0; i < 5; i++) {
    const codigo = generarCodigo(curso.nombre);
    try {
      await query('UPDATE cursos SET codigo_acceso = ? WHERE id = ?', [codigo, curso.id]);
      return res.json({ codigo_acceso: codigo });
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
  res.status(500).json({ error: 'No se pudo regenerar el código' });
});

export default router;
