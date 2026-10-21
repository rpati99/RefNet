import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function ReferralPage() {
  const { referralCode } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    fetch(`${API_URL}/api/ref/${encodeURIComponent(referralCode)}`).then(async (res) => {
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Referral unavailable");
      if (current) setData(result);
    }).catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [referralCode]);
  return <main className="page"><section className="panel">
    {error ? <p className="error-banner" role="alert">{error}</p> : !data ? <p>Loading referral...</p> : <>
      <h1 className="page-title">{data.program.name}</h1>
      <p>{data.program.rewardDescription}</p>
      <p>Referral reward: ${(data.program.rewardAmountCents / 100).toFixed(2)}</p>
      <p>Referral code: <strong>{data.referralCode}</strong></p>
      <p>This demo displays referral details. Purchases are recorded through the merchant’s order integration.</p>
    </>}
  </section></main>;
}
