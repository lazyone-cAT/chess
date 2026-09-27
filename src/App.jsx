import { useEffect, useRef } from 'react';
import Backdrop from './components/Backdrop';
import Home from './components/Home';
import Game from './components/Game';
import CutIn from './components/CutIn';
import Cinematic from './components/Cinematic';
import { useChessTable } from './hooks/useChessTable';
import { createAmbient } from './fx/ambient';

export default function App() {
  const table = useChessTable();
  const ambientRef = useRef(null);

  useEffect(() => createAmbient(ambientRef.current, table.reduced), [table.reduced]);

  return (
    <>
      <Backdrop which={table.backdrop} reduced={table.reduced} />
      <canvas id="ambient" ref={ambientRef} />
      <div className="vignette" />
      <div className="scanlines" />

      <div className="shell">
        <header id="brand">
          <div className="mark">
            <span>&#9822;</span>
          </div>
          <div className="brand-text">
            <span className="b1">HEARTH</span>
            <span className="b2">CHESS</span>
          </div>
          <div className="brand-sub">private tables &middot; real-time &middot; live chat</div>
        </header>

        {table.screen === 'home' ? <Home table={table} /> : <Game table={table} />}
      </div>

      <CutIn data={table.cutin} />
      <Cinematic data={table.cinematic} onAgain={table.playAgain} onClose={table.closeCinematic} />
    </>
  );
}
