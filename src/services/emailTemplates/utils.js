export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function otpDigits(otp) {
  const digits = String(otp ?? '').replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6).split('');
  if (digits.length >= 4) return digits.slice(0, 4).split('');
  return digits.padEnd(4, '•').slice(0, 4).split('');
}

