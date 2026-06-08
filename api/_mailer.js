// Email sender — configure SMTP_* env vars or swap for any provider
// Works with: Gmail App Password, Zoho, Resend, SendGrid, etc.

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

async function sendOTPEmail(to, otp, name = '') {
  if (!process.env.SMTP_USER) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email delivery is not configured');
    }
    // Local development only.
    console.log(`[DEV] Email OTP for ${to}: ${otp}`);
    return;
  }
  const t = await getTransporter();
  await t.sendMail({
    from:    `"Zero Soils" <${process.env.SMTP_USER}>`,
    to,
    subject: `Your Zero Soils verification code: ${otp}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#070D09;color:#E8F0EB;border-radius:16px">
        <div style="font-size:1.4rem;font-weight:800;color:#52B788;margin-bottom:8px">Zero Soils ✦</div>
        <p style="color:#A8C0B0;margin:0 0 24px">Human Digital Identity Community</p>
        <p style="margin:0 0 8px">Hi${name ? ' ' + name : ''},</p>
        <p style="color:#A8C0B0;margin:0 0 24px">Your email verification code is:</p>
        <div style="font-size:2.2rem;font-weight:900;letter-spacing:0.18em;color:#fff;background:rgba(82,183,136,0.12);border:1px solid rgba(82,183,136,0.25);border-radius:12px;padding:18px 24px;text-align:center;font-family:monospace;margin-bottom:24px">${otp}</div>
        <p style="color:#6B8A74;font-size:0.85rem;margin:0">This code expires in 10 minutes. Do not share it with anyone.<br/>Zero Soils — zerosoils.com</p>
      </div>
    `,
  });
}

async function sendResetEmail(to, name, resetUrl) {
  if (!process.env.SMTP_USER) {
    console.log(`[DEV] Password reset link for ${to}: ${resetUrl}`);
    return;
  }
  const t = await getTransporter();
  await t.sendMail({
    from:    `"Zero Soils" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Reset your Zero Soils password',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#070D09;color:#E8F0EB;border-radius:16px">
        <div style="font-size:1.4rem;font-weight:800;color:#52B788;margin-bottom:8px">Zero Soils ✦</div>
        <p style="color:#A8C0B0;margin:0 0 24px">Human Digital Identity Community</p>
        <p style="margin:0 0 8px">Hi${name ? ' ' + name : ''},</p>
        <p style="color:#A8C0B0;margin:0 0 24px">We received a request to reset your password. Click the button below — this link expires in 15 minutes.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#046A38;color:#fff;border-radius:10px;font-weight:700;text-decoration:none;font-size:1rem;margin-bottom:24px">Reset password →</a>
        <p style="color:#6B8A74;font-size:0.85rem;margin:0">If you did not request this, ignore this email — your account is safe.<br/>Zero Soils — zerosoils.com</p>
      </div>
    `,
  });
}

module.exports = { sendOTPEmail, sendResetEmail };
