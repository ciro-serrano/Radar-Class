import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { generarPreguntas } from '../services/gemini.js';
import { leerLink } from '../services/links.js';

const router = Router();
router.use(requireAuth);

const TIPOS = ['opcion_multiple', 'verdadero_falso', 'desarrollo'];

const MAX_PDF_BYTES = 10 * 1024 * 1024; // por archivo
const MAX_TOTAL_BYTES = 14 * 1024 * 1024; // entre todos los PDF (Gemini admite ~20 MB por pedido, en base64 pesa 1/3 más)
const MAX_PDFS = 5;
const MAX_LINKS = 5;
const MAX_CHARS_TOTAL = 90_000; // texto total de links que se manda a la IA

const bytesDe = (base64) => Math.floor((base64.length * 3) / 4);

// IA genera un borrador de preguntas (NO guarda nada: el docente revisa antes).
// Material opcional: hasta 5 PDFs y 5 links. Si hay material, la IA se basa en él; si no, en el tema.
router.post('/generar', requireRol('docente'), async (req, res) => {
  const { materia, tema = '', dificultad = 'media', cantidad = 10, tipos = ['opcion_multiple'], pdfs = [], pdf = null, links = [] } = req.body || {};
  const temaLimpio = String(tema).trim();

  // `pdf` (uno solo) se sigue aceptando por compatibilidad
  const listaPdfs = [...(Array.isArray(pdfs) ? pdfs : []), ...(pdf ? [pdf] : [])];
  if (listaPdfs.length > MAX_PDFS) return res.status(400).json({ error: `Podés subir hasta ${MAX_PDFS} PDF` });
  const listaLinks = [...new Set((Array.isArray(links) ? links : []).map((l) => String(l).trim()).filter(Boolean))];
  if (listaLinks.length > MAX_LINKS) return res.status(400).json({ error: `Podés agregar hasta ${MAX_LINKS} links` });

  const pdfsOk = [];
  let total = 0;
  for (const f of listaPdfs) {
    const base64 = String(f?.base64 || '').replace(/^data:application\/pdf;base64,/, '');
    const nombre = String(f?.nombre || 'documento.pdf').slice(0, 120);
    if (!base64.startsWith('JVBERi')) return res.status(400).json({ error: `"${nombre}" no parece ser un PDF válido` });
    const peso = bytesDe(base64);
    if (peso > MAX_PDF_BYTES) return res.status(413).json({ error: `"${nombre}" es demasiado grande (máximo 10 MB por PDF)` });
    total += peso;
    pdfsOk.push({ base64, nombre });
  }

  if (!materia) return res.status(400).json({ error: 'Falta la materia del curso' });
  const n = Math.max(1, Math.min(20, Number(cantidad) || 10));
  const tiposOk = (Array.isArray(tipos) ? tipos : []).filter((t) => TIPOS.includes(t));
  if (!tiposOk.length) return res.status(400).json({ error: 'Elegí al menos un tipo de pregunta' });

  // Links: el servidor los lee (páginas web -> texto, o PDFs online). Si alguno falla, se avisa y se sigue con el resto.
  const fuentes = pdfsOk.map((p) => ({ tipo: 'pdf', nombre: p.nombre, ok: true }));
  const textos = [];
  const resultados = await Promise.allSettled(listaLinks.map((l) => leerLink(l)));
  let chars = 0;
  resultados.forEach((r, i) => {
    const url = listaLinks[i];
    if (r.status === 'rejected') return fuentes.push({ tipo: 'link', url, ok: false, error: r.reason?.message || 'No se pudo leer' });
    const v = r.value;
    if (v.tipo === 'pdf') {
      const peso = bytesDe(v.base64);
      if (pdfsOk.length >= MAX_PDFS || total + peso > MAX_TOTAL_BYTES) return fuentes.push({ tipo: 'link', url, ok: false, error: 'No entra: el material supera el máximo permitido' });
      total += peso;
      pdfsOk.push({ base64: v.base64, nombre: v.nombre });
      return fuentes.push({ tipo: 'link', url, ok: true, nombre: v.nombre });
    }
    if (chars + v.texto.length > MAX_CHARS_TOTAL) v.texto = v.texto.slice(0, Math.max(0, MAX_CHARS_TOTAL - chars));
    if (v.texto.length < 200) return fuentes.push({ tipo: 'link', url, ok: false, error: 'No entra: el material supera el máximo permitido' });
    chars += v.texto.length;
    textos.push(v);
    fuentes.push({ tipo: 'link', url, ok: true, nombre: v.titulo || url });
  });
  if (total > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'Los PDF pesan demasiado juntos (máximo 14 MB entre todos)' });

  const hayMaterial = pdfsOk.length > 0 || textos.length > 0;
  if (!temaLimpio && !hayMaterial) {
    const motivos = fuentes.filter((f) => !f.ok).map((f) => `${f.url}: ${f.error}`);
    return res.status(400).json({ error: motivos.length ? `No pude leer ningún link. ${motivos.join(' · ')}` : 'Completá el tema o agregá un PDF o un link' });
  }
  try {
    const preguntas = await generarPreguntas({ materia, tema: temaLimpio, dificultad, cantidad: n, tipos: tiposOk, pdfs: pdfsOk, textos });
    res.json({
      preguntas,
      basado_en_material: hayMaterial,
      fuentes,
      // compatibilidad con la versión anterior
      basado_en_pdf: pdfsOk.length > 0,
      pdf_nombre: pdfsOk[0]?.nombre ?? null,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Guarda la evaluación con sus preguntas
router.post('/', requireRol('docente'), async (req, res) => {
  const { curso_id, titulo, tema, dificultad = 'media', tiempo_limite_min = null, preguntas = [], publicar = false } = req.body || {};
  if (!curso_id || !titulo || !tema || !preguntas.length) return res.status(400).json({ error: 'Faltan datos de la evaluación' });
  const [curso] = await query('SELECT id FROM cursos WHERE id = ? AND docente_id = ?', [curso_id, req.user.id]);
  if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ev] = await conn.query(
      'INSERT INTO evaluaciones (curso_id, titulo, tema, dificultad, tiempo_limite_min, estado) VALUES (?,?,?,?,?,?)',
      [curso_id, titulo, tema, dificultad, tiempo_limite_min || null, publicar ? 'publicada' : 'borrador']
    );
    let orden = 1;
    for (const p of preguntas) {
      if (!p.enunciado || !TIPOS.includes(p.tipo)) continue;
      await conn.query(
        'INSERT INTO preguntas (evaluacion_id, orden, enunciado, tipo, opciones, respuesta_correcta, tema, dificultad) VALUES (?,?,?,?,?,?,?,?)',
        [ev.insertId, orden++, p.enunciado, p.tipo, p.opciones ? JSON.stringify(p.opciones) : null, p.respuesta_correcta ?? null, p.tema || tema, p.dificultad || dificultad]
      );
    }
    await conn.commit();
    res.status(201).json({ id: ev.insertId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

async function evaluacionDelDocente(id, docenteId) {
  const [ev] = await query(
    `SELECT e.*, c.nombre AS curso_nombre, c.materia FROM evaluaciones e JOIN cursos c ON c.id = e.curso_id
      WHERE e.id = ? AND c.docente_id = ?`,
    [id, docenteId]
  );
  return ev;
}

router.patch('/:id/estado', requireRol('docente'), async (req, res) => {
  const { estado } = req.body || {};
  if (!['publicada', 'cerrada'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  if (!(await evaluacionDelDocente(req.params.id, req.user.id))) return res.status(404).json({ error: 'Evaluación no encontrada' });
  await query('UPDATE evaluaciones SET estado = ? WHERE id = ?', [estado, req.params.id]);
  res.json({ ok: true });
});

// Evaluaciones de un curso (docente: todas; alumno: publicadas/cerradas + su estado de intento)
router.get('/curso/:cursoId', async (req, res) => {
  if (req.user.rol === 'docente') {
    const filas = await query(
      `SELECT e.id, e.titulo, e.tema, e.estado, e.creado_en,
              (SELECT COUNT(*) FROM preguntas p WHERE p.evaluacion_id = e.id) AS preguntas,
              (SELECT COUNT(*) FROM intentos i WHERE i.evaluacion_id = e.id AND i.estado = 'enviado') AS entregas
         FROM evaluaciones e JOIN cursos c ON c.id = e.curso_id
        WHERE e.curso_id = ? AND c.docente_id = ? ORDER BY e.id DESC`,
      [req.params.cursoId, req.user.id]
    );
    return res.json(filas);
  }
  const filas = await query(
    `SELECT e.id, e.titulo, e.tema, e.estado, e.tiempo_limite_min,
            i.id AS intento_id, i.estado AS intento_estado, i.nota_final, i.nota_parcial
       FROM evaluaciones e
       JOIN curso_alumno ca ON ca.curso_id = e.curso_id AND ca.alumno_id = ?
       LEFT JOIN intentos i ON i.evaluacion_id = e.id AND i.alumno_id = ?
      WHERE e.curso_id = ? AND e.estado IN ('publicada','cerrada') ORDER BY e.id DESC`,
    [req.user.id, req.user.id, req.params.cursoId]
  );
  res.json(filas);
});

// Detalle completo (docente)
router.get('/:id', requireRol('docente'), async (req, res) => {
  const ev = await evaluacionDelDocente(req.params.id, req.user.id);
  if (!ev) return res.status(404).json({ error: 'Evaluación no encontrada' });
  const preguntas = await query('SELECT * FROM preguntas WHERE evaluacion_id = ? ORDER BY orden', [ev.id]);
  res.json({ ...ev, preguntas });
});

export default router;
