import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import { sugerirNotaDesarrollo } from "../services/gemini.js";
import { recalcularNota, mezclar, normalizar } from "../services/notas.js";

const router = Router();
router.use(requireAuth, requireRol("alumno"));

const parseOpciones = (o) => (typeof o === "string" ? JSON.parse(o) : o);

// El alumno empieza (o retoma) una evaluación. Cada alumno recibe orden de preguntas y opciones distinto.
router.post("/evaluacion/:id/iniciar", async (req, res) => {
  const [ev] = await query(
    `SELECT e.* FROM evaluaciones e JOIN curso_alumno ca ON ca.curso_id = e.curso_id AND ca.alumno_id = ?
      WHERE e.id = ?`,
    [req.user.id, req.params.id],
  );
  if (!ev) return res.status(404).json({ error: "Evaluación no encontrada" });
  if (ev.estado !== "publicada")
    return res
      .status(409)
      .json({ error: "Esta evaluación no está disponible" });

  // INSERT IGNORE: si dos pedidos llegan a la vez, el segundo simplemente reutiliza el intento ya creado
  await query(
    "INSERT IGNORE INTO intentos (evaluacion_id, alumno_id) VALUES (?,?)",
    [ev.id, req.user.id],
  );
  const [intento] = await query(
    "SELECT * FROM intentos WHERE evaluacion_id = ? AND alumno_id = ?",
    [ev.id, req.user.id],
  );
  if (intento.estado === "enviado")
    return res
      .status(409)
      .json({ error: "Ya entregaste esta evaluación", intento_id: intento.id });

  const crudas = await query(
    "SELECT id, orden, enunciado, tipo, opciones FROM preguntas WHERE evaluacion_id = ? ORDER BY orden",
    [ev.id],
  );
  const preguntas = mezclar(crudas, intento.id).map((p) => ({
    id: p.id,
    enunciado: p.enunciado,
    tipo: p.tipo,
    // V/F mantiene su orden natural; opción múltiple se mezcla
    opciones:
      p.tipo === "opcion_multiple"
        ? mezclar(parseOpciones(p.opciones) || [], intento.id + p.id)
        : parseOpciones(p.opciones),
  }));

  let segundos_restantes = null;
  if (ev.tiempo_limite_min) {
    const [{ transcurridos }] = await query(
      "SELECT TIMESTAMPDIFF(SECOND, iniciado_en, NOW()) AS transcurridos FROM intentos WHERE id = ?",
      [intento.id],
    );
    segundos_restantes = Math.max(0, ev.tiempo_limite_min * 60 - transcurridos);
  }
  res.json({
    intento_id: intento.id,
    titulo: ev.titulo,
    tema: ev.tema,
    segundos_restantes,
    preguntas,
  });
});

// Entrega: corrige opción múltiple y V/F al instante; desarrollo queda con sugerencia de IA para confirmar
router.post("/:id/enviar", async (req, res) => {
  const [intento] = await query(
    "SELECT * FROM intentos WHERE id = ? AND alumno_id = ?",
    [req.params.id, req.user.id],
  );
  if (!intento) return res.status(404).json({ error: "Intento no encontrado" });
  if (intento.estado === "enviado")
    return res.status(409).json({ error: "Ya entregaste esta evaluación" });

  const dadas = req.body?.respuestas || {};
  const preguntas = await query(
    "SELECT * FROM preguntas WHERE evaluacion_id = ?",
    [intento.evaluacion_id],
  );

  const filas = await Promise.all(
    preguntas.map(async (p) => {
      const respuesta = dadas[p.id] ?? "";
      if (p.tipo === "desarrollo") {
        let sugerida = null,
          feedback = null;
        try {
          if (String(respuesta).trim()) {
            const s = await sugerirNotaDesarrollo({
              enunciado: p.enunciado,
              criterio: p.respuesta_correcta,
              respuestaAlumno: respuesta,
            });
            sugerida = s.nota;
            feedback = s.feedback;
          }
        } catch {
          /* si la IA falla, el docente corrige a mano */
        }
        return [intento.id, p.id, respuesta, null, null, sugerida, feedback];
      }
      const ok = normalizar(respuesta) === normalizar(p.respuesta_correcta);
      return [intento.id, p.id, respuesta, ok ? 1 : 0, ok ? 1 : 0, null, null];
    }),
  );
  for (const f of filas) {
    await query(
      `INSERT INTO respuestas (intento_id, pregunta_id, respuesta, es_correcta, puntaje, nota_sugerida_ia, feedback_ia)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE respuesta = VALUES(respuesta), es_correcta = VALUES(es_correcta), puntaje = VALUES(puntaje)`,
      f,
    );
  }
  await query(
    "UPDATE intentos SET estado = 'enviado', enviado_en = NOW() WHERE id = ?",
    [intento.id],
  );
  await recalcularNota(intento.id);
  res.json({ ok: true, intento_id: intento.id });
});

// Resultado del alumno
router.get("/:id/resultado", async (req, res) => {
  const [intento] = await query(
    `SELECT i.*, e.titulo, e.estado AS eval_estado FROM intentos i JOIN evaluaciones e ON e.id = i.evaluacion_id
      WHERE i.id = ? AND i.alumno_id = ?`,
    [req.params.id, req.user.id],
  );
  if (!intento || intento.estado !== "enviado")
    return res.status(404).json({ error: "Resultado no disponible" });
  const detalle = await query(
    `SELECT p.orden, p.enunciado, p.tipo, p.tema, p.respuesta_correcta, r.respuesta, r.es_correcta, r.puntaje, r.confirmada, r.feedback_ia
       FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id WHERE r.intento_id = ? ORDER BY p.orden`,
    [intento.id],
  );
  const [{ promedio }] = await query(
    "SELECT ROUND(AVG(nota_final),2) AS promedio FROM intentos WHERE evaluacion_id = ? AND estado = 'enviado' AND nota_final IS NOT NULL",
    [intento.evaluacion_id],
  );
  const revelar = intento.eval_estado === "cerrada";
  res.json({
    titulo: intento.titulo,
    nota_final: intento.nota_final,
    nota_parcial: intento.nota_parcial,
    promedio_curso: promedio,
    detalle: detalle.map((d) => ({
      orden: d.orden,
      enunciado: d.enunciado,
      tipo: d.tipo,
      tema: d.tema,
      respuesta: d.respuesta,
      estado:
        d.tipo === "desarrollo"
          ? d.confirmada
            ? Number(d.puntaje) >= 0.5
              ? "correcta"
              : "incorrecta"
            : "pendiente"
          : d.es_correcta
            ? "correcta"
            : "incorrecta",
      feedback: d.tipo === "desarrollo" && d.confirmada ? d.feedback_ia : null,
      respuesta_correcta:
        revelar && d.tipo !== "desarrollo" ? d.respuesta_correcta : null,
    })),
  });
});

export default router;
