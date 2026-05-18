import nodemailer from 'nodemailer';

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required mail environment variable: ${name}`);
  return value;
}

function getResetBaseUrl() {
  const raw = String(process.env.PASSWORD_RESET_BASE_URL || process.env.CLIENT_URL || '').trim();
  if (!raw) throw new Error('PASSWORD_RESET_BASE_URL or CLIENT_URL is required to build password reset links');

  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Password reset links must use HTTPS in production');
    }
    parsed.protocol = 'https:';
  }
  return parsed.toString().replace(/\/$/, '');
}

function getTransporter() {
  const host = requireEnv('SMTP_HOST');
  const port = Number(requireEnv('SMTP_PORT'));
  const user = requireEnv('SMTP_USER');
  const pass = requireEnv('SMTP_PASS');

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

function buildTemplate({ name, resetLink }) {
  const displayName = name?.trim() || 'there';
  const text = [
    `Hi ${displayName},`,
    '',
    'We received a request to reset your password.',
    'Use this link to set a new password (valid for 1 hour):',
    resetLink,
    '',
    "If you didn't request this, you can safely ignore this email."
  ].join('\n');

  const html = `
  <div style="margin:0;padding:0;background:#f3f6fb;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf2;">
            <tr>
              <td style="padding:20px 24px;background:linear-gradient(135deg,#0ea5e9,#2dd4bf);color:#06212f;">
                <h1 style="margin:0;font-size:22px;font-weight:800;">MindVault</h1>
                <p style="margin:6px 0 0;font-size:14px;opacity:0.85;">Password Reset Request</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:16px;color:#0f172a;">Hi ${displayName},</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
                  We received a request to reset your password. Click the button below to continue.
                </p>
                <p style="margin:0 0 18px;">
                  <a href="${resetLink}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;">Reset Password</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#475569;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="${resetLink}" style="color:#0ea5e9;">${resetLink}</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;color:#b45309;font-weight:600;">This link expires in 1 hour.</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  Security note: If you didn't request this, ignore this email and no changes will be made.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;

  return { html, text };
}

export async function sendPasswordResetEmail({ email, name, token }) {
  if (process.env.NODE_ENV === 'test') return;

  const fromName = String(process.env.SMTP_FROM_NAME || 'MindVault').trim();
  const fromAddress = requireEnv('SMTP_FROM_EMAIL');
  const resetBase = getResetBaseUrl();
  const resetLink = `${resetBase}/#/reset-password?token=${encodeURIComponent(token)}`;
  const { html, text } = buildTemplate({ name, resetLink });

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `${fromName} <${fromAddress}>`,
    to: email,
    subject: 'Password Reset Request',
    text,
    html
  });
}
