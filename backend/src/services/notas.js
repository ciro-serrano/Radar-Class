import { query } from '../db.js';

// Recalcula nota_parcial / nota_final de un intento.
// nota_final solo existe cuando el docente confirmó todas las preguntas de desarrollo.
export async function recalcularNota(intentoId) {
  const [intento] = await query('SELECT evaluacion_id FROM intentos WHERE id = ?', [intentoId]);
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM preguntas WHERE evaluacion_id = ?', [intento.evaluacion_id]);
  const filas = await query(
    `SELECT r.puntaje, r.confirmada, p.tipo
       FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
      WHERE r.intento_id = ?`,
    [intentoId]
  );
  const suma = filas.reduce((acc, f) => acc + (f.puntaje == null ? 0 : Number(f.puntaje)), 0);
  const pendientes = filas.some((f) => f.tipo === 'desarrollo' && !f.confirmada);
  const nota = total ? Math.round((suma / total) * 10 * 100) / 100 : 0;
  await query('UPDATE intentos SET nota_parcial = ?, nota_final = ? WHERE id = ?', [nota, pendientes ? null : nota, intentoId]);
  return { nota, pendientes };
}

// Mezcla determinística (misma versión del examen si el alumno recarga)
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function mezclar(lista, seed) {
  const rnd = mulberry32(seed);
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const normalizar = (s) => String(s ?? '').trim().toLowerCase();
