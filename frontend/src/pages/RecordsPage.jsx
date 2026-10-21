import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../lib/api.js";

function date(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function RecordsPage() {
  const [params, setParams] = useSearchParams();
  const programId = params.get("programId") ?? "";
  const page = params.get("page") ?? "1";
  const [programs, setPrograms] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    fetchWithAuth("/api/programs").then((result) => { if (current) setPrograms(result.programs); })
      .catch((err) => { if (current) setFilterError(err.message); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setData(null);
    setError("");
    const query = new URLSearchParams({ page, ...(programId ? { programId } : {}) });
    fetchWithAuth(`/api/records?${query}`).then((result) => { if (current) setData(result); })
      .catch((err) => { if (current) setError(err.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [programId, page, revision]);

  function changePage(next) {
    setParams({ ...(programId ? { programId } : {}), page: String(next) });
  }

  return <main className="page records-page">
    <Link to="/dashboard" className="btn btn-ghost">← Back to Dashboard</Link>
    <div className="page-header" style={{ marginTop: "1rem" }}><h1 className="page-title">Records</h1><button className="btn btn-primary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh records</button></div>
    <p>Individual referrals, orders and payouts for your account. Read-only; refresh after the worker runs.</p>
    <div className="form-group" style={{ margin: "1rem 0", maxWidth: "360px" }}>
      <label htmlFor="recordProgram">Filter by program</label>
      <select className="input" id="recordProgram" value={programId} onChange={(event) => setParams(event.target.value ? { programId: event.target.value } : {})}>
        <option value="">All programs</option>
        {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
      </select>
    </div>
    {filterError && <p role="alert" className="error-banner">Could not load program filters: {filterError}</p>}
    {error && <p role="alert" className="error-banner">{error}</p>}
    {loading ? <p role="status" className="loading">Loading records...</p> : data && <>
      {data.records.length === 0 ? <p className="empty-state">No records on this page. Simulate an order to create a referral.</p> : <div className="table-scroll" role="region" aria-label="Referral and payout records" tabIndex={0}>
        <table className="data-table"><thead><tr><th>Program / advocate</th><th>Customer / order</th><th>Referral</th><th>Payout</th><th>Dates</th></tr></thead>
          <tbody>{data.records.map((record) => <tr key={record.id}>
            <td><Link to={`/dashboard/programs/${record.program_id}`}>{record.program_name}</Link><div>{record.advocate_email}</div></td>
            <td><div>{record.customer_email ?? "—"}</div><small>Order: {record.order_id ?? "Not recorded"}</small></td>
            <td><strong>{record.status}</strong><small className="record-id">{record.id}</small></td>
            <td><strong>{record.payout_status ?? "Not created"}</strong><div>{record.amount_cents == null ? "—" : `$${(record.amount_cents / 100).toFixed(2)}`}</div>{record.payout_id && <small className="record-id">{record.payout_id}</small>}</td>
            <td><div>Created: {date(record.created_at)}</div><div>Order: {date(record.signup_ts)}</div><div>Processed: {date(record.processed_at)}</div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav className="actions" aria-label="Records pagination" style={{ marginTop: "1rem" }}>
        <button className="btn btn-ghost" disabled={data.page <= 1} onClick={() => changePage(data.page - 1)}>Previous</button>
        <span>Page {data.page}</span>
        <button className="btn btn-ghost" disabled={!data.hasMore} onClick={() => changePage(data.page + 1)}>Next</button>
      </nav>
    </>}
  </main>;
}
