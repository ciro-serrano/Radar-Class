import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { Skeleton } from '../../components/Loader.jsx';
import { Empty } from '../../components/Misc.jsx';

const ESTADO = { borrador: 'tag-gray', publicada: 'tag-teal', cerrada: 'tag-amber' };

export default function Curso() {
  const { id } = useParams();
  const [evals, setEvals] = useState(null);
  const [curso, setCurso] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/cursos').then((cs) => setCurso(cs.find((c) => String(c.id) === id))).catch(() => {});
    api(`/evaluaciones/curso/${id}`).then(setEvals).catch((e) => { setError(e.message); setEvals([]); });
  }, [id]);

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">{curso?.materia ?? 'Curso'}</div><h1>{curso ? curso.nombre : 'Evaluaciones'}</h1></div>
        <Link className="btn btn-amber" to={`/docente/generar?curso=${id}`}><Icon name="sparkles" size={16} />Nueva evaluación</Link>
      </div>
      {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}
      <div className="card">
        <div className="section-title">Evaluaciones</div>
        {evals === null && <Skeleton lines={3} />}
        {evals?.map((e) => (
          <div className="list-item" key={e.id}>
            <span>
              <b>{e.titulo}</b> <span className="muted">· {e.tema} · {e.preguntas} preguntas</span>{' '}
              <span className={`tag ${ESTADO[e.estado]}`} style={{ marginLeft: 8 }}>{e.estado}</span>
            </span>
            <span className="row"><span className="muted">{e.entregas} entregas</span><Link className="btn btn-ghost btn-sm" to={`/docente/evaluaciones/${e.id}`}>Abrir</Link></span>
          </div>
        ))}
        {evals?.length === 0 && (
          <Empty icon="sparkles" title="Este curso todavía no tiene evaluaciones" text="Generá la primera con IA, desde un tema o subiendo un PDF." />
        )}
      </div>
    </>
  );
}
