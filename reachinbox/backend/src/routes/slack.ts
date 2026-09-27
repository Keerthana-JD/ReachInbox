import { Router } from "express";
import axios from "axios";
import { pool } from "../db";

const router = Router();

// Step 1: frontend links here: GET /api/slack/connect?email=user@x.com
// We redirect the browser to Slack's real OAuth authorize screen.
router.get("/connect", (req, res) => {
  const email = req.query.email as string;
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || "",
    scope: "incoming-webhook",
    redirect_uri: process.env.SLACK_REDIRECT_URI || "",
    state: email, // we smuggle the logged-in user's email through state
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

// Step 2: Slack redirects back here with a ?code=...&state=<email>
router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code: string; state: string };

    const tokenRes = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID || "",
        client_secret: process.env.SLACK_CLIENT_SECRET || "",
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI || "",
      })
    );

    const data = tokenRes.data;
    if (!data.ok) {
      console.error("Slack OAuth failed:", data);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=error`);
    }

    const webhookUrl = data.incoming_webhook.url;
    const teamName = data.team?.name;

    await pool.query(
      `INSERT INTO slack_connections (owner_email, webhook_url, team_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_email) DO UPDATE SET webhook_url = $2, team_name = $3`,
      [state, webhookUrl, teamName]
    );

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err: any) {
    console.error(err);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=error`);
  }
});

// Lets the frontend show "Connected ✅" or "Connect Slack" button state
router.get("/status", async (req, res) => {
  const email = req.query.email as string;
  const { rows } = await pool.query(
    "SELECT team_name FROM slack_connections WHERE owner_email = $1",
    [email]
  );
  res.json({ connected: rows.length > 0, teamName: rows[0]?.team_name || null });
});

export default router;
