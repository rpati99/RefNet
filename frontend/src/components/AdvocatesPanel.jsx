import { useEffect, useState } from "react";
import { fetchWithAuth } from "../lib/api.js";

export default function AdvocatesPanel({ programId, onChanged }) {
  const [advocates, setAdvocates] = useState([]);
  const [links, setLinks] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState(null);
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
    const fields = new FormData(form);
    const email = fields.get("email").trim();
    const referralCode = fields.get("referralCode").trim();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const advocate = await fetchWithAuth(base, { method: "POST", body: JSON.stringify({ email, ...(referralCode ? { referralCode } : {}) }) });
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

  async function remove(advocate) {
    if (removing || !window.confirm(`Remove ${advocate.email}? This permanently deletes this advocate and all their referral and payout history. This cannot be undone.`)) return;
    setRemoving(advocate.id);
    setError("");
    setNotice("");
    try {
      await fetchWithAuth(`${base}/${advocate.id}`, { method: "DELETE" });
      setAdvocates((items) => items.filter((item) => item.id !== advocate.id));
      setLinks((items) => { const next = { ...items }; delete next[advocate.id]; return next; });
      setNotice("Advocate removed.");
      onChanged();
    } catch (err) { setError(err.message); }
    finally { setRemoving(null); }
  }

  return <section className="panel">
    <h2>Advocates & referral links</h2>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form className="form-stack" onSubmit={enroll}>
      <div className="form-group"><label htmlFor="advocateEmail">Advocate email</label><input className="input" name="email" id="advocateEmail" type="email" required /></div>
      <div className="form-group"><label htmlFor="referralCode">Custom referral code (optional)</label><input className="input" name="referralCode" id="referralCode" pattern="[A-Za-z0-9_-]+" aria-describedby="referralCodeHelp" /><small id="referralCodeHelp">Letters, numbers, underscores and hyphens. Leave blank to generate a code.</small></div>
      <button className="btn btn-primary" disabled={busy || loading}>{busy ? "Enrolling..." : "Enroll advocate"}</button>
    </form>
    {loading ? <p>Loading advocates...</p> : advocates.length === 0 ? <p>No advocates yet. Enroll one above.</p> : <ul className="advocate-list">{advocates.map((advocate) => <li key={advocate.id}>
      <strong>{advocate.email}</strong>
      {links[advocate.id] ? <a className="referral-link" href={links[advocate.id]} target="_blank" rel="noreferrer">{links[advocate.id]}</a> : <button type="button" className="btn btn-ghost" onClick={() => showLink(advocate.id)}>Show referral link<span className="sr-only"> for {advocate.email}</span></button>}
      <button type="button" className="btn btn-ghost" disabled={removing !== null} onClick={() => remove(advocate)}>{removing === advocate.id ? "Removing..." : "Remove advocate"}<span className="sr-only"> {advocate.email}</span></button>
    </li>)}</ul>}
  </section>;
}
