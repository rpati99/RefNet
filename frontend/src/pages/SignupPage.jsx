import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (localStorage.getItem("token")) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: fields.get("companyName").trim(), email: fields.get("email").trim(), password: fields.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      localStorage.setItem("token", data.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="panel auth-panel">
    <h1 className="page-title">Create your account</h1>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <form className="form-stack" onSubmit={submit}>
      <div className="form-group"><label htmlFor="companyName">Company name</label><input className="input" id="companyName" name="companyName" maxLength={255} required autoComplete="organization" /></div>
      <div className="form-group"><label htmlFor="signupEmail">Email</label><input className="input" id="signupEmail" name="email" type="email" required autoComplete="email" /></div>
      <div className="form-group"><label htmlFor="signupPassword">Password</label><input className="input" id="signupPassword" name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
    </form>
    <p>Already registered? <Link to="/login">Sign in</Link></p>
  </section></main>;
}
