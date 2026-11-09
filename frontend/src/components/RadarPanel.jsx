import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { Empty } from './Misc.jsx';

// Radar de la clase: cada tema es un punto. Cuanto más lejos del centro, más % de error.
// El anillo punteado (50%) marca el umbral de alerta. La lista de al lado da los números exactos.
const C = 160;
const R0 = 14;
const RMAX = 138;
const UMBRAL = 50;
const rad = (pct) => R0 + (Math.max(0, Math.min(100, pct)) / 100) * (RMAX - R0);
const corto = (s, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function RadarPanel({ temas }) {
  const [activo, setActivo] = useState(null);
  const n = temas.length;

  const puntos = useMemo(
    () =>
      temas.map((t, i) => {
        const ang = ((-90 + (n === 1 ? 35 : (360 / n) * i)) * Math.PI) / 180;
        const r = rad(t.pct_error);
        return { ...t, i, cos: Math.cos(ang), sin: Math.sin(ang), x: C + r * Math.cos(ang), y: C + r * Math.sin(ang), alerta: t.pct_error >= UMBRAL };
      }),
    [temas, n]
  );

  if (!n) {
    return <Empty icon="radar" title="Todavía no hay datos" text="Cuando haya entregas corregidas, acá aparece el radar de temas." />;
  }

  return (
    <div>
      <div className="radar-wrap">
        <div className="sweep" />
        <svg
          className="radar-svg"
          viewBox="0 0 320 320"
          role="img"
          aria-label="Radar de temas. Cuanto más lejos del centro, mayor es el porcentaje de error. La lista de abajo tiene los valores."
        >
          {[0, 25, 50, 75, 100].map((p) => (
            <circle key={p} cx={C} cy={C} r={rad(p)} className={`rs-ring${p === UMBRAL ? ' alert' : ''}`} style={p === 0 ? { opacity: 0.5 } : undefined} />
          ))}
          {puntos.map((p) => (
            <line key={`s${p.i}`} className="rs-axis" x1={C} y1={C} x2={C + RMAX * p.cos} y2={C + RMAX * p.sin} />
          ))}
          {[25, 50, 75, 100].map((p) => (
            <text key={`t${p}`} className="rs-tick" x={C + 4} y={C - rad(p) - 3}>
              {p}%
            </text>
          ))}

          {puntos.map((p) => {
            const on = activo === p.i;
            const mostrarEtiqueta = p.alerta || on;
            return (
              <g
                key={p.i}
                className={`rs-blip${p.alerta ? ' alert' : ''}${on ? ' on' : ''}`}
                onMouseEnter={() => setActivo(p.i)}
                onMouseLeave={() => setActivo(null)}
              >
                <title>{`${p.tema}: ${p.pct_error}% de error (${p.preguntas} ${p.preguntas === 1 ? 'pregunta' : 'preguntas'})`}</title>
                {p.alerta && <circle className="halo" cx={p.x} cy={p.y} r="8" />}
                <circle className="core" cx={p.x} cy={p.y} r="8" fill={p.alerta ? 'var(--amber)' : 'var(--teal)'} />
                {mostrarEtiqueta && (
                  <text className="rs-label" x={p.x + (p.cos > 0 ? -14 : 14)} y={p.y + 4} textAnchor={p.cos > 0 ? 'end' : 'start'}>
                    {corto(p.tema)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="rp-list">
        {puntos.map((p) => (
          <div
            key={p.i}
            className={`rp-row${activo === p.i ? ' on' : ''}`}
            tabIndex={0}
            onMouseEnter={() => setActivo(p.i)}
            onMouseLeave={() => setActivo(null)}
            onFocus={() => setActivo(p.i)}
            onBlur={() => setActivo(null)}
          >
            <div style={{ minWidth: 0 }}>
              <div className="name">{p.tema}</div>
              <div className="sub">
                {p.preguntas} {p.preguntas === 1 ? 'pregunta' : 'preguntas'}
              </div>
            </div>
            {p.alerta ? (
              <span className="tag tag-amber"><Icon name="alert" size={13} />{p.pct_error}% error · reforzar</span>
            ) : (
              <span className="tag tag-teal"><Icon name="check" size={13} />{p.pct_error}% error · bien</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
