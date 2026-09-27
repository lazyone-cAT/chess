export default function StatusLine({ statusLine }) {
  return (
    <div className={'status-line ' + (statusLine.kind || '')} key={statusLine.text}>
      <span className="st-slash" />
      <span className="status-text">{statusLine.text}</span>
    </div>
  );
}
