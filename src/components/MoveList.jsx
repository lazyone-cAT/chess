import { useEffect, useRef } from 'react';

function MoveSpan({ m }) {
  if (!m) return <span className="mv" />;
  const cls =
    'mv' +
    (m.flags.indexOf('k') >= 0 && m.flags.indexOf('q') >= 0 ? ' mate' : m.captured ? ' cap' : '');
  return <span className={cls}>{m.san}</span>;
}

export default function MoveList({ rows }) {
  const bodyRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [rows]);

  return (
    <div id="movelist" ref={listRef}>
      <div className="ml-h">Moves</div>
      <div className="ml-body" ref={bodyRef}>
        {!rows.length ? (
          <div className="ml-empty">The first move starts the fight.</div>
        ) : (
          rows.map((r) => (
            <div className="ml-row" key={r.no}>
              <span className="no">{r.no}.</span>
              <MoveSpan m={r.a} />
              <MoveSpan m={r.b} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
