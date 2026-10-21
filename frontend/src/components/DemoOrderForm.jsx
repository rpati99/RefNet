import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../lib/api.js";

export default function DemoOrderForm({ referralCode }) {
  const requestId = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const email = useRef(null);

  async function submit(event) {
    event.preventDefault();
    if (busy || result) return;
    // Keep both payload and request key for safe retries after a network error.
    email.current ??= new FormData(event.currentTarget).get("customerEmail").trim();
    setBusy(true);
    setError("");
    try {
      setResult(await fetchWithAuth(`/api/ref/${encodeURIComponent(referralCode)}/demo-order`, {
        method: "POST", body: JSON.stringify({ customerEmail: email.current, requestId: requestId.current }),
      }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <section className="panel">
    <h2>Simulate a test order</h2>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {result ? <div role="status">
      <p>{result.duplicate ? "This test order was already recorded." : "Test order recorded! The referral is now eligible."}</p>
      <p>Payouts are handled on the worker’s next scheduled run.</p>
      <Link className="btn btn-primary" to={`/dashboard/programs/${result.programId}`}>View program results</Link>
      <button className="btn btn-ghost" onClick={() => { requestId.current = crypto.randomUUID(); email.current = null; setResult(null); }}>Start another test order</button>
    </div> : <form className="form-stack" onSubmit={submit}>
      <div className="form-group"><label htmlFor="customerEmail">Test customer email</label><input className="input" id="customerEmail" name="customerEmail" type="email" maxLength={254} required readOnly={email.current !== null} /></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Recording order..." : error ? "Retry test order" : "Simulate test order"}</button>
    </form>}
  </section>;
}
