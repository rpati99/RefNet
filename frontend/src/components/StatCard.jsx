export default function StatCard({ label, value, subtext, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={color ? { color } : {}}>{value}</div>
      {subtext && <div className="stat-card__subtext">{subtext}</div>}
    </div>
  );
}