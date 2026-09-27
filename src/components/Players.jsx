function Row({ color, label, active, tag, you }) {
  return (
    <div className={'player-row' + (active ? ' active' : '') + (you ? ' you' : '')}>
      <span className={'dot ' + color} />
      <span className="nm">{label}</span>
      <span className="tag">{tag}</span>
    </div>
  );
}

export default function Players({ table }) {
  const { mode, myColor, playerName, opponentName, connected, game, version } = table;
  void version;
  const over = game.isGameOver();

  if (mode !== 'online') {
    return (
      <div className="players">
        <Row color="w" label="White" active={!over && game.turn() === 'w'} tag={!over && game.turn() === 'w' ? 'to move' : 'waiting'} />
        <Row color="b" label="Black" active={!over && game.turn() === 'b'} tag={!over && game.turn() === 'b' ? 'to move' : 'waiting'} />
      </div>
    );
  }

  const rows = [
    { name: playerName, color: myColor, you: true, pending: false },
    { name: opponentName, color: myColor === 'w' ? 'b' : 'w', you: false, pending: !connected }
  ];

  return (
    <div className="players">
      {rows.map((p, i) => {
        const active = !p.pending && p.color === game.turn() && !over;
        const label = p.pending ? 'Waiting…' : p.color === 'w' ? 'White' : 'Black';
        return (
          <Row
            key={i}
            color={p.color}
            label={p.pending ? 'Waiting…' : p.name + (p.you ? ' (you)' : '')}
            active={active}
            tag={p.pending ? 'waiting' : label}
            you={p.you}
          />
        );
      })}
    </div>
  );
}
