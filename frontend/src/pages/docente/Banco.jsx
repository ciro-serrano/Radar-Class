import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { Skeleton } from '../../components/Loader.jsx';
import { Empty } from '../../components/Misc.jsx';

const TIPO = { opcion_multiple: 'Opción múltiple', verdadero_falso: 'V/F', desarrollo: 'Desarrollo' };
const DIF = { baja: 'tag-teal', media: 'tag-gray', alta: 'tag-amber' };

export default function Banco() {
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState({ tema: '', dificultad: '', tipo: '' });
  const [error, setError] = useState('');

  const cargar = () => {
    const qs = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString();
    api('/banco' + (qs ? `?${qs}` : '')).then(setLista).catch((e) => { setError(e.message); setLista([]); });
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [filtro]);

  async function borrar(id) {
    if (!confirm('¿Eliminar esta pregunta del banco?')) return;
    await api(`/banco/${id}`, { method: 'DELETE' });
    cargar();
  }

  return (
    <>
      <div className="topbar"><div><div className="eyebrow">Biblioteca reutilizable</div><h1>Banco de preguntas</h1></div></div>
      {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}
      <div className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <input type="text" aria-label="Filtrar por tema" placeholder="Filtrar por tema…" style={{ width: 220 }} value={filtro.tema} onChange={(e) => setFiltro({ ...filtro, tema: e.target.value })} />
          <select aria-label="Dificultad" style={{ width: 'auto' }} value={filtro.dificultad} onChange={(e) => setFiltro({ ...filtro, dificultad: e.target.value })}><option value="">Dificultad: todas</option><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select>
          <select aria-label="Tipo" style={{ width: 'auto' }} value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}><option value="">Tipo: todos</option>{Object.entries(TIPO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        {lista === null && <Skeleton lines={4} />}
        {lista?.length === 0 && <Empty icon="archive" title="El banco está vacío" text="Guardá preguntas desde “Generar evaluación” con el botón “Al banco”." />}
        {lista?.length > 0 && (
          <table>
            <thead><tr><th>Pregunta</th><th>Tema</th><th>Tipo</th><th>Dificultad</th><th></th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>{p.enunciado}</td><td>{p.tema}</td><td>{TIPO[p.tipo]}</td>
                  <td><span className={`tag ${DIF[p.dificultad]}`}>{p.dificultad}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => borrar(p.id)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
