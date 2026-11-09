import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { useTheme } from './theme.jsx';
import Backdrop from './components/Backdrop.jsx';
import Icon from './components/Icon.jsx';
import { Brand } from './components/Misc.jsx';
import Login from './pages/Login.jsx';
import Cursos from './pages/docente/Cursos.jsx';
import Curso from './pages/docente/Curso.jsx';
import Generar from './pages/docente/Generar.jsx';
import Evaluacion from './pages/docente/Evaluacion.jsx';
import Banco from './pages/docente/Banco.jsx';
import MisCursos from './pages/alumno/MisCursos.jsx';
import Rendir from './pages/alumno/Rendir.jsx';
import Resultado from './pages/alumno/Resultado.jsx';

const iniciales = (nombre = '') =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

function Layout({ rol }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol !== rol) return <Navigate to={user.rol === 'docente' ? '/docente' : '/alumno'} replace />;

  const links =
    rol === 'docente'
      ? [
          ['/docente', 'Mis cursos', 'book', true],
          ['/docente/generar', 'Generar evaluación', 'sparkles'],
          ['/docente/banco', 'Banco de preguntas', 'archive'],
        ]
      : [['/alumno', 'Mis cursos', 'book', true]];

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Principal">
          {links.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar">{iniciales(user.nombre)}</span>
            <span className="who" style={{ minWidth: 0 }}>
              <div className="user-name">{user.nombre}</div>
              <div className="user-role">{rol === 'docente' ? 'Docente' : 'Alumno'}</div>
            </span>
          </div>
          <div className="foot-actions">
            <button className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} title="Cambiar tema">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button className="icon-btn grow" onClick={logout}>
              <Icon name="logout" size={16} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        {/* key = ruta: cada pantalla entra con su animación */}
        <div className="page" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <Backdrop />
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.rol === 'docente' ? '/docente' : '/alumno'} replace /> : <Login />} />
        <Route path="/docente" element={<Layout rol="docente" />}>
          <Route index element={<Cursos />} />
          <Route path="cursos/:id" element={<Curso />} />
          <Route path="generar" element={<Generar />} />
          <Route path="evaluaciones/:id" element={<Evaluacion />} />
          <Route path="banco" element={<Banco />} />
        </Route>
        <Route path="/alumno" element={<Layout rol="alumno" />}>
          <Route index element={<MisCursos />} />
          <Route path="rendir/:id" element={<Rendir />} />
          <Route path="resultado/:id" element={<Resultado />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
