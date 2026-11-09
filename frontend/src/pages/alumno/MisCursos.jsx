import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { CardSkeleton, Skeleton } from '../../components/Loader.jsx';
import { Empty } from '../../components/Misc.jsx';

const fmt = (n) => (n == null ? null : Number(n).toFixed(1));

function CursoCard({ curso }) {
  const [evals, setEvals] = useState(null);
  useEffect(() => { api(`/evaluaciones/curso/${curso.id}`).then(setEvals).catch(() => setEvals([])); }, [curso.id]);
  return (
    <div className="card lift">
      <div className="section-title">{curso.materia} · {curso.nombre}</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Prof. {curso.docente}</div>
      {evals === null && <Skeleton lines={2} />}
      {evals?.map((e) => (
        <div className="list-item" key={e.id}>
          <span>{e.titulo}</span>
          {e.intento_estado === 'enviado' ? (
            <span className="row">
              <span className={`tag ${e.nota_final != null ? 'tag-teal' : 'tag-amber'}`}>{e.nota_final != null ? `${fmt(e.nota_final)}/10` : 'En corrección'}</span>
              <Link className="btn btn-ghost btn-sm" to={`/alumno/resultado/${e.intento_id}`}>Ver resultado</Link>
            </span>
          ) : e.estado === 'publicada' ? (
            <Link className="btn btn-amber btn-sm" to={`/alumno/rendir/${e.id}`}>{e.intento_estado === 'en_curso' ? 'Continuar' : 'Rendir'}</Link>
          ) : (
            <span className="tag tag-gray">Cerrada</span>
          )}
        </div>
      ))}
      {evals?.length === 0 && <div className="muted">Todavía no hay evaluaciones publicadas.</div>}
    </div>
  );
}

export default function MisCursos() {
  const [cursos, setCursos] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [uniendo, setUniendo] = useState(false);

  const cargar = () => api('/cursos').then(setCursos).catch((e) => { setError(e.message); setCursos([]); });
  useEffect(() => { cargar(); }, []);

  async function unirse(e) {
    e.preventDefault();
    if (uniendo) return;
    setError(''); setOk(''); setUniendo(true);
    try {
      const r = await api('/cursos/unirse', { method: 'POST', body: { codigo } });
      setOk(`Te uniste a ${r.curso.nombre}`);
      setCodigo('');
      cargar();
    } catch (err) { setError(err.message); } finally { setUniendo(false); }
  }

  return (
    <>
      <div className="topbar"><div><div className="eyebrow">Alumno</div><h1>Mis cursos</h1></div></div>
      {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}
      {ok && <div className="ok" role="status"><Icon name="check" size={16} />{ok}</div>}
      <form className="card" onSubmit={unirse} style={{ marginBottom: 18, maxWidth: 520 }}>
        <div className="section-title">Unirme a un curso</div>
        <label htmlFor="codigo">Código que te dio tu profesor</label>
        <div className="row">
          <input id="codigo" className="code-input" type="text" placeholder="PROG-X7K2" value={codigo} onChange={(e) => setCodigo(e.target.value)} required style={{ flex: 1 }} />
          <button className={'btn btn-amber' + (uniendo ? ' is-loading' : '')}>{uniendo ? 'Uniéndome…' : 'Unirme'}</button>
        </div>
      </form>
      <div className="grid grid-2">
        {cursos === null && <CardSkeleton count={2} />}
        {cursos?.map((c) => <CursoCard key={c.id} curso={c} />)}
        {cursos?.length === 0 && <Empty icon="book" title="Todavía no estás en ningún curso" text="Pedile el código a tu profesor y pegalo arriba." />}
      </div>
    </>
  );
}
