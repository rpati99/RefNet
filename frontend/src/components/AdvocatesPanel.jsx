import { useEffect, useState } from "react";
import { fetchWithAuth } from "../lib/api.js";

export default function AdvocatesPanel({ programId, onChanged }) {
  const [advocates, setAdvocates] = useState([]);
  const [links, setLinks] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const base = `/api/programs/${programId}/advocates`;

  useEffect(() => {
    let current = true;
    fetchWithAuth(base).then((data) => { if (current) setAdvocates(data.advocates); })
      .catch((err) => { if (current) setError(err.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [base]);

  async function enroll(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const email = new FormData(form).get("email").trim();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const advocate = await fetchWithAuth(base, { method: "POST", body: JSON.stringify({ email }) });
      setAdvocates((items) => [...items, advocate]);
      form.reset();
      setNotice("Advocate enrolled. Use Show referral link to get their link.");
      onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function showLink(id) {
    setError("");
    try {
      const data = await fetchWithAuth(`${base}/${id}/link`);
      setLinks((items) => ({ ...items, [id]: data.referralLink }));
    } catch (err) { setError(err.message); }
  }

  return <section className="panel">
    <h2>Advocates & referral links</h2>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form className="form-stack" onSubmit={enroll}>
      <div className="form-group"><label htmlFor="advocateEmail">Advocate email</label><input className="input" name="email" id="advocateEmail" type="email" required /></div>
      <button className="btn btn-primary" disabled={busy || loading}>{busy ? "Enrolling..." : "Enroll advocate"}</button>
    </form>
    {loading ? <p>Loading advocates...</p> : advocates.length === 0 ? <p>No advocates yet. Enroll one above.</p> : <ul className="advocate-list">{advocates.map((advocate) => <li key={advocate.id}>
      <strong>{advocate.email}</strong>
      {links[advocate.id] ? <a className="referral-link" href={links[advocate.id]} target="_blank" rel="noreferrer">{links[advocate.id]}</a> : <button type="button" className="btn btn-ghost" onClick={() => showLink(advocate.id)}>Show referral link<span className="sr-only"> for {advocate.email}</span></button>}
    </li>)}</ul>}
  </section>;
}
