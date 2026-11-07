
import nodemailer from "nodemailer";
import "dotenv/config";

let transporter;

export const initializeEmailService = async () => {
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;

  // Create temporary Ethereal credentials if none are configured
  if (!user || !pass) {
    const testAccount = await nodemailer.createTestAccount();

    user = testAccount.user;
    pass = testAccount.pass;

    console.log("Temporary Ethereal account created.");
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user,
      pass
    }
  });

  await transporter.verify();

  console.log("Ethereal SMTP connected successfully.");
};

export const sendEmail = async ({ recipient, subject, body }) => {
  if (!transporter) {
    throw new Error("Email service is not initialized");
  }

  const info = await transporter.sendMail({
    from: '"Outbox Scheduler" <scheduler@outbox.local>',
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
