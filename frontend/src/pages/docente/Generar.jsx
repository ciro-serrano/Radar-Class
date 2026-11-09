import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { GeneratingState } from '../../components/Loader.jsx';
import { Empty } from '../../components/Misc.jsx';

const TIPOS = [['opcion_multiple', 'Opción múltiple'], ['verdadero_falso', 'Verdadero/Falso'], ['desarrollo', 'Desarrollo']];
const ETIQUETA = Object.fromEntries(TIPOS);
const MAX_MB = 10; // por PDF
const MAX_TOTAL_MB = 14; // entre todos los PDF
const MAX_PDFS = 5;
const MAX_LINKS = 5;

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const sinExtension = (n) => n.replace(/\.pdf$/i, '');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function leerComoBase64(file) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => fail(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

export default function Generar() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [cursos, setCursos] = useState([]);
  const [banco, setBanco] = useState([]);
  const [f, setF] = useState({ curso_id: params.get('curso') || '', titulo: '', tema: '', dificultad: 'media', cantidad: 10, tipos: ['opcion_multiple', 'verdadero_falso'], tiempo: '' });
  const [pdfs, setPdfs] = useState([]); // [{ id, nombre, size, base64 }]
  const [links, setLinks] = useState([]); // [url]
  const [linkTxt, setLinkTxt] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [preguntas, setPreguntas] = useState([]);
  const [origen, setOrigen] = useState(null); // { material: bool, fuentes, nombre }
  const [fallidos, setFallidos] = useState([]); // links que no se pudieron leer
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api('/cursos').then((cs) => { setCursos(cs); setF((p) => (p.curso_id || !cs[0] ? p : { ...p, curso_id: String(cs[0].id) })); }).catch(() => {});
    api('/banco').then(setBanco).catch(() => {});
  }, []);

  const curso = cursos.find((c) => String(c.id) === String(f.curso_id));
  const toggleTipo = (t) => setF({ ...f, tipos: f.tipos.includes(t) ? f.tipos.filter((x) => x !== t) : [...f.tipos, t] });

  const hayMaterial = pdfs.length > 0 || links.length > 0;
  const totalBytes = pdfs.reduce((a, p) => a + p.size, 0);

  async function procesarArchivos(files) {
    setError('');
    const lista = Array.from(files || []);
    if (!lista.length) return;
    let peso = totalBytes;
    let cupo = MAX_PDFS - pdfs.length;
    const nuevos = [];
    setLeyendo(true);
    try {
      for (const file of lista) {
        const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (!esPdf) { setError(`"${file.name}" no es un PDF`); continue; }
        if (file.size > MAX_MB * 1024 * 1024) { setError(`"${file.name}" pesa ${fmtSize(file.size)}. El máximo es ${MAX_MB} MB por PDF`); continue; }
        if (cupo <= 0) { setError(`Podés subir hasta ${MAX_PDFS} PDF`); break; }
        if (peso + file.size > MAX_TOTAL_MB * 1024 * 1024) { setError(`Entre todos los PDF el máximo es ${MAX_TOTAL_MB} MB`); continue; }
        if (pdfs.some((p) => p.nombre === file.name && p.size === file.size) || nuevos.some((p) => p.nombre === file.name && p.size === file.size)) continue;
        nuevos.push({ id: `${file.name}-${file.size}-${Date.now()}`, nombre: file.name, size: file.size, base64: await leerComoBase64(file) });
        peso += file.size; cupo -= 1;
      }
      if (nuevos.length) setPdfs((prev) => [...prev, ...nuevos]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLeyendo(false);
    }
  }

  function agregarLink() {
    setError('');
    const txt = linkTxt.trim();
    if (!txt) return;
    const url = /^https?:\/\//i.test(txt) ? txt : `https://${txt}`;
    let u;
    try { u = new URL(url); } catch { return setError('Ese link no es válido. Ejemplo: https://es.wikipedia.org/wiki/Tema'); }
    if (!u.hostname.includes('.')) return setError('Ese link no es válido. Ejemplo: https://es.wikipedia.org/wiki/Tema');
    if (links.length >= MAX_LINKS) return setError(`Podés agregar hasta ${MAX_LINKS} links`);
    if (links.includes(u.href)) return setError('Ese link ya está en la lista');
    setLinks([...links, u.href]);
    setLinkTxt('');
  }

  async function generar(e) {
    e.preventDefault();
    if (cargando) return;
    setError(''); setAviso(''); setFallidos([]); setCargando(true);
    try {
      const out = await api('/evaluaciones/generar', {
        method: 'POST',
        body: {
          materia: curso?.materia, tema: f.tema, dificultad: f.dificultad, cantidad: f.cantidad, tipos: f.tipos,
          // si hay material (PDFs y/o links), el backend lo detecta y arma la evaluación en base a él; si no, usa el tema
          pdfs: pdfs.map((p) => ({ nombre: p.nombre, base64: p.base64 })),
          links,
        },
      });
      setPreguntas(out.preguntas);
      const fuentes = out.fuentes || [];
      setOrigen({ material: out.basado_en_material, fuentes, nombre: out.pdf_nombre || fuentes.find((x) => x.ok)?.nombre || null });
      setFallidos(fuentes.filter((x) => !x.ok));
    } catch (err) { setError(err.message); } finally { setCargando(false); }
  }

  async function guardarEnBanco(p) {
    try {
      await api('/banco', { method: 'POST', body: { ...p, materia: curso?.materia } });
      setAviso('Pregunta guardada en el banco');
      api('/banco').then(setBanco);
    } catch (err) { setError(err.message); }
  }

  async function guardar(publicar) {
    setError('');
    const temaBase = f.tema.trim() || (origen?.nombre ? sinExtension(origen.nombre).slice(0, 80) : 'General');
    try {
      const out = await api('/evaluaciones', {
        method: 'POST',
        body: { curso_id: f.curso_id, titulo: f.titulo || `Evaluación de ${temaBase}`, tema: temaBase, dificultad: f.dificultad, tiempo_limite_min: f.tiempo ? Number(f.tiempo) : null, preguntas, publicar },
      });
      nav(`/docente/evaluaciones/${out.id}`);
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="topbar"><div><div className="eyebrow">Nueva evaluación</div><h1>Generar con IA</h1></div></div>
      {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}
      {aviso && <div className="ok" role="status"><Icon name="check" size={16} />{aviso}</div>}
      {fallidos.length > 0 && (
        <div className="alert-amber" role="alert">
          <Icon name="alert" size={17} />
          <span>
            No pude leer {plural(fallidos.length, 'link', 'links')}, así que las preguntas se armaron con el resto del material:
            <ul>{fallidos.map((x) => <li key={x.url}><b>{host(x.url)}</b>: {x.error}</li>)}</ul>
          </span>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={generar}>
          <div className="section-title">Parámetros</div>
          <div className="field"><label htmlFor="g-curso">Curso</label>
            <select id="g-curso" value={f.curso_id} onChange={(e) => setF({ ...f, curso_id: e.target.value })} required>
              {cursos.map((c) => <option key={c.id} value={c.id}>{c.materia} · {c.nombre}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Material de la clase (opcional)</label>

            {pdfs.length > 0 && (
              <div className="src-list">
                {pdfs.map((p) => (
                  <div className="file-chip" key={p.id}>
                    <span className="ico"><Icon name="file" size={20} /></span>
                    <div className="meta">
                      <div className="name">{p.nombre}</div>
                      <div className="sub">PDF · {fmtSize(p.size)}</div>
                    </div>
                    <button type="button" className="icon-btn" onClick={() => setPdfs(pdfs.filter((x) => x.id !== p.id))} aria-label={`Quitar ${p.nombre}`}><Icon name="x" size={16} /></button>
                  </div>
                ))}
              </div>
            )}

            {pdfs.length < MAX_PDFS && (
              <label
                className={'dropzone' + (pdfs.length ? ' compact' : '') + (arrastrando ? ' drag' : '')}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); procesarArchivos(e.dataTransfer.files); }}
              >
                <input type="file" multiple accept="application/pdf,.pdf" onChange={(e) => { procesarArchivos(e.target.files); e.target.value = ''; }} aria-label="Subir uno o más PDF" />
                <span className="dz-icon"><Icon name="upload" size={pdfs.length ? 18 : 22} /></span>
                <div>
                  <div className="dz-title">{leyendo ? 'Leyendo los archivos…' : pdfs.length ? 'Agregar otro PDF' : 'Arrastrá tus PDF o hacé clic para elegirlos'}</div>
                  <div className="dz-hint">Hasta {MAX_PDFS} PDF · {MAX_MB} MB cada uno · {MAX_TOTAL_MB} MB en total</div>
                </div>
              </label>
            )}

            <div className="src-count"><span>Links de consulta</span><span>{links.length}/{MAX_LINKS}</span></div>
            {links.length > 0 && (
              <div className="src-list">
                {links.map((u) => (
                  <div className="file-chip is-link" key={u}>
                    <span className="ico"><Icon name="link" size={20} /></span>
                    <div className="meta">
                      <div className="name">{host(u)}</div>
                      <div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</div>
                    </div>
                    <button type="button" className="icon-btn" onClick={() => setLinks(links.filter((x) => x !== u))} aria-label={`Quitar el link de ${host(u)}`}><Icon name="x" size={16} /></button>
                  </div>
                ))}
              </div>
            )}
            {links.length < MAX_LINKS && (
              <div className="link-row">
                <input
                  type="text" inputMode="url" aria-label="Agregar un link" placeholder="Pegá un link de una página o de un PDF online"
                  value={linkTxt} onChange={(e) => setLinkTxt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarLink(); } }}
                />
                <button type="button" className="btn btn-ghost" onClick={agregarLink} disabled={!linkTxt.trim()}><Icon name="link" size={16} />Agregar</button>
              </div>
            )}

            <div className={'mode-note ' + (hayMaterial ? 'pdf' : 'tema')} role="status">
              <Icon name={hayMaterial ? 'check' : 'sparkles'} size={16} />
              {hayMaterial
                ? `Material detectado (${[pdfs.length && plural(pdfs.length, 'PDF', 'PDF'), links.length && plural(links.length, 'link', 'links')].filter(Boolean).join(' y ')}): la IA va a armar las preguntas solo con este material.`
                : 'Sin material: la IA arma las preguntas a partir del tema que escribas.'}
            </div>
          </div>

          <div className="field"><label htmlFor="g-titulo">Título (opcional)</label><input id="g-titulo" type="text" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
          <div className="field">
            <label htmlFor="g-tema">Tema{hayMaterial && <span className="muted" style={{ fontWeight: 400 }}> · opcional, sirve para enfocar la IA dentro del material</span>}</label>
            <input id="g-tema" type="text" placeholder={hayMaterial ? 'Ej: solo el capítulo de funciones' : 'Ej: JavaScript — Arrays'} value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })} required={!hayMaterial} />
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field" style={{ flex: 1, minWidth: 110 }}><label htmlFor="g-dif">Dificultad</label>
              <select id="g-dif" value={f.dificultad} onChange={(e) => setF({ ...f, dificultad: e.target.value })}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 110 }}><label htmlFor="g-cant">Cantidad (1-20)</label><input id="g-cant" type="number" min="1" max="20" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></div>
            <div className="field" style={{ flex: 1, minWidth: 110 }}><label htmlFor="g-tiempo">Tiempo (min)</label><input id="g-tiempo" type="number" min="1" placeholder="Sin límite" value={f.tiempo} onChange={(e) => setF({ ...f, tiempo: e.target.value })} /></div>
          </div>
          <div className="field"><label>Tipos de pregunta</label>
            {TIPOS.map(([v, l]) => <label key={v} className="check"><input type="checkbox" checked={f.tipos.includes(v)} onChange={() => toggleTipo(v)} />{l}</label>)}
          </div>
          <button className={'btn btn-amber' + (cargando ? ' is-loading' : '')} style={{ width: '100%', padding: '14px' }} disabled={!f.tipos.length || leyendo || (!hayMaterial && !f.tema.trim())} aria-busy={cargando}>
            {cargando ? 'Generando…' : <><Icon name="sparkles" size={16} />{preguntas.length ? 'Regenerar' : 'Generar evaluación'}</>}
          </button>
        </form>

        <div className="card">
          <div className="section-title" style={{ justifyContent: 'space-between' }}>
            <span>Vista previa{preguntas.length > 0 && !cargando ? ` (${preguntas.length})` : ''}</span>
            {origen && !cargando && preguntas.length > 0 && (
              origen.material
                ? <span className="tag tag-teal"><Icon name="file" size={13} />Basado en {[origen.fuentes.filter((x) => x.ok && x.tipo === 'pdf').length && plural(origen.fuentes.filter((x) => x.ok && x.tipo === 'pdf').length, 'PDF', 'PDF'), origen.fuentes.filter((x) => x.ok && x.tipo === 'link').length && plural(origen.fuentes.filter((x) => x.ok && x.tipo === 'link').length, 'link', 'links')].filter(Boolean).join(' + ')}</span>
                : <span className="tag tag-gray"><Icon name="sparkles" size={13} />Basado en el tema</span>
            )}
          </div>

          {cargando && <GeneratingState conPdf={hayMaterial} />}
          {!cargando && !preguntas.length && (
            <Empty icon="sparkles" title="Tus preguntas van a aparecer acá" text="Revisalas antes de publicar: nada le llega a los alumnos sin tu aprobación." />
          )}
          {!cargando && preguntas.map((p, i) => (
            <div className="q-item" key={`${i}-${p.enunciado.slice(0, 12)}`} style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="qnum">{i + 1} · {ETIQUETA[p.tipo]} · {p.dificultad}{p.tema ? ` · ${p.tema}` : ''}</div>
                {p.enunciado}
                {p.opciones && <ul>{p.opciones.map((o) => <li key={o} className={o === p.respuesta_correcta ? 'right' : ''}>{o}</li>)}</ul>}
                {p.tipo === 'desarrollo' && <div className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>Criterio: {p.respuesta_correcta}</div>}
              </div>
              <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', flex: 'none' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => guardarEnBanco(p)}>Al banco</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPreguntas(preguntas.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            </div>
          ))}

          {!cargando && banco.length > 0 && (
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="g-banco">Agregar desde el banco</label>
              <select id="g-banco" value="" onChange={(e) => { const b = banco.find((x) => String(x.id) === e.target.value); if (b) setPreguntas([...preguntas, { enunciado: b.enunciado, tipo: b.tipo, opciones: typeof b.opciones === 'string' ? JSON.parse(b.opciones) : b.opciones, respuesta_correcta: b.respuesta_correcta, tema: b.tema || f.tema, dificultad: b.dificultad }]); }}>
                <option value="">Elegí una pregunta…</option>
                {banco.map((b) => <option key={b.id} value={b.id}>{b.enunciado.slice(0, 70)}</option>)}
              </select>
            </div>
          )}
          {!cargando && preguntas.length > 0 && (
            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => guardar(false)}>Guardar borrador</button>
              <button className="btn btn-primary" onClick={() => guardar(true)}><Icon name="check" size={16} />Aprobar y publicar</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
