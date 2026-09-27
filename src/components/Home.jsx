import { useState } from 'react';

const HERO = 'Take the board.';

export default function Home({ table }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const { createRoom, joinRoom, playLocal, statusMsg } = table;

  return (
    <main id="home">
      <h1 className="hero">
        {HERO.split('').map((ch, i) => (
          <span className="l" key={i} style={{ animationDelay: 0.05 + i * 0.035 + 's' }}>
            {ch === ' ' ? '\u00a0' : ch}
          </span>
        ))}
      </h1>
      <p className="lede">
        Open a private table and play a friend, or pass the device and go head to head. Every move
        lands with <b>speed lines, impact sparks and a shake you can feel</b>.
      </p>

      <div className="cards">
        <div className="card full">
          <h3>Your name</h3>
          <input
            placeholder="What should we call you?"
            maxLength={20}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="card">
          <h3>Start a table</h3>
          <button className="primary" style={{ width: '100%' }} onClick={() => createRoom(name)}>
            Create a room
          </button>
          <div className="sub">You take White. Share the 4-letter code.</div>
        </div>

        <div className="card">
          <h3>Join a table</h3>
          <div className="row">
            <input
              placeholder="CODE"
              maxLength={6}
              autoComplete="off"
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button onClick={() => joinRoom(name, code)}>Join</button>
          </div>
          <div className="sub">Enter your friend's room code.</div>
        </div>

        <div className="card full">
          <h3>No one around?</h3>
          <button style={{ width: '100%' }} onClick={playLocal}>
            Play locally, same screen
          </button>
          <div className="sub">Instant rematch, no connection needed.</div>
        </div>
      </div>

      <div className="chips">
        <span className="chip">
          <i>&#9822;</i>Peer-to-peer
        </span>
        <span className="chip">
          <i>&#9830;</i>Board FX
        </span>
        <span className="chip">
          <i>&#9827;</i>Same-screen mode
        </span>
      </div>

      <div id="status-msg">{statusMsg}</div>
    </main>
  );
}
