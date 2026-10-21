import { useState } from "react";
import { fetchWithAuth } from "../lib/api.js";

export default function ProgramForm({ program, onSaved, onCancel }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const rewardAmountCents = Math.round(Number(fields.get("reward")) * 100);
    if (!Number.isSafeInteger(rewardAmountCents) || rewardAmountCents < 0 || rewardAmountCents > 2147483647) {
      setError("Enter a valid reward between $0 and $21,474,836.47.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await fetchWithAuth(program ? `/api/programs/${program.id}` : "/api/programs", {
        method: program ? "PUT" : "POST",
        body: JSON.stringify({
          name: fields.get("name").trim(), rewardDescription: fields.get("description").trim(), rewardAmountCents,
          ...(program ? { isActive: fields.get("active") === "on" } : {}),
        }),
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <h2>{program ? "Edit program" : "Create program"}</h2>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <form className="form-stack" onSubmit={submit}>
      <div className="form-group"><label htmlFor="programName">Program name</label><input className="input" id="programName" name="name" defaultValue={program?.name ?? ""} maxLength={255} pattern=".*\S.*" required /></div>
      <div className="form-group"><label htmlFor="rewardDescription">Reward description</label><textarea className="input" id="rewardDescription" name="description" defaultValue={program?.reward_description ?? ""} maxLength={1000} /></div>
      <div className="form-group"><label htmlFor="rewardAmount">Reward (USD)</label><input className="input" id="rewardAmount" name="reward" type="number" min="0" max="21474836.47" step="0.01" required defaultValue={((program?.reward_amount_cents ?? 0) / 100).toFixed(2)} /></div>
      {program && <label><input name="active" type="checkbox" defaultChecked={program.is_active} /> Program active</label>}
      <div className="actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : program ? "Save changes" : "Create program"}</button><button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>Cancel</button></div>
    </form>
  </section>;
}
