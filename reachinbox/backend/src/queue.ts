import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const QUEUE_NAME = "emailQueue";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,

  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,

    attempts: 5,

    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

export interface EmailJobData {
  emailId: string;
  senderId: string;

  smtpUser: string;
  smtpPass: string;

  recipient: string;
  subject: string;
  body: string;

  maxEmailsPerHour: number;

  attachments?: EmailAttachment[];
}

export async function enqueueEmail(
  data: EmailJobData,
  scheduledTime: Date
) {
  const delay = Math.max(
    0,
    scheduledTime.getTime() - Date.now()
  );

  return emailQueue.add(
    "send-email",
    data,
    {
      jobId: data.emailId,
      delay,
    }
  );
}