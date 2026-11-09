import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true" />
      Radar Class
    </div>
  );
}

export function Empty({ icon = 'radar', title, text, children }) {
  return (
    <div className="empty">
      <span className="ico"><Icon name={icon} size={24} /></span>
      <b>{title}</b>
      {text && <span>{text}</span>}
      {children}
    </div>
  );
}

// Número que sube hasta su valor (respeta "reducir movimiento")
export function CountUp({ value, decimals = 0, duration = 900 }) {
  const target = Number(value);
  const [v, setV] = useState(0);

  useEffect(() => {
    if (Number.isNaN(target)) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return undefined;
    }
    let raf;
    let t0;
    const tick = (t) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / duration);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <>{Number.isNaN(target) ? '—' : v.toFixed(decimals)}</>;
}
