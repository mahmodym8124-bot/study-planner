import nodemailer from 'nodemailer';

function requireMailEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required mail environment variable: ${name}`);
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

function getSmtpPort() {
  const rawPort = requireMailEnv('SMTP_PORT');
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`SMTP_PORT must be an integer between 1 and 65535. Received: ${rawPort}`);
  }
  return port;
}

function getTransporter() {
  const port = getSmtpPort();

  return nodemailer.createTransport({
    host: requireMailEnv('SMTP_HOST'),
    port,
    secure: port === 465,
    auth: {
      user: requireMailEnv('SMTP_USER'),
      pass: requireMailEnv('SMTP_PASS')
    }
  });
}

function getPasswordResetBaseUrl() {
  const rawUrl = requireMailEnv('PASSWORD_RESET_BASE_URL');
  const parsed = new URL(rawUrl);

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('PASSWORD_RESET_BASE_URL must use HTTPS in production');
  }

  return parsed.toString().replace(/\/$/, '');
}

function buildPasswordResetUrl(resetToken) {
  const baseUrl = getPasswordResetBaseUrl();
  return `${baseUrl}/#/reset-password?token=${encodeURIComponent(resetToken)}`;
}

function buildVerificationUrl(token) {
  const baseUrl = getPasswordResetBaseUrl();
  return `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildPasswordResetEmail(resetUrl) {
  const safeResetUrl = escapeHtml(resetUrl);

  const text = [
    'Reset your MindVault password',
    '',
    'We received a request to reset your password.',
    'Use the link below to create a new password. This link expires in 1 hour.',
    '',
    resetUrl,
    '',
    'If you did not request this password reset, you can ignore this email.'
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your MindVault password</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <div style="font-size:22px;font-weight:800;">MindVault</div>
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
                    Reset Password
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

function buildVerificationEmail(verificationUrl) {
  const safeVerificationUrl = escapeHtml(verificationUrl);

  const text = [
    'Verify your MindVault email',
    '',
    'Thanks for creating an account.',
    'Use the link below to verify your email address. This link expires in 24 hours.',
    '',
    verificationUrl,
    '',
    'If you did not create this account, you can ignore this email.'
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verify your MindVault email</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <div style="font-size:22px;font-weight:800;">MindVault</div>
                <div style="margin-top:6px;font-size:14px;color:#cbd5e1;">Email verification</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#0f172a;">Verify your email</h1>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#334155;">
                  Click the button below to confirm your email address and activate your account.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${safeVerificationUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:10px;">
                    Verify Email
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 18px;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="${safeVerificationUrl}" style="color:#15803d;">${safeVerificationUrl}</a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#14532d;font-weight:700;">
                  This link expires in 24 hours.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  If you did not create this account, you can ignore this email.
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

  const resetUrl = buildPasswordResetUrl(resetToken);
  const { html, text } = buildPasswordResetEmail(resetUrl);
  const fromEmail = requireMailEnv('SMTP_FROM_EMAIL');
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'MindVault';

  try {
    const info = await getTransporter().sendMail({
      from: `"${fromName.replaceAll('"', '\\"')}" <${fromEmail}>`,
      to: toEmail,
      subject: 'Reset your MindVault password',
      html,
      text
    });

    return info;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

export async function sendVerificationEmail(toEmail, token) {
  if (process.env.NODE_ENV === 'test') return null;

  const verificationUrl = buildVerificationUrl(token);
  const { html, text } = buildVerificationEmail(verificationUrl);
  const fromEmail = requireMailEnv('SMTP_FROM_EMAIL');
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'MindVault';

  try {
    const info = await getTransporter().sendMail({
      from: `"${fromName.replaceAll('"', '\\"')}" <${fromEmail}>`,
      to: toEmail,
      subject: 'Verify your MindVault email',
      html,
      text
    });

    return info;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error;
  }
}
