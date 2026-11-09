import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { recalcularNota } from '../services/notas.js';

const router = Router();
router.use(requireAuth, requireRol('docente'));

const esMia = async (evalId, docenteId) =>
  (await query('SELECT e.id FROM evaluaciones e JOIN cursos c ON c.id = e.curso_id WHERE e.id = ? AND c.docente_id = ?', [evalId, docenteId]))[0];

// Entregas de una evaluación
router.get('/evaluacion/:id/entregas', async (req, res) => {
  if (!(await esMia(req.params.id, req.user.id))) return res.status(404).json({ error: 'Evaluación no encontrada' });
  const filas = await query(
    `SELECT i.id, u.nombre AS alumno, i.nota_parcial, i.nota_final, i.enviado_en,
            (SELECT COUNT(*) FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
              WHERE r.intento_id = i.id AND p.tipo = 'desarrollo' AND r.confirmada = 0) AS pendientes
       FROM intentos i JOIN usuarios u ON u.id = i.alumno_id
      WHERE i.evaluacion_id = ? AND i.estado = 'enviado' ORDER BY u.nombre`,
    [req.params.id]
  );
  res.json(filas);
});

// Detalle de una entrega
router.get('/intento/:id', async (req, res) => {
  const [intento] = await query(
    `SELECT i.id, i.evaluacion_id, u.nombre AS alumno FROM intentos i
       JOIN usuarios u ON u.id = i.alumno_id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!intento || !(await esMia(intento.evaluacion_id, req.user.id))) return res.status(404).json({ error: 'Entrega no encontrada' });
  const respuestas = await query(
    `SELECT r.id, p.orden, p.enunciado, p.tipo, p.respuesta_correcta, r.respuesta, r.es_correcta,
            r.puntaje, r.nota_sugerida_ia, r.feedback_ia, r.confirmada
       FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id WHERE r.intento_id = ? ORDER BY p.orden`,
    [intento.id]
  );
  res.json({ ...intento, respuestas });
});

// El docente confirma (o ajusta) la nota de una pregunta de desarrollo
router.patch('/respuesta/:id/confirmar', async (req, res) => {
  const nota = Number(req.body?.nota);
  if (Number.isNaN(nota) || nota < 0 || nota > 10) return res.status(400).json({ error: 'La nota debe estar entre 0 y 10' });
  const [r] = await query(
    `SELECT r.id, r.intento_id, i.evaluacion_id, p.tipo FROM respuestas r
       JOIN intentos i ON i.id = r.intento_id JOIN preguntas p ON p.id = r.pregunta_id WHERE r.id = ?`,
    [req.params.id]
  );
  if (!r || r.tipo !== 'desarrollo' || !(await esMia(r.evaluacion_id, req.user.id))) return res.status(404).json({ error: 'Respuesta no encontrada' });
  await query('UPDATE respuestas SET puntaje = ?, confirmada = 1 WHERE id = ?', [nota / 10, r.id]);
  res.json(await recalcularNota(r.intento_id));
});

export default router;
