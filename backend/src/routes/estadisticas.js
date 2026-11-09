import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { recomendarRefuerzo } from '../services/gemini.js';

const router = Router();
router.use(requireAuth, requireRol('docente'));

const UMBRAL_ALERTA = 50; // % de error a partir del cual se marca el tema

async function calcular(evalId, docenteId) {
  const [ev] = await query(
    `SELECT e.id, e.titulo, c.materia FROM evaluaciones e JOIN cursos c ON c.id = e.curso_id
      WHERE e.id = ? AND c.docente_id = ?`,
    [evalId, docenteId]
  );
  if (!ev) return null;

  const [resumen] = await query(
    `SELECT COUNT(*) AS entregas, ROUND(AVG(nota_final),2) AS promedio, MAX(nota_final) AS maxima, MIN(nota_final) AS minima,
            SUM(CASE WHEN nota_final >= 6 THEN 1 ELSE 0 END) AS aprobados, COUNT(nota_final) AS corregidas
       FROM intentos WHERE evaluacion_id = ? AND estado = 'enviado'`,
    [evalId]
  );

  const preguntas = await query(
    `SELECT p.id, p.orden, p.enunciado, p.tema, p.tipo,
            COUNT(r.puntaje) AS respondidas,
            SUM(CASE WHEN r.puntaje IS NOT NULL AND r.puntaje < 0.5 THEN 1 ELSE 0 END) AS errores
       FROM preguntas p
       LEFT JOIN (SELECT r.* FROM respuestas r JOIN intentos i ON i.id = r.intento_id WHERE i.estado = 'enviado') r ON r.pregunta_id = p.id
      WHERE p.evaluacion_id = ? GROUP BY p.id ORDER BY p.orden`,
    [evalId]
  );
  const conPct = preguntas.map((p) => ({
    ...p,
    respondidas: Number(p.respondidas),
    errores: Number(p.errores || 0),
    pct_error: p.respondidas ? Math.round((Number(p.errores || 0) / p.respondidas) * 100) : 0,
  }));
  const masDificiles = [...conPct].filter((p) => p.respondidas > 0).sort((a, b) => b.pct_error - a.pct_error).slice(0, 5);

  // Alertas agrupadas por tema
  const porTema = {};
  for (const p of conPct.filter((p) => p.respondidas > 0)) {
    const t = (porTema[p.tema || 'General'] ||= { tema: p.tema || 'General', respondidas: 0, errores: 0 });
    t.respondidas += p.respondidas; t.errores += p.errores;
  }
  const alertas = Object.values(porTema)
    .map((t) => ({ tema: t.tema, pct_error: Math.round((t.errores / t.respondidas) * 100) }))
    .filter((t) => t.pct_error >= UMBRAL_ALERTA)
    .sort((a, b) => b.pct_error - a.pct_error);

  return { evaluacion: ev, resumen, preguntas: conPct, masDificiles, alertas };
}

router.get('/evaluacion/:id', async (req, res) => {
  const stats = await calcular(req.params.id, req.user.id);
  if (!stats) return res.status(404).json({ error: 'Evaluación no encontrada' });
  res.json(stats);
});

// "¿Qué temas debería reforzar?" — botón con acción predefinida, no chat libre
router.post('/evaluacion/:id/recomendaciones', async (req, res) => {
  const stats = await calcular(req.params.id, req.user.id);
  if (!stats) return res.status(404).json({ error: 'Evaluación no encontrada' });
  if (!stats.resumen.entregas) return res.status(400).json({ error: 'Todavía no hay entregas para analizar' });
  try {
    const out = await recomendarRefuerzo({
      titulo: stats.evaluacion.titulo,
      materia: stats.evaluacion.materia,
      promedio: stats.resumen.promedio,
      preguntasDificiles: stats.masDificiles,
    });
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

export default router;
