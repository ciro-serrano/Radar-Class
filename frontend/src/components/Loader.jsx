import { useEffect, useState } from 'react';

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function RadarLoader({ size = 64 }) {
  return (
    <span className="radar-loader" style={{ '--s': `${size}px` }} role="status" aria-label="Cargando">
      <i />
    </span>
  );
}

export function PageLoader({ label = 'Cargando…' }) {
  return (
    <div className="page-loader">
      <RadarLoader size={72} />
      <span>{label}</span>
    </div>
  );
}

// Bloques que imitan el contenido mientras llegan los datos
export function Skeleton({ lines = 3, widths = ['92%', '78%', '64%'] }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton sk-line" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 2 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i}>
          <div className="skeleton" style={{ height: 20, width: '55%', marginBottom: 22 }} />
          <Skeleton lines={3} />
        </div>
      ))}
    </>
  );
}

const PASOS_PDF = ['Leyendo tu material…', 'Identificando los conceptos clave…', 'Redactando las preguntas…', 'Revisando respuestas y dificultad…'];
const PASOS_TEMA = ['Analizando el tema…', 'Definiendo qué conviene evaluar…', 'Redactando las preguntas…', 'Revisando respuestas y dificultad…'];

// Pantalla de espera mientras la IA genera: cambia de mensaje para que se note que avanza
export function GeneratingState({ conPdf }) {
  const pasos = conPdf ? PASOS_PDF : PASOS_TEMA;
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, pasos.length - 1)), 3200);
    return () => clearInterval(t);
  }, [pasos.length]);

  return (
    <div className="gen-state" role="status" aria-live="polite">
      <RadarLoader size={92} />
      <div className="gen-msg" key={i}>{pasos[i]}</div>
      <div className="gen-steps" aria-hidden="true">
        {pasos.map((_, k) => (
          <i key={k} className={k <= i ? 'on' : ''} />
        ))}
      </div>
      <div className="gen-skeleton" aria-hidden="true">
        <div className="skeleton" style={{ height: 52 }} />
        <div className="skeleton" style={{ height: 52, width: '88%' }} />
        <div className="skeleton" style={{ height: 52, width: '94%' }} />
      </div>
    </div>
  );
}
