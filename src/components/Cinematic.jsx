export default function Cinematic({ data, onAgain, onClose }) {
  if (!data) return null;
  return (
    <div className="cinematic on" key={data.title + data.sub}>
      <div className="cin-backdrop" />
      <div className="cin-shake">
        <div className="cin-slash a" />
        <div className="cin-slash b" />
        <div className="cin-content">
          <div className="cin-kicker">Match over</div>
          <div className="cin-title">{data.title}</div>
          <div className="cin-sub">{data.sub}</div>
          <div className="cin-actions">
            <button className="primary" onClick={onAgain}>
              Play again
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
