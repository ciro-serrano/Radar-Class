import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import RadarPanel from '../../components/RadarPanel.jsx';
import { PageLoader, Skeleton, Spinner } from '../../components/Loader.jsx';
import { CountUp, Empty } from '../../components/Misc.jsx';

const fmt = (n) => (n == null ? '—' : Number(n).toFixed(1));
const ESTADO = { borrador: 'tag-gray', publicada: 'tag-teal', cerrada: 'tag-amber' };

function Entrega({ intentoId, onCambio }) {
  const [d, setD] = useState(null);
  const [notas, setNotas] = useState({});
  const [guardando, setGuardando] = useState(null);
  const cargar = useCallback(() => api(`/correccion/intento/${intentoId}`).then((x) => {
    setD(x);
    setNotas(Object.fromEntries(x.respuestas.map((r) => [r.id, r.confirmada ? Number(r.puntaje) * 10 : r.nota_sugerida_ia ?? ''])));
  }), [intentoId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function confirmar(r) {
    setGuardando(r.id);
    try {
      await api(`/correccion/respuesta/${r.id}/confirmar`, { method: 'PATCH', body: { nota: Number(notas[r.id]) } });
      await cargar(); onCambio();
    } finally { setGuardando(null); }
  }
  if (!d) return <div style={{ padding: '14px 0' }}><Skeleton lines={3} /></div>;
  return (
    <div style={{ padding: '8px 0 16px' }}>
      {d.respuestas.map((r) => (
        <div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div className="qnum">Pregunta {r.orden}</div>
            <div>{r.enunciado}</div>
            <div style={{ marginTop: 6 }}><b>Respuesta:</b> {r.respuesta || <span className="muted">(vacía)</span>}</div>
            {r.tipo === 'desarrollo' ? (
              <>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Criterio: {r.respuesta_correcta}</div>
                {r.feedback_ia && (
                  <div className="mode-note" style={{ marginTop: 8 }}>
                    <Icon name="sparkles" size={15} />
                    <span>Sugerencia IA ({fmt(r.nota_sugerida_ia)}/10): {r.feedback_ia}</span>
                  </div>
                )}
                <div className="row" style={{ marginTop: 10 }}>
                  <input type="number" min="0" max="10" step="0.5" aria-label="Nota de 0 a 10" style={{ width: 90 }} value={notas[r.id] ?? ''} onChange={(e) => setNotas({ ...notas, [r.id]: e.target.value })} />
                  <button className={'btn btn-primary btn-sm' + (guardando === r.id ? ' is-loading' : '')} disabled={notas[r.id] === '' || notas[r.id] == null} onClick={() => confirmar(r)}>
                    {r.confirmada ? 'Actualizar nota' : 'Confirmar nota'}
                  </button>
                  {r.confirmada ? <span className="tag tag-teal"><Icon name="check" size={13} />Confirmada</span> : <span className="tag tag-amber">Pendiente</span>}
                </div>
              </>
            ) : (
              <span className={`tag ${r.es_correcta ? 'tag-teal' : 'tag-red'}`} style={{ marginTop: 8 }}>
                <Icon name={r.es_correcta ? 'check' : 'x'} size={13} />
                {r.es_correcta ? 'Correcta' : `Incorrecta — era: ${r.respuesta_correcta}`}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Evaluacion() {
  const { id } = useParams();
  const [ev, setEv] = useState(null);
  const [tab, setTab] = useState('entregas');
  const [entregas, setEntregas] = useState(null);
  const [stats, setStats] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [reco, setReco] = useState(null);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api(`/evaluaciones/${id}`).then(setEv).catch((e) => setError(e.message));
    api(`/correccion/evaluacion/${id}/entregas`).then(setEntregas).catch(() => setEntregas([]));
    api(`/estadisticas/evaluacion/${id}`).then(setStats).catch(() => {});
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  // Agrupa el error por tema para alimentar el radar
  const temas = useMemo(() => {
    if (!stats) return [];
    const m = new Map();
    for (const p of stats.preguntas) {
      const t = p.tema || 'General';
      const a = m.get(t) || { tema: t, errores: 0, respondidas: 0, preguntas: 0 };
      a.errores += Number(p.errores ?? 0);
      a.respondidas += Number(p.respondidas ?? 0);
      a.preguntas += 1;
      a.suma = (a.suma ?? 0) + Number(p.pct_error ?? 0);
      m.set(t, a);
    }
    return [...m.values()]
      .map((a) => ({ tema: a.tema, preguntas: a.preguntas, pct_error: a.respondidas ? Math.round((a.errores / a.respondidas) * 100) : Math.round(a.suma / a.preguntas) }))
      .sort((x, y) => y.pct_error - x.pct_error);
  }, [stats]);

  async function cambiarEstado(estado) {
    await api(`/evaluaciones/${id}/estado`, { method: 'PATCH', body: { estado } });
    cargar();
  }
  async function pedirReco() {
    setError(''); setCargandoIA(true);
    try { setReco(await api(`/estadisticas/evaluacion/${id}/recomendaciones`, { method: 'POST' })); }
    catch (e) { setError(e.message); } finally { setCargandoIA(false); }
  }

  if (!ev) return error ? <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div> : <PageLoader label="Abriendo evaluación…" />;
  const pendientesTotal = (entregas || []).reduce((a, e) => a + Number(e.pendientes), 0);

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">{ev.materia} · {ev.curso_nombre}</div><h1>{ev.titulo}</h1></div>
        <div className="row">
          <span className={`tag ${ESTADO[ev.estado]}`}>{ev.estado}</span>
          {ev.estado === 'borrador' && <button className="btn btn-amber" onClick={() => cambiarEstado('publicada')}>Publicar</button>}
          {ev.estado === 'publicada' && <button className="btn btn-ghost" onClick={() => cambiarEstado('cerrada')}>Cerrar evaluación</button>}
        </div>
      </div>
      {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}

      <div className="tabs" role="tablist">
        {[['entregas', `Corrección${pendientesTotal ? ` (${pendientesTotal})` : ''}`], ['stats', 'Estadísticas'], ['preguntas', 'Preguntas']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'entregas' && (
        <div className="card">
          {entregas === null && <Skeleton lines={3} />}
          {entregas?.length === 0 && <Empty icon="file" title="Todavía no hay entregas" text="Cuando tus alumnos rindan, vas a poder revisarlas y confirmar notas acá." />}
          {entregas?.length > 0 && (
            <table>
              <thead><tr><th>Alumno</th><th>Nota</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {entregas.map((e) => (
                  <Fragment key={e.id}>
                    <tr>
                      <td>{e.alumno}</td>
                      <td>{e.nota_final != null ? fmt(e.nota_final) : <span className="muted">{fmt(e.nota_parcial)} parcial</span>}</td>
                      <td>{Number(e.pendientes) ? <span className="tag tag-amber">{e.pendientes} por confirmar</span> : <span className="tag tag-teal"><Icon name="check" size={13} />Corregida</span>}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => setAbierta(abierta === e.id ? null : e.id)}>{abierta === e.id ? 'Ocultar' : 'Revisar'}</button></td>
                    </tr>
                    {abierta === e.id && <tr><td colSpan={4}><Entrega intentoId={e.id} onCambio={cargar} /></td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'stats' && !stats && <div className="card"><Skeleton lines={4} /></div>}
      {tab === 'stats' && stats && (
        <>
          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            <div className="card lift"><div className="stat-label">Entregas</div><div className="stat-num"><CountUp value={stats.resumen.entregas} /></div></div>
            <div className="card lift">
              <div className="stat-label">Promedio del curso</div>
              <div className="stat-num">{stats.resumen.promedio == null ? '—' : <CountUp value={stats.resumen.promedio} decimals={1} />}</div>
              <span className="tag tag-gray">{stats.resumen.corregidas} corregidas</span>
            </div>
            <div className="card lift">
              <div className="stat-label">Temas con alerta</div>
              <div className="stat-num"><CountUp value={stats.alertas.length} /></div>
              {stats.alertas.length > 0 && <span className="tag tag-amber"><Icon name="alert" size={13} />Requieren refuerzo</span>}
            </div>
          </div>

          {stats.alertas.map((a) => (
            <div className="alert-amber" key={a.tema} role="alert">
              <Icon name="alert" size={17} />
              <span><b>{a.tema}</b>: el {a.pct_error}% de las respuestas fue incorrecta. Se recomienda realizar una actividad de refuerzo.</span>
            </div>
          ))}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Radar de la clase</div>
            {temas.length > 0
              ? <RadarPanel temas={temas} />
              : <Empty icon="radar" title="Sin datos todavía" text="El radar aparece cuando haya entregas." />}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Error por pregunta</div>
            {stats.preguntas.map((p) => (
              <div className="list-item" key={p.id}>
                <span style={{ flex: 1 }}><span className="qnum" style={{ display: 'inline', marginRight: 8 }}>P{p.orden}</span>{p.enunciado.slice(0, 80)}{p.enunciado.length > 80 ? '…' : ''}</span>
                <div className={'bar' + (p.pct_error >= 50 ? ' warn' : '')} style={{ width: 120 }}><span style={{ width: `${p.pct_error}%` }} /></div>
                <span className={`tag ${p.pct_error >= 50 ? 'tag-amber' : 'tag-teal'}`} style={{ minWidth: 76, justifyContent: 'center' }}>{p.pct_error}% erró</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-title">Recomendaciones de refuerzo</div>
            {!reco && (
              <button className={'btn btn-amber' + (cargandoIA ? ' is-loading' : '')} onClick={pedirReco} disabled={cargandoIA || !stats.resumen.entregas}>
                <Icon name="sparkles" size={16} />{cargandoIA ? 'Analizando…' : 'Analizar resultados y recomendar refuerzo'}
              </button>
            )}
            {reco && (
              <>
                <p style={{ marginTop: 0 }}>{reco.resumen}</p>
                {(reco.recomendaciones || []).map((r, i) => (
                  <div className="list-item" key={i} style={{ alignItems: 'flex-start' }}>
                    <div><b>{r.tema}</b><div className="muted" style={{ fontSize: 13 }}>{r.motivo}</div><div style={{ marginTop: 4 }}>→ {r.actividad}</div></div>
                  </div>
                ))}
                <button className={'btn btn-ghost btn-sm' + (cargandoIA ? ' is-loading' : '')} style={{ marginTop: 12 }} onClick={pedirReco}>Volver a analizar</button>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'preguntas' && (
        <div className="card">
          {ev.preguntas.map((p) => (
            <div className="list-item" key={p.id} style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="qnum">{p.orden} · {p.tipo.replace('_', ' ')} · {p.dificultad}{p.tema ? ` · ${p.tema}` : ''}</div>
                {p.enunciado}
                <div style={{ color: 'var(--tag-teal-fg)', fontSize: 13, marginTop: 4 }}><Icon name="check" size={13} /> {p.respuesta_correcta}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
