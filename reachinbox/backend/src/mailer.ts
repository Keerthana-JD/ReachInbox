import nodemailer from "nodemailer";

export function getTransport(
  smtpUser: string,
  smtpPass: string
) {
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export async function sendMail(opts: {
  smtpUser: string;
  smtpPass: string;
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) {
  const transport = getTransport(
    opts.smtpUser,
    opts.smtpPass
  );

  const info = await transport.sendMail({
    from: opts.smtpUser,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,

    attachments: (opts.attachments || []).map(
      (attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(
          attachment.content,
          "base64"
        ),
        contentType: attachment.contentType,
      })
    ),
  });

  const previewUrl =
    nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}