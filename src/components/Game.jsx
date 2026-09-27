import Board from './Board';
import StatusLine from './StatusLine';
import Captures from './Captures';
import MoveList from './MoveList';
import Players from './Players';
import Chat from './Chat';

export default function Game({ table }) {
  const {
    mode,
    room,
    statusLine,
    moveRows,
    captures,
    chat,
    chatVisible,
    note,
    leaveTable,
    sendChat,
    setStatusMsg
  } = table;

  const underInSide = mode === 'local';

  const copyCode = () => {
    if (!room || !room.code) return;
    const done = () => setStatusMsg('Room code ' + room.code + ' copied.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(room.code).then(done).catch(done);
    } else {
      done();
    }
  };

  const under = (
    <div id="under">
      <Captures captures={captures} />
      <MoveList rows={moveRows} />
    </div>
  );

  return (
    <main id="game">
      <div className="topbar">
        <div className="roomtag">
          {mode === 'local' ? (
            <>
              <span>Local game</span>
              <span className="roomcode">PASS &amp; PLAY</span>
            </>
          ) : (
            <>
              <span>Room</span>
              <span className="roomcode" title="Click to copy" onClick={copyCode}>
                {room ? room.code : ''}
              </span>
              {room && room.role === 'host' && <span>share this code</span>}
            </>
          )}
        </div>
        <button className="leave-btn" onClick={leaveTable}>
          Leave table
        </button>
      </div>

      <div className="layout">
        <div className="board-col">
          <StatusLine statusLine={statusLine} />
          <Board table={table} />
          {!underInSide && under}
        </div>

        <aside className="side-col">
          <Players table={table} />
          {chatVisible && <Chat messages={chat} onSend={sendChat} />}
          {underInSide && under}
          {note && <div className="side-note" dangerouslySetInnerHTML={{ __html: note }} />}
        </aside>
      </div>
    </main>
  );
}
