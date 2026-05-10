import { Link } from "react-router-dom";

export default function ProgramRow({ program, referralCounts }) {
  const total = Object.values(referralCounts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <tr>
      <td>
        <Link to={`/dashboard/programs/${program.id}`}>{program.name}</Link>
      </td>
      <td>
        <span
          className={`badge badge--${program.is_active ? "paid" : "failed"}`}
        >
          {program.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>{total}</td>
      <td>${((program.reward_amount_cents ?? 0) / 100).toFixed(2)}</td>
    </tr>
  );
}