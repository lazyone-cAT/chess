import { GLYPH } from '../lib/glyphs';

function PieceRow({ list, adv }) {
  if (!list.length) return <span className="cap-empty">nothing yet</span>;
  const sorted = list;
  return (
    <>
      {sorted.map((t, i) => (
        <span key={t + '-' + i}>{GLYPH[t]}</span>
      ))}
      {adv ? <span className="adv">+{adv}</span> : null}
    </>
  );
}

export default function Captures({ captures }) {
  const { w, b, score } = captures;
  return (
    <div className="caps">
      <div className="cap-row">
        <span className="cap-lab">White took</span>
        <span className="cap-pieces">
          <PieceRow list={w} adv={score > 0 ? score : 0} />
        </span>
      </div>
      <div className="cap-row">
        <span className="cap-lab">Black took</span>
        <span className="cap-pieces">
          <PieceRow list={b} adv={score < 0 ? -score : 0} />
        </span>
      </div>
    </div>
  );
}
