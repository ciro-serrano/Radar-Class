// Fondo vivo: manchas de color que derivan lento + un radar que barre en silencio.
const RINGS = [60, 120, 180, 240];
const BLIPS = [
  { x: 330, y: 150, d: '0s' },
  { x: 180, y: 330, d: '1.6s' },
  { x: 380, y: 300, d: '3.1s' },
  { x: 140, y: 190, d: '2.2s' },
];

export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="blob a" />
      <div className="blob b" />
      <div className="blob c" />
      <div className="radar-bg">
        <div className="sweep" />
        <svg viewBox="0 0 500 500" fill="none" stroke="var(--ring)" strokeWidth="1">
          {RINGS.map((r) => (
            <circle key={r} cx="250" cy="250" r={r} />
          ))}
          <path d="M10 250h480M250 10v480M80 80l340 340M420 80L80 420" />
          {BLIPS.map((b) => (
            <circle key={b.x} className="bg-blip" cx={b.x} cy={b.y} r="3.5" stroke="none" style={{ animationDelay: b.d }} />
          ))}
        </svg>
      </div>
    </div>
  );
}
