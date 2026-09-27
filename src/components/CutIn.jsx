export default function CutIn({ data }) {
  if (!data) return null;
  return (
    <div className="cutin" key={data.id}>
      <span className="ci-line" />
      <span className="ci-main">{data.main}</span>
      <span className="ci-note" style={{ display: data.note ? 'block' : 'none' }}>
        {data.note}
      </span>
    </div>
  );
}
