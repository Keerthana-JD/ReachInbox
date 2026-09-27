import { Worker, Job, DelayedError } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

import { redisConnection } from "./redis";
import { QUEUE_NAME, EmailJobData } from "./queue";
import { pool } from "./db";
import { sendMail } from "./mailer";
import { tryConsumeQuota, waitMinDelay } from "./rateLimiter";
import { notifySlackRateLimitHit } from "./slackNotify";
import { indexEmail } from "./elastic";

const MIN_DELAY_MS = parseInt(
  process.env.MIN_DELAY_BETWEEN_EMAILS_MS || "2000",
  10
);

const CONCURRENCY = parseInt(
  process.env.WORKER_CONCURRENCY || "5",
  10
);

console.log(
  `👷 Starting email worker (concurrency=${CONCURRENCY}, minDelay=${MIN_DELAY_MS}ms)`
);

const worker = new Worker<EmailJobData>(
  QUEUE_NAME,

  async (job: Job<EmailJobData>, token?: string) => {
    const data = job.data;

    // ---- 1. IDEMPOTENCY CHECK ----
    const existing = await pool.query(
      "SELECT status FROM emails WHERE id = $1",
      [data.emailId]
    );

    if (existing.rows[0]?.status === "sent") {
      console.log(`Skipping ${data.emailId}, already sent.`);
      return;
    }

    // ---- 2. HOURLY RATE LIMIT CHECK ----
    const { allowed, nextWindowStart } = await tryConsumeQuota(
      data.senderId,
      data.maxEmailsPerHour
    );

    if (!allowed) {
      console.log(
        `⏳ Sender ${data.senderId} hit its hourly limit. Rescheduling "${data.subject}" to ${nextWindowStart.toISOString()}`
      );

      // Notify Slack when hourly limit is hit
      const ownerRow = await pool.query(
        "SELECT owner_email FROM emails WHERE id = $1",
        [data.emailId]
      );

      if (ownerRow.rows[0]) {
        await notifySlackRateLimitHit(
          ownerRow.rows[0].owner_email,
          data.senderId,
          data.maxEmailsPerHour
        );
      }

      // Move the same BullMQ job to the next hour
      if (token) {
        const delayMs = nextWindowStart.getTime() - Date.now();

        await job.moveToDelayed(
          Date.now() + delayMs,
          token
        );

        throw new DelayedError();
      }

      throw new Error("Rate limited, will retry via backoff");
    }

    // ---- 3. MINIMUM DELAY BETWEEN EMAILS ----
    await waitMinDelay(
      data.senderId,
      MIN_DELAY_MS
    );

    // ---- 4. ACTUALLY SEND EMAIL ----
    const { previewUrl } = await sendMail({
  smtpUser: data.smtpUser,
  smtpPass: data.smtpPass,
  to: data.recipient,
  subject: data.subject,
  html: data.body,
  attachments: data.attachments,
});

    console.log(
      `📧 Sent "${data.subject}" to ${data.recipient} -> ${previewUrl}`
    );

    // ---- 5. MARK EMAIL AS SENT IN POSTGRES ----
    await pool.query(
      "UPDATE emails SET status = 'sent', sent_time = now() WHERE id = $1",
      [data.emailId]
    );

    // ---- 6. UPDATE SENT EMAIL IN ELASTICSEARCH ----
    // Fetch the complete email row so Elasticsearch
    // contains the same information as PostgreSQL.
    const sentEmail = await pool.query(
      `SELECT
         id,
         owner_email,
         sender_id,
         recipient_email,
         subject,
         body,
         status,
         scheduled_time,
         sent_time
       FROM emails
       WHERE id = $1`,
      [data.emailId]
    );

    if (sentEmail.rows[0]) {
      await indexEmail(sentEmail.rows[0]);
    }
  },

  {
    connection: redisConnection,
    concurrency: CONCURRENCY,
  }
);

// ---- 7. HANDLE FAILED EMAILS ----
worker.on("failed", async (job, err) => {
  if (job) {
    console.error(
      `❌ Job ${job.id} failed:`,
      err.message
    );

    // Only mark as failed after all retry attempts are used
    if (job.attemptsMade >= (job.opts.attempts || 1)) {

      // ---- 7A. MARK AS FAILED IN POSTGRES ----
      await pool.query(
        "UPDATE emails SET status = 'failed' WHERE id = $1",
        [job.data.emailId]
      );

      // ---- 7B. UPDATE FAILED EMAIL IN ELASTICSEARCH ----
      // Fetch the complete email row from PostgreSQL
      // so Elasticsearch has the latest status.
      const failedEmail = await pool.query(
        `SELECT
           id,
           owner_email,
           sender_id,
           recipient_email,
           subject,
           body,
           status,
           scheduled_time,
           sent_time
         FROM emails
         WHERE id = $1`,
        [job.data.emailId]
      );

      // Send the failed email data to Elasticsearch
      if (failedEmail.rows[0]) {
        await indexEmail(failedEmail.rows[0]);
      }
    }
  }
});

// ---- 8. JOB COMPLETED ----
worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});