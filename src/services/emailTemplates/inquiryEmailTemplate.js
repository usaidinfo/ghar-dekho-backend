import { escapeHtml } from './utils.js';

export function buildInquiryEmailHtml({
  propertyTitle,
  propertyLocation,
  priceLabel,
  propertyImageUrl,
  buyerInitials,
  buyerName,
  message,
  ctaUrl,
}) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>New Inquiry</title>
    <style>
      @media (max-width: 520px) {
        .container { width: 100% !important; }
        .px { padding-left: 18px !important; padding-right: 18px !important; }
        .h1 { font-size: 26px !important; }
        .cardRow { display:block !important; }
        .imgCol { width:100% !important; }
        .textCol { width:100% !important; padding-top:14px !important; padding-left:16px !important; padding-right:16px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#faf9fc; color:#1b1c1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf9fc; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" style="width:600px; max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.04);">
            <tr>
              <td style="padding:18px 32px; background:#faf9fc; border-bottom:1px solid rgba(196,198,206,0.30);" class="px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:18px; font-weight:900; letter-spacing:0.20em; text-transform:uppercase; color:#00152e;">
                      Ghar Dekho
                    </td>
                    <td align="right" style="font-family:Plus Jakarta Sans, Arial, sans-serif;">
                      <span style="display:inline-block; font-size:10px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#7d5705;">
                        Premium Partner
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0;" class="px">
                <div class="h1" style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:32px; font-weight:900; letter-spacing:-0.03em; color:#00152e;">
                  New Inquiry for Your Property!
                </div>
                <div style="margin-top:10px; font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:14px; line-height:1.7; color:#44474d;">
                  A potential curator has expressed interest in one of your heritage collections. Review the details below to respond promptly.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px;" class="px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3f6; border-radius:16px; padding:0; overflow:hidden;">
                  <tr class="cardRow">
                    <td class="imgCol" width="200" style="width:200px; padding:16px;">
                      <div style="border-radius:14px; overflow:hidden; width:168px; height:168px; background:#e9e7ea;">
                        <img alt="Property" src="${escapeHtml(propertyImageUrl || '')}" width="168" height="168" style="display:block; width:168px; height:168px; object-fit:cover;" />
                      </div>
                    </td>
                    <td class="textCol" style="padding:16px 16px 16px 0; font-family:Plus Jakarta Sans, Arial, sans-serif;">
                      <div style="font-size:10px; font-weight:900; letter-spacing:0.22em; text-transform:uppercase; color:#7d5705; margin-bottom:8px;">
                        Heritage Collection
                      </div>
                      <div style="font-size:18px; font-weight:900; color:#00152e; margin-bottom:4px;">
                        ${escapeHtml(propertyTitle || 'Property')}
                      </div>
                      <div style="font-size:12px; color:#44474d; margin-bottom:10px;">
                        ${escapeHtml(propertyLocation || '')}
                      </div>
                      <div style="font-size:18px; font-weight:900; color:#00152e;">
                        ${escapeHtml(priceLabel || '')}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 22px;" class="px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3f6; border-radius:16px;">
                  <tr>
                    <td style="padding:18px 18px 6px; font-family:Plus Jakarta Sans, Arial, sans-serif;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="48" style="vertical-align:top;">
                            <div style="width:48px; height:48px; border-radius:999px; background:#122a47; color:#ffffff; font-weight:900; font-size:16px; line-height:48px; text-align:center;">
                              ${escapeHtml(buyerInitials || 'GD')}
                            </div>
                          </td>
                          <td style="padding-left:12px;">
                            <div style="font-size:10px; letter-spacing:0.22em; text-transform:uppercase; font-weight:800; color:#44474d;">
                              Interested Buyer
                            </div>
                            <div style="margin-top:2px; font-size:16px; font-weight:900; color:#00152e;">
                              ${escapeHtml(buyerName || '')}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 18px;">
                      <div style="border-left:2px solid rgba(125,87,5,0.20); padding-left:14px; font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:13px; line-height:1.7; color:#1b1c1e; font-style:italic;">
                        “${escapeHtml(message || '')}”
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 30px;" class="px" align="center">
                <a href="${escapeHtml(ctaUrl || 'https://ghardekho.com')}" style="display:inline-block; text-decoration:none; padding:14px 22px; border-radius:999px; background:linear-gradient(135deg,#00152e,#122a47); color:#ffffff; font-family:Plus Jakarta Sans, Arial, sans-serif; font-weight:900; font-size:14px; box-shadow:0 18px 40px rgba(0,21,46,0.12);">
                  View Lead in Dashboard
                </a>
                <div style="margin-top:12px; font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; font-weight:800; color:#44474d;">
                  Response time typically affects your curator rating
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#e9e7ea; padding:20px 32px;" class="px" align="center">
                <div style="font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:12px; line-height:1.6; color:#44474d; max-width:420px;">
                  You received this email because you are a verified partner of Ghar Dekho India.
                  Manage your notification preferences in your portal.
                </div>
                <div style="margin-top:14px; font-family:Plus Jakarta Sans, Arial, sans-serif; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; font-weight:900; color:#7d5705;">
                  Ghar Dekho © ${year}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

