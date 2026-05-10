import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchWithAuth } from "../lib/api.js";
import StatCard from "../components/StatCard.jsx";

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProgramDetailPage() {
  const { programId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`/api/dashboard/programs/${programId}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [programId]);

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;

  const { program, advocateCount, referralsByStatus, payoutsByStatus, totalPayoutsCents } = data;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/dashboard" className="btn btn-ghost" style={{ marginBottom: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
            &larr; Back to Dashboard
          </Link>
          <h1 className="page-title">{program.name}</h1>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard label="Advocates" value={advocateCount} />
        <StatCard label="Total Referrals" value={Object.values(referralsByStatus).reduce((a, b) => a + b, 0)} />
      </div>

      <h2 style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>
        Referrals by Status
      </h2>
      <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard label="Pending" value={referralsByStatus.pending} color="var(--color-pending)" />
        <StatCard label="Eligible" value={referralsByStatus.eligible} color="var(--color-eligible)" />
        <StatCard label="Paid" value={referralsByStatus.paid} color="var(--color-paid)" />
        <StatCard label="Failed" value={referralsByStatus.failed} color="var(--color-failed)" />
      </div>

      <h2 style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Payouts by Status
      </h2>
      <div className="stats-grid">
        <StatCard label="Pending" value={formatCents(payoutsByStatus.pending)} color="var(--color-warning)" />
        <StatCard label="Processed" value={formatCents(payoutsByStatus.processed)} color="var(--color-success)" />
        <StatCard label="Failed" value={formatCents(payoutsByStatus.failed)} color="var(--color-danger)" />
        <StatCard label="Total Paid Out" value={formatCents(totalPayoutsCents)} color="var(--color-success)" />
      </div>
    </div>
  );
}