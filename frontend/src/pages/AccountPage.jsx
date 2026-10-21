import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../lib/api.js";

export default function AccountPage() {
  const [merchant, setMerchant] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    fetchWithAuth("/api/auth/me")
      .then((data) => { if (current) setMerchant(data.merchant); })
      .catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, []);

  return <main className="page">
    <Link to="/dashboard" className="btn btn-ghost">← Back to Dashboard</Link>
    <h1 className="page-title" style={{ margin: "1rem 0" }}>Your account</h1>
    {error ? <p className="error-banner" role="alert">{error}</p> : !merchant ? <p className="loading">Loading account...</p> : <section className="panel">
      <dl className="account-details">
        <dt>Email</dt><dd>{merchant.email}</dd>
        <dt>Company</dt><dd>{merchant.company_name || "Not provided"}</dd>
        <dt>Account ID</dt><dd>{merchant.id}</dd>
        <dt>Created</dt><dd>{new Date(merchant.created_at).toLocaleString()}</dd>
      </dl>
    </section>}
  </main>;
}
