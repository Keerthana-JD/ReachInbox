import axios from "axios";
import { pool } from "./db";

// Sends a message to the user's connected Slack webhook.
// If they never connected Slack, we just skip silently (no crash) -
// exactly what the assignment asks for.
export async function notifySlackRateLimitHit(
  ownerEmail: string,
  senderName: string,
  maxPerHour: number
) {
  try {
    const { rows } = await pool.query(
      "SELECT webhook_url FROM slack_connections WHERE owner_email = $1",
      [ownerEmail]
    );

    if (rows.length === 0) {
      console.log(`(Slack not connected for ${ownerEmail}, skipping notify)`);
      return;
    }

    const webhookUrl = rows[0].webhook_url;

    await axios.post(webhookUrl, {
      text: `🚨 Rate limit hit: sender *${senderName}* just reached its limit of ${maxPerHour} emails/hour. Remaining emails are being rescheduled to the next hour window.`,
    });

    console.log(`✅ Slack notified for ${ownerEmail}`);
  } catch (err: any) {
    // A failed Slack call should NEVER crash the worker or block email sending.
    console.error("Slack notify failed:", err.message);
  }
}
