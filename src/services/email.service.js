import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a plain email
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const info = await transporter.sendMail({
    from:    process.env.EMAIL_FROM || '"Ghar Dekho" <noreply@ghardekho.com>',
    to,
    subject,
    html,
    text,
  });
  return info;
};

/**
 * Send OTP email
 */
export const sendOTPEmail = async (to, otp, type = 'verification') => {
  const subject =
    type === 'LOGIN'          ? 'Your Ghar Dekho Login OTP' :
    type === 'PASSWORD_RESET' ? 'Ghar Dekho Password Reset OTP' :
    'Verify your Ghar Dekho account';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #E63946;">🏠 Ghar Dekho</h2>
      <p style="font-size: 16px; color: #333;">
        Your One-Time Password (OTP) is:
      </p>
      <div style="background: #F1F3F5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #E63946;">${otp}</span>
      </div>
      <p style="color: #666; font-size: 14px;">
        This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #aaa; font-size: 12px;">
        If you didn't request this, please ignore this email.
        <br/>© ${new Date().getFullYear()} Ghar Dekho. All rights reserved.
      </p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

/**
 * Send welcome email after registration
 */
export const sendWelcomeEmail = async (to, firstName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #E63946;">🏠 Welcome to Ghar Dekho, ${firstName}!</h2>
      <p style="font-size: 16px; color: #333;">
        You've successfully joined Ghar Dekho — India's smartest property platform.
      </p>
      <p style="color: #555;">Start exploring thousands of verified properties near you. 🏡</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #aaa; font-size: 12px;">
        © ${new Date().getFullYear()} Ghar Dekho. All rights reserved.
      </p>
    </div>
  `;
  return sendEmail({ to, subject: 'Welcome to Ghar Dekho! 🏠', html });
};

