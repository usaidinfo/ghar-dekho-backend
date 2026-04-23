import nodemailer from 'nodemailer';
import { buildOtpEmailHtml } from './emailTemplates/otpEmailTemplate.js';
import { buildInquiryEmailHtml } from './emailTemplates/inquiryEmailTemplate.js';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helpful in development: surface SMTP misconfig immediately
if (process.env.NODE_ENV === 'development') {
  transporter.verify().catch(err => {
    console.error('SMTP verify failed:', err?.message || err);
  });
}

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

  if (process.env.NODE_ENV === 'development') {
    console.log('📧 SMTP sendMail result:', {
      messageId: info?.messageId,
      response: info?.response,
      accepted: info?.accepted,
      rejected: info?.rejected,
      pending: info?.pending,
    });
  }

  const rejected = Array.isArray(info?.rejected) ? info.rejected : [];
  const accepted = Array.isArray(info?.accepted) ? info.accepted : [];
  if (rejected.length || accepted.length === 0) {
    const detail = rejected.length ? `Rejected: ${rejected.join(', ')}` : 'No accepted recipients';
    throw new Error(`SMTP delivery not accepted. ${detail}`);
  }

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

  const headline =
    type === 'LOGIN' ? 'Verify Your Login' :
    type === 'PASSWORD_RESET' ? 'Reset Your Password' :
    'Verify Your Identity';

  const subcopy =
    type === 'LOGIN'
      ? "To sign in to Ghar Dekho, please enter the security code below."
      : type === 'PASSWORD_RESET'
        ? "To reset your password, please enter the security code below."
        : "To continue your journey with India's most exclusive real estate collection, please enter the security code below.";

  const html = buildOtpEmailHtml({ otp, headline, subcopy });

  return sendEmail({ to, subject, html, text: `Your Ghar Dekho OTP is ${otp}. Valid for 10 minutes.` });
};

/**
 * Send enquiry / lead email (premium)
 */
export const sendInquiryEmail = async ({
  to,
  propertyTitle,
  propertyLocation,
  priceLabel,
  propertyImageUrl,
  buyerName,
  buyerInitials,
  message,
  ctaUrl,
}) => {
  const subject = `New inquiry for ${propertyTitle || 'your property'} - Ghar Dekho`;
  const html = buildInquiryEmailHtml({
    propertyTitle,
    propertyLocation,
    priceLabel,
    propertyImageUrl,
    buyerName,
    buyerInitials,
    message,
    ctaUrl: ctaUrl || process.env.FRONTEND_URL || 'https://ghardekho.com',
  });
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

