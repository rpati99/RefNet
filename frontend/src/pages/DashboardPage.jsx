import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../lib/api.js";
import StatCard from "../components/StatCard.jsx";
import ProgramRow from "../components/ProgramRow.jsx";

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function handleSignOut() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    fetchWithAuth("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;

  const { programs, totalReferrals, referralsByStatus, totalPayoutsCents, payoutsByStatus } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button className="btn btn-ghost" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Referrals" value={totalReferrals} />
        <StatCard label="Eligible" value={referralsByStatus.eligible} color="var(--color-eligible)" />
        <StatCard label="Total Payouts" value={formatCents(totalPayoutsCents)} color="var(--color-success)" />
        <StatCard label="Pending Payouts" value={formatCents(payoutsByStatus.pending)} color="var(--color-warning)" />
      </div>

      {programs.length === 0 ? (
        <div className="empty-state">
          <p>No programs yet.</p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
            Create your first program via the API.
          </p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Status</th>
              <th>Total Referrals</th>
              <th>Reward</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((program) => (
              <ProgramRow key={program.id} program={program} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}