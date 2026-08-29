const nodemailer = require("nodemailer");

async function sendMagicLink({ to, url }) {
  const from = process.env.SMTP_FROM;
  const host = process.env.SMTP_HOST;
  if (!host || !from) {
    console.log(`[magic-link] ${to} ${url}`);
    return { delivered: false };
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  await transporter.sendMail({
    from,
    to,
    subject: "Přihlášení do Volejbalaláci",
    text: url,
  });
  return { delivered: true };
}

module.exports = { sendMagicLink };
