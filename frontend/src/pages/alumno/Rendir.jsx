import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { PageLoader } from '../../components/Loader.jsx';

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Rendir() {
  const { id } = useParams();
  const nav = useNavigate();
  const [ex, setEx] = useState(null);
  const [i, setI] = useState(0);
  const [resp, setResp] = useState({});
  const [seg, setSeg] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviado = useRef(false);

  useEffect(() => {
    api(`/intentos/evaluacion/${id}/iniciar`, { method: 'POST' })
      .then((d) => { setEx(d); setSeg(d.segundos_restantes); })
      .catch((e) => setError(e.message));
  }, [id]);

  const enviar = useCallback(async () => {
    if (enviado.current || !ex) return;
    enviado.current = true; setEnviando(true);
    try {
      await api(`/intentos/${ex.intento_id}/enviar`, { method: 'POST', body: { respuestas: resp } });
      nav(`/alumno/resultado/${ex.intento_id}`, { replace: true });
    } catch (e) { enviado.current = false; setEnviando(false); setError(e.message); }
  }, [ex, resp, nav]);

  // Cuenta regresiva: al llegar a 0 se entrega solo
  useEffect(() => {
    if (seg == null) return;
    if (seg <= 0) { enviar(); return; }
    const t = setTimeout(() => setSeg((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seg, enviar]);

  if (error && !ex) return <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>;
  if (!ex) return <PageLoader label="Preparando tu evaluación…" />;

  const p = ex.preguntas[i];
  const total = ex.preguntas.length;
  const respondidas = Object.values(resp).filter((v) => String(v).trim()).length;

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">{ex.tema}</div><h1>{ex.titulo}</h1></div>
        {seg != null && <span className={'timer' + (seg < 60 ? ' low' : '')} role="timer"><Icon name="clock" size={16} />{mmss(seg)} restantes</span>}
      </div>
      {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="progressbar"><div className="progressbar-fill" style={{ width: `${(respondidas / total) * 100}%` }} /></div>
        <span className="muted" style={{ fontSize: 12.5 }}>{respondidas} / {total} respondidas</span>
      </div>

      <div className="qdots" role="group" aria-label="Ir a la pregunta">
        {ex.preguntas.map((q, k) => (
          <button key={q.id} type="button" aria-label={`Pregunta ${k + 1}${String(resp[q.id] ?? '').trim() ? ' respondida' : ''}`} aria-current={k === i ? 'step' : undefined}
            className={'qdot' + (String(resp[q.id] ?? '').trim() ? ' done' : '') + (k === i ? ' current' : '')} onClick={() => setI(k)}>{k + 1}</button>
        ))}
      </div>

      <div className="card" key={p.id}>
        <div className="qnum">Pregunta {i + 1} de {total}</div>
        <div style={{ fontSize: 15, marginBottom: 14 }}>{p.enunciado}</div>
        {p.tipo === 'desarrollo' ? (
          <textarea
            value={resp[p.id] || ''}
            placeholder="Escribí tu respuesta…"
            onChange={(e) => setResp({ ...resp, [p.id]: e.target.value })}
            onPaste={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
          />
        ) : (
          p.opciones.map((o) => (
            <label key={o} className={'opt' + (resp[p.id] === o ? ' sel' : '')}>
              <input type="radio" name={`q${p.id}`} checked={resp[p.id] === o} onChange={() => setResp({ ...resp, [p.id]: o })} />{o}
            </label>
          ))
        )}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <div className="row">
          <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
          {i < total - 1 && <button className="btn btn-primary" onClick={() => setI(i + 1)}>Siguiente</button>}
        </div>
        {i === total - 1 && (
          <button className={'btn btn-amber' + (enviando ? ' is-loading' : '')} disabled={enviando} onClick={() => { if (respondidas === total || confirm(`Respondiste ${respondidas} de ${total}. ¿Entregar igual?`)) enviar(); }}>
            {enviando ? 'Entregando…' : 'Entregar evaluación'}
          </button>
        )}
      </div>
    </>
  );
}
