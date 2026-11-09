import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { CardSkeleton } from '../../components/Loader.jsx';
import { Empty } from '../../components/Misc.jsx';

export default function Cursos() {
  const [cursos, setCursos] = useState(null);
  const [form, setForm] = useState({ nombre: '', materia: '' });
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(null);
  const [creando, setCreando] = useState(false);

  const cargar = () => api('/cursos').then(setCursos).catch((e) => { setError(e.message); setCursos([]); });
  useEffect(() => { cargar(); }, []);

  async function crear(e) {
    e.preventDefault();
    if (creando) return;
    setError('');
    setCreando(true);
    try {
      await api('/cursos', { method: 'POST', body: form });
      setForm({ nombre: '', materia: '' });
      await cargar();
    } catch (err) { setError(err.message); } finally { setCreando(false); }
  }
  async function regenerar(id) {
    if (!confirm('El código anterior dejará de funcionar para nuevos alumnos. ¿Regenerar?')) return;
    await api(`/cursos/${id}/regenerar-codigo`, { method: 'POST' });
    cargar();
  }
  function copiar(c) {
    navigator.clipboard?.writeText(c.codigo_acceso);
    setCopiado(c.id);
    setTimeout(() => setCopiado(null), 1600);
  }

  return (
    <>
      <div className="topbar"><div><div className="eyebrow">Comisiones a cargo</div><h1>Mis cursos</h1></div></div>
      {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}

      <form className="card" onSubmit={crear} style={{ marginBottom: 18 }}>
        <div className="section-title">Crear curso</div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}><label htmlFor="c-nombre">Nombre del curso</label><input id="c-nombre" type="text" placeholder="Ej: 3° B" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div style={{ flex: 1, minWidth: 180 }}><label htmlFor="c-materia">Materia</label><input id="c-materia" type="text" placeholder="Ej: Programación" value={form.materia} onChange={(e) => setForm({ ...form, materia: e.target.value })} required /></div>
          <button className={'btn btn-amber' + (creando ? ' is-loading' : '')}>{creando ? 'Creando…' : '+ Crear curso'}</button>
        </div>
      </form>

      <div className="grid grid-2">
        {cursos === null && <CardSkeleton count={2} />}
        {cursos?.map((c) => (
          <div className="card lift" key={c.id}>
            <div className="section-title">{c.materia} · {c.nombre}</div>
            <label>Código para que se unan tus alumnos</label>
            <div className="row" style={{ marginBottom: 16 }}>
              <div className="code-box">{c.codigo_acceso}</div>
              <button className="btn btn-ghost" onClick={() => copiar(c)}>{copiado === c.id ? '¡Copiado!' : 'Copiar'}</button>
            </div>
            <div className="row" style={{ marginBottom: 16 }}>
              <span className="tag tag-teal">{c.alumnos} {Number(c.alumnos) === 1 ? 'alumno unido' : 'alumnos unidos'}</span>
            </div>
            <div className="row">
              <Link className="btn btn-primary" to={`/docente/cursos/${c.id}`}>Ver evaluaciones</Link>
              <button className="btn btn-ghost" onClick={() => regenerar(c.id)}>Regenerar código</button>
            </div>
          </div>
        ))}
        {cursos?.length === 0 && (
          <Empty icon="book" title="Todavía no creaste ningún curso" text="Creá el primero arriba y te damos el código para que tus alumnos se unan." />
        )}
      </div>
    </>
  );
}
