import { Resend } from 'resend';

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required email environment variable: ${name}`);
  return value;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getResetBaseUrl() {
  const raw = requireEnv('PASSWORD_RESET_BASE_URL');
  const parsed = new URL(raw);

  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('PASSWORD_RESET_BASE_URL must use HTTPS in production');
  }

  return parsed.toString().replace(/\/$/, '');
}

function getResendClient() {
  return new Resend(requireEnv('RESEND_API_KEY'));
}

function buildResetUrl(resetToken) {
  const resetBase = getResetBaseUrl();
  return `${resetBase}/#/reset-password?token=${encodeURIComponent(resetToken)}`;
}

function buildPasswordResetEmail(resetUrl) {
  const safeResetUrl = escapeHtml(resetUrl);

  const text = [
    'Reset your MindVault password',
    '',
    'We received a request to reset your password.',
    'Use this link to set a new password. The link expires in 1 hour:',
    resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email."
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your MindVault password</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <div style="font-size:22px;font-weight:800;letter-spacing:0;">MindVault</div>
                <div style="margin-top:6px;font-size:14px;color:#cbd5e1;">Password reset request</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#0f172a;">Reset your password</h1>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#334155;">
                  We received a request to reset your MindVault password. Click the button below to choose a new password.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${safeResetUrl}" style="display:inline-block;background:#14b8a6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:10px;">
                    Reset password
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 18px;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="${safeResetUrl}" style="color:#0f766e;">${safeResetUrl}</a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#92400e;font-weight:700;">
                  This link expires in 1 hour.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  If you did not request this password reset, ignore this email and your password will stay unchanged.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

export async function sendPasswordResetEmail(toEmail, resetToken) {
  if (process.env.NODE_ENV === 'test') return null;

  const from = requireEnv('EMAIL_FROM');
  const resetUrl = buildResetUrl(resetToken);
  const { html, text } = buildPasswordResetEmail(resetUrl);

  try {
    const { data, error } = await getResendClient().emails.send({
      from,
      to: toEmail,
      subject: 'Reset your MindVault password',
      html,
      text
    });

    if (error) {
      throw new Error(error.message || 'Resend email request failed');
    }

    return data;
  } catch (error) {
    console.error('Failed to send password reset email with Resend:', error.message);
    throw error;
  }
}
