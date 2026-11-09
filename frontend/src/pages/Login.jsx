import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Brand } from '../components/Misc.jsx';

export default function Login() {
  const { login } = useAuth();
  const [modo, setModo] = useState('login');
  const [f, setF] = useState({ nombre: '', email: '', password: '', rol: 'alumno' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    if (cargando) return;
    setError('');
    setCargando(true);
    try {
      const data = await api(modo === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: f });
      login(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="center-wrap">
      <section className="hero">
        <Brand />
        <h2>
          Tomale el <em>pulso</em> a tu clase.
        </h2>
        <p>Generá evaluaciones con IA, incluso desde tu propio PDF. Corregí más rápido y enterate qué temas hay que reforzar antes de que sea tarde.</p>
        <ul>
          <li><span className="ico"><Icon name="file" /></span>Evaluaciones armadas a partir de tus apuntes en PDF</li>
          <li><span className="ico"><Icon name="shield" /></span>La IA sugiere, vos confirmás cada nota</li>
          <li><span className="ico"><Icon name="radar" /></span>Radar de los temas con más errores</li>
        </ul>
      </section>

      <form className="login-card" onSubmit={enviar}>
        <h3>{modo === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta'}</h3>
        <div className="login-sub">{modo === 'login' ? 'Ingresá para seguir con tus cursos.' : 'Elegí cómo vas a usar Radar Class.'}</div>

        {error && <div className="error" role="alert"><Icon name="alert" size={16} />{error}</div>}

        {modo === 'registro' && (
          <>
            <div className="seg" role="group" aria-label="Tipo de cuenta">
              {[['alumno', 'Soy alumno'], ['docente', 'Soy docente']].map(([v, l]) => (
                <button type="button" key={v} className={f.rol === v ? 'on' : ''} aria-pressed={f.rol === v} onClick={() => setF({ ...f, rol: v })}>{l}</button>
              ))}
            </div>
            <div className="field"><label htmlFor="nombre">Nombre y apellido</label><input id="nombre" type="text" value={f.nombre} onChange={set('nombre')} required /></div>
          </>
        )}
        <div className="field"><label htmlFor="email">Correo</label><input id="email" type="email" value={f.email} onChange={set('email')} required /></div>
        <div className="field"><label htmlFor="password">Contraseña</label><input id="password" type="password" value={f.password} onChange={set('password')} required minLength={6} /></div>

        <button className={'btn btn-amber' + (cargando ? ' is-loading' : '')} style={{ width: '100%', padding: '14px' }} aria-busy={cargando}>
          {cargando ? 'Un momento…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5 }} className="muted">
          {modo === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
          <button type="button" className="link" onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); }}>
            {modo === 'login' ? 'Registrate' : 'Iniciá sesión'}
          </button>
        </div>
      </form>
    </div>
  );
}
