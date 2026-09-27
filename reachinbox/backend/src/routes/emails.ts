import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { enqueueEmail } from "../queue";
import { indexEmail, searchEmails } from "../elastic";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
  },
});

// Every route here expects the frontend to send who the user is
// via this header.
function getOwnerEmail(req: any): string {
  return (req.headers["x-user-email"] as string) || "unknown@demo.com";
}

// ---------- List available senders ----------

router.get("/senders", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, max_emails_per_hour FROM senders ORDER BY created_at"
  );

  res.json(rows);
});

// ---------- Upload a CSV/TXT of leads ----------

router.post("/upload-leads", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No file uploaded",
    });
  }

  const text = req.file.buffer.toString("utf-8");

  const emailRegex =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const found = text.match(emailRegex) || [];

  const unique = Array.from(
    new Set(found.map((e) => e.toLowerCase()))
  );

  res.json({
    count: unique.length,
    emails: unique,
  });
});

// ---------- Schedule new emails ----------

router.post(
  "/schedule",
  upload.array("attachments", 3),
  async (req, res) => {
    try {
      const ownerEmail = getOwnerEmail(req);

      const {
        senderId,
        subject,
        body,
        startTime,
        delaySeconds = 5,
        maxEmailsPerHour,
      } = req.body;

      let recipients = req.body.recipients;

      if (!Array.isArray(recipients)) {
        recipients = recipients ? [recipients] : [];
      }

      if (
        !senderId ||
        !subject ||
        !body ||
        !Array.isArray(recipients) ||
        recipients.length === 0
      ) {
        return res.status(400).json({
          error: "Missing required fields",
        });
      }

      const sender = await pool.query(
        "SELECT * FROM senders WHERE id = $1",
        [senderId]
      );

      if (sender.rows.length === 0) {
        return res.status(404).json({
          error: "Sender not found",
        });
      }

      const senderRow = sender.rows[0];

      // ---------- Process uploaded attachments ----------

      const uploadedFiles =
        (req.files as Express.Multer.File[]) || [];

      const attachments = uploadedFiles.map((file) => ({
        filename: file.originalname,
        content: file.buffer.toString("base64"),
        contentType: file.mimetype,
      }));

      const perHourLimit =
        maxEmailsPerHour || senderRow.max_emails_per_hour;

      const start = new Date(startTime || Date.now());

      const created = [];

      for (let i = 0; i < recipients.length; i++) {
        const emailId = uuidv4();

        const scheduledTime = new Date(
          start.getTime() + i * delaySeconds * 1000
        );

        await pool.query(
          `INSERT INTO emails (
             id,
             sender_id,
             recipient_email,
             subject,
             body,
             scheduled_time,
             status,
             job_id,
             owner_email
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8)`,
          [
            emailId,
            senderId,
            recipients[i],
            subject,
            body,
            scheduledTime,
            emailId,
            ownerEmail,
          ]
        );

        // BullMQ delayed job - no cron involved.
        // jobId = emailId provides idempotency.

        await enqueueEmail(
          {
            emailId,
            senderId,
            smtpUser: senderRow.smtp_user,
            smtpPass: senderRow.smtp_pass,
            recipient: recipients[i],
            subject,
            body,
            maxEmailsPerHour: perHourLimit,
            attachments,
          },
          scheduledTime
        );

        created.push({
          emailId,
          recipient: recipients[i],
          scheduledTime,
        });

        // Index email in Elasticsearch immediately.
        await indexEmail({
          id: emailId,
          owner_email: ownerEmail,
          sender_id: senderId,
          recipient_email: recipients[i],
          subject,
          body,
          status: "scheduled",
          scheduled_time: scheduledTime,
          sent_time: null,
        });
      }

      res.json({
        scheduled: created.length,
        emails: created,
      });
    } catch (err: any) {
      console.error(err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ---------- List scheduled emails ----------

router.get("/scheduled", async (req, res) => {
  try {
    const ownerEmail = getOwnerEmail(req);

    const { rows } = await pool.query(
      `SELECT
         id,
         recipient_email,
         subject,
         body,
         scheduled_time,
         status
       FROM emails
       WHERE owner_email = $1
         AND status = 'scheduled'
       ORDER BY scheduled_time ASC`,
      [ownerEmail]
    );

    res.json(rows);
  } catch (err: any) {
    console.error(
      "Failed to fetch scheduled emails:",
      err
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

// ---------- List sent emails ----------

router.get("/sent", async (req, res) => {
  try {
    const ownerEmail = getOwnerEmail(req);

    const { rows } = await pool.query(
      `SELECT
         id,
         recipient_email,
         subject,
         body,
         sent_time,
         status
       FROM emails
       WHERE owner_email = $1
         AND status IN ('sent', 'failed')
       ORDER BY sent_time DESC`,
      [ownerEmail]
    );

    res.json(rows);
  } catch (err: any) {
    console.error(
      "Failed to fetch sent emails:",
      err
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

// ---------- Elasticsearch search ----------

router.get("/search", async (req, res) => {
  try {
    const ownerEmail = getOwnerEmail(req);

    const q = (req.query.q as string) || "";

    const results = await searchEmails(
      ownerEmail,
      q
    );

    res.json(results);
  } catch (err: any) {
    console.error(
      "Elasticsearch search failed:",
      err
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;