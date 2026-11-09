import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRol('docente'));

router.get('/', async (req, res) => {
  const { tema, dificultad, tipo } = req.query;
  const where = ['docente_id = ?'];
  const params = [req.user.id];
  if (tema) { where.push('tema LIKE ?'); params.push(`%${tema}%`); }
  if (dificultad) { where.push('dificultad = ?'); params.push(dificultad); }
  if (tipo) { where.push('tipo = ?'); params.push(tipo); }
  res.json(await query(`SELECT * FROM banco_preguntas WHERE ${where.join(' AND ')} ORDER BY id DESC`, params));
});

router.post('/', async (req, res) => {
  const { materia, tema, dificultad = 'media', tipo, enunciado, opciones = null, respuesta_correcta = null } = req.body || {};
  if (!enunciado || !['opcion_multiple', 'verdadero_falso', 'desarrollo'].includes(tipo)) return res.status(400).json({ error: 'Pregunta inválida' });
  const r = await query(
    'INSERT INTO banco_preguntas (docente_id, materia, tema, dificultad, tipo, enunciado, opciones, respuesta_correcta) VALUES (?,?,?,?,?,?,?,?)',
    [req.user.id, materia || null, tema || null, dificultad, tipo, enunciado, opciones ? JSON.stringify(opciones) : null, respuesta_correcta]
  );
  res.status(201).json({ id: r.insertId });
});

router.delete('/:id', async (req, res) => {
  await query('DELETE FROM banco_preguntas WHERE id = ? AND docente_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

export default router;
