import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../lib/api.js";
import StatCard from "../components/StatCard.jsx";
import ProgramRow from "../components/ProgramRow.jsx";
import ProgramForm from "../components/ProgramForm.jsx";

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

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
        <div className="actions"><Link className="btn btn-ghost" to="/records">Records</Link><Link className="btn btn-ghost" to="/account">Account</Link><button className="btn btn-ghost" onClick={handleSignOut}>
          Sign Out
        </button></div>
      </div>

      <div className="actions section-heading"><h2>Programs</h2><button className="btn btn-primary" onClick={() => setCreating(true)}>New program</button></div>
      {creating && <ProgramForm onCancel={() => setCreating(false)} onSaved={(program) => navigate(`/dashboard/programs/${program.id}`)} />}

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
            Use New program above to create your first referral program.
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
