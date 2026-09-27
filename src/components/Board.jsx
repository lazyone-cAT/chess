import { useEffect, useMemo, useRef } from 'react';
import { FILES } from '../lib/glyphs';
import { BoardFX } from '../fx/BoardFX';

const SQUARES = (() => {
  const list = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      list.push({
        sq: FILES[f] + (8 - r),
        light: (r + f) % 2 === 0,
        file: r === 7 ? FILES[f] : null,
        rank: f === 0 ? String(8 - r) : null
      });
    }
  }
  return list;
})();

export default function Board({ table }) {
  const {
    game,
    fxRef,
    selected,
    hover,
    setHover,
    hints,
    checkSq,
    lastMove,
    gameOver,
    onSquareClick,
    reduced,
    introKey,
    getQueueDepth
  } = table;

  const boardRef = useRef(null);
  const canvasRef = useRef(null);
  const shakeRef = useRef(null);
  const hoverRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;
  hoverRef.current = hover;

  useEffect(() => {
    const fx = new BoardFX({
      canvas: canvasRef.current,
      boardEl: boardRef.current,
      shakeEl: shakeRef.current,
      getBoard: () => game.board(),
      getInteraction: () => ({ selected: selectedRef.current, hover: hoverRef.current }),
      getQueueDepth,
      reduced
    });
    fxRef.current = fx;
    fx.start();

    const ro = new ResizeObserver(() => fx.resize());
    ro.observe(boardRef.current);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        fx.resize();
        fx.sync();
      });
    }
    return () => {
      ro.disconnect();
      fx.destroy();
      if (fxRef.current === fx) fxRef.current = null;
    };
  }, [game, fxRef, getQueueDepth, reduced, introKey]);

  const checkClass = useMemo(() => (gameOver && checkSq ? 'over' : ''), [gameOver, checkSq]);

  return (
    <div className={'board-wrap ' + checkClass} key={introKey}>
      <div className="board-shake" ref={shakeRef}>
        <div className="board" ref={boardRef}>
          {SQUARES.map(({ sq, light, file, rank }) => {
            const hint = hints[sq];
            const cls = [
              'sq',
              light ? 'light' : 'dark',
              sq === selected ? 'sel' : '',
              hint ? 'hint' : '',
              hint === 'cap' ? 'cap' : '',
              lastMove && (sq === lastMove.from || sq === lastMove.to) ? 'last' : '',
              sq === checkSq ? (gameOver ? 'checkmate-glow' : 'in-check') : ''
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={sq}
                className={cls}
                onMouseEnter={() => setHover(sq)}
                onMouseLeave={() => setHover((h) => (h === sq ? null : h))}
                onClick={() => onSquareClick(sq)}
              >
                {file && <span className="co file">{file}</span>}
                {rank && <span className="co rank">{rank}</span>}
              </div>
            );
          })}
        </div>
        <canvas className="fx" ref={canvasRef} />
        <div className="board-glow" />
      </div>
    </div>
  );
}
