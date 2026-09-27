import { useEffect, useRef, useState } from 'react';

export default function Chat({ messages, onSend }) {
  const [text, setText] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div id="chat-box">
      <div className="chat-h">Table talk</div>
      <div id="chat-log" ref={logRef}>
        {messages.map((m, i) =>
          m.kind === 'sys' ? (
            <div className="sys" key={i}>
              {m.text}
            </div>
          ) : (
            <div className="msg" key={i}>
              <b>
                {m.name}
                {m.self ? ' (you)' : ''}:
              </b>
              {m.text}
            </div>
          )
        )}
      </div>
      <form id="chat-form" onSubmit={submit}>
        <input
          placeholder="Say something…"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
