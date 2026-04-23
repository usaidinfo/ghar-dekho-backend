import { escapeHtml, otpDigits } from './utils.js';

export function buildOtpEmailHtml({ otp, headline, subcopy }) {
  const digits = otpDigits(otp);
  const year = new Date().getFullYear();
  const safeHeadline = escapeHtml(headline);
  const safeSubcopy = escapeHtml(subcopy);

  // Email-client safe: no external JS/Tailwind. Inline styles + tables.
  // Note: per request, there is NO "Return to Application" button.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Ghar Dekho OTP</title>
    <style>
      @media (max-width: 520px) {
        .container { width: 100% !important; }
        .px { padding-left: 18px !important; padding-right: 18px !important; }
        .otpBox { width: 44px !important; height: 60px !important; font-size: 30px !important; line-height: 60px !important; }
        .h1 { font-size: 26px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#faf9fc; color:#1b1c1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf9fc; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" style="width:600px; max-width:600px; background:#ffffff; border:1px solid rgba(196,198,206,0.35); border-radius:16px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.04);">
            <tr>
              <td style="background:#122a47; padding:28px 32px;" class="px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:11px; letter-spacing:0.22em; text-transform:uppercase; font-weight:800; color:rgba(124,146,180,0.95); margin-bottom:6px;">
                        Heritage Curator
                      </div>
                      <div style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:20px; letter-spacing:0.22em; text-transform:uppercase; font-weight:900; color:#ffffff; line-height:1;">
                        Ghar Dekho
                      </div>
                    </td>
                    <td align="right">
                      <div style="width:44px; height:44px; border-radius:999px; overflow:hidden; border:2px solid rgba(241,190,104,0.30); background:rgba(255,255,255,0.08);">
                        <img alt="Ghar Dekho" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVYzSD8cVSeeZmwDY2bOWQcsddQFv7tfT8N9fR9-AXCmtZ1jhtOD7UiXl4pNa_eIqcLFV7ZTn7lfLT1TyPU1ODokHx1IdG1dN5cshVahY0-hap8Pt3n4MivqPM7TClctsNWecpKC7lLd15sZnyGDWJz5FXU7jbtkukWfVV3tvOrvT_y0la-hkEDGuqblsHmn08Gu-oGwbfaW4prtbBGRH15nc644jLMFnIWhjeJWe3w46e1xSsMQ7TomOYy6DiTgbwKlWz7RWYmpeX" width="44" height="44" style="display:block; width:44px; height:44px; object-fit:cover;" />
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:34px 32px 14px;" class="px">
                <div style="text-align:center; font-family:Plus Jakarta Sans, Arial, sans-serif;">
                  <div style="display:inline-block; width:80px; height:80px; border-radius:999px; background:#e9e7ea; box-shadow:0 18px 40px rgba(241,190,104,0.14);">
                    <div style="width:80px; height:80px; border-radius:999px; display:flex; align-items:center; justify-content:center; font-size:36px; color:#7d5705; font-weight:900;">
                      ✓
                    </div>
                  </div>
                  <div class="h1" style="margin-top:18px; font-size:32px; font-weight:900; letter-spacing:-0.03em; color:#00152e;">
                    ${safeHeadline}
                  </div>
                  <div style="margin-top:10px; font-size:16px; line-height:1.6; color:#44474d; max-width:420px; margin-left:auto; margin-right:auto;">
                    ${safeSubcopy}
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 10px;" class="px">
                <div style="background:#122a47; border-radius:16px; padding:22px; position:relative; overflow:hidden;">
                  <div style="position:absolute; right:-20px; top:-20px; width:140px; height:140px; border-radius:999px; background:rgba(125,87,5,0.10); filter:blur(20px);"></div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            ${digits
                              .map(
                                d => `
                              <td style="padding:0 6px;">
                                <div class="otpBox" style="width:56px; height:72px; border-radius:14px; background:rgba(255,255,255,0.10); color:#f1be68; font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:36px; font-weight:900; text-align:center; line-height:72px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);">
                                  ${escapeHtml(d)}
                                </div>
                              </td>`,
                              )
                              .join('')}
                          </tr>
                        </table>
                        <div style="margin-top:14px; font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:11px; letter-spacing:0.20em; text-transform:uppercase; color:rgba(124,146,180,0.95); font-weight:800;">
                          Valid for 10 minutes
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 32px 28px;" class="px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3f6; border-radius:14px; border-left:4px solid rgba(125,87,5,0.40);">
                  <tr>
                    <td style="padding:14px 16px;">
                      <div style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:13px; font-weight:800; color:#1b1c1e; margin-bottom:4px;">
                        Security Protocol
                      </div>
                      <div style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:12px; line-height:1.6; color:#44474d;">
                        For your protection, do not share this code with anyone (including Ghar Dekho representatives). This code is unique to your current session.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#f5f3f6; padding:22px 32px;" class="px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-family:Plus Jakarta Sans, Arial, sans-serif;">
                      <div style="font-size:12px; font-weight:900; letter-spacing:0.20em; text-transform:uppercase; color:#00152e;">
                        Ghar Dekho India
                      </div>
                      <div style="margin-top:6px; font-size:10px; line-height:1.5; color:#44474d;">
                        © ${year} Heritage Curator Real Estate Services.<br/>
                        Gurugram, Haryana, India.
                      </div>
                    </td>
                    <td align="right" style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:10px; color:#44474d;">
                      Privacy • Terms
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

