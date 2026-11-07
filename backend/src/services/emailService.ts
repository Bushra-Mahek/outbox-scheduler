import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import "dotenv/config";

interface SendEmailInput {
  recipient: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

let transporter: Transporter | null = null;
let smtpUser: string | undefined;

export const initializeEmailService = async (): Promise<void> => {
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;

  // Create temporary Ethereal credentials if none are configured.
  if (!user || !pass) {
    const testAccount = await nodemailer.createTestAccount();

    user = testAccount.user;
    pass = testAccount.pass;

    console.log("Temporary Ethereal account created.");
    console.log("Ethereal account:", user);
  }

  smtpUser = user;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass
    }
  });

  await transporter.verify();

  console.log("Ethereal SMTP connected successfully.");
};

export const sendEmail = async ({
  recipient,
  subject,
  body
}: SendEmailInput): Promise<SendEmailResult> => {
  if (!transporter || !smtpUser) {
    throw new Error("Email service is not initialized");
  }

  const info = await transporter.sendMail({
    from: `"Outbox Scheduler" <${smtpUser}>`,
    to: recipient,
    subject,
    text: body
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log("Email accepted by Ethereal SMTP!");
  console.log("Message ID:", info.messageId);
  console.log("Preview URL:", previewUrl);

  return {
    messageId: info.messageId,
    previewUrl
  };
};