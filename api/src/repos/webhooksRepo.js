import pool from "../db/pool.js";

export async function createWithIdempotency({ eventId, eventType, payload }) {
  const result = await pool.query(
    `INSERT INTO webhook_events (event_id, event_type, payload, status)
     VALUES ($1, $2, $3, 'received')
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [eventId, eventType, JSON.stringify(payload)]
  );
  return result.rows[0] ?? null;
}

export async function markProcessed(eventId) {
  await pool.query(
    `UPDATE webhook_events
     SET status = 'processed', processed_at = now()
     WHERE event_id = $1`,
    [eventId]
  );
}

export async function findByEventId(eventId) {
  const result = await pool.query(
    "SELECT * FROM webhook_events WHERE event_id = $1",
    [eventId]
  );
  return result.rows[0] ?? null;
}
