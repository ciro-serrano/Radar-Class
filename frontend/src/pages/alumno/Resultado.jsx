import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { PageLoader } from '../../components/Loader.jsx';
import { CountUp } from '../../components/Misc.jsx';

const TAG = { correcta: 'tag-teal', incorrecta: 'tag-red', pendiente: 'tag-amber' };
const LABEL = { correcta: 'Correcta', incorrecta: 'Incorrecta', pendiente: 'En revisión del docente' };

export default function Resultado() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/intentos/${id}/resultado`).then(setR).catch((e) => setError(e.message)); }, [id]);

  if (error) return <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>;
  if (!r) return <PageLoader label="Cargando tu resultado…" />;
  const final = r.nota_final != null;
  const nota = Number(final ? r.nota_final : r.nota_parcial);

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">Resultado</div><h1>{r.titulo}</h1></div>
        <Link className="btn btn-ghost" to="/alumno">Volver a mis cursos</Link>
      </div>
      <div className="grid grid-2">
        <div className="card lift">
          <div className="stat-label">{final ? 'Tu nota' : 'Nota parcial (falta que tu docente confirme respuestas)'}</div>
          <div className="stat-num"><CountUp value={nota} decimals={1} />/10</div>
          {final && r.promedio_curso != null && (
            <span className={`tag ${Number(r.nota_final) >= Number(r.promedio_curso) ? 'tag-teal' : 'tag-gray'}`}>
              Promedio del curso: {Number(r.promedio_curso).toFixed(1)}
            </span>
          )}
        </div>
        <div className="card">
          <div className="section-title">Detalle por pregunta</div>
          {r.detalle.map((d) => (
            <div className="list-item" key={d.orden} style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div className="qnum">Pregunta {d.orden}{d.tema ? ` · ${d.tema}` : ''}</div>
                {d.enunciado}
                {d.respuesta_correcta && d.estado === 'incorrecta' && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Respuesta correcta: {d.respuesta_correcta}</div>}
                {d.feedback && <div className="mode-note" style={{ marginTop: 8 }}><Icon name="sparkles" size={15} /><span>{d.feedback}</span></div>}
              </div>
              <span className={`tag ${TAG[d.estado]}`}><Icon name={d.estado === 'correcta' ? 'check' : d.estado === 'incorrecta' ? 'x' : 'clock'} size={13} />{LABEL[d.estado]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
