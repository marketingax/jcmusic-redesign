'use strict';
const { ghlFetch, LOCATION_ID, createMagicToken } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const email = String(body.email || '').trim().toLowerCase();

  // Neutral response — never reveal whether an email is on file.
  const neutral = { ok: true, message: 'If that email is on file, a login link is on its way. Check your inbox.' };
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const r = await ghlFetch(
    `/contacts/?locationId=${LOCATION_ID()}&query=${encodeURIComponent(email)}&limit=25`
  );
  const contact = r.ok
    ? (r.data.contacts || []).find((c) => String(c.email || '').toLowerCase() === email)
    : null;

  if (!contact) {
    return res.status(200).json(neutral);
  }

  const token = createMagicToken(contact.id, 20);
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers.host;
  const link = `${proto}://${host}/api/portal-verify?token=${encodeURIComponent(token)}`;
  const name = contact.firstName || 'there';

  const html = `
    <div style="font-family:Arial,sans-serif;background:#0A0A0A;color:#F5F5F5;padding:32px;border-radius:12px;max-width:480px;margin:0 auto;">
      <h2 style="color:#D4AF37;margin:0 0 16px;">JC Music Student Portal</h2>
      <p>Hi ${name}, here is your secure login link. It expires in 20 minutes and works once.</p>
      <p style="margin:26px 0;">
        <a href="${link}" style="background:#D4AF37;color:#0A0A0A;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:6px;display:inline-block;">Log in to my portal</a>
      </p>
      <p style="font-size:12px;color:#A0A0A0;">If you didn't request this, you can ignore this email.</p>
    </div>`;

  await ghlFetch('/conversations/messages', {
    method: 'POST',
    body: {
      type: 'Email',
      contactId: contact.id,
      subject: 'Your JC Music portal login link',
      html,
    },
  });

  return res.status(200).json(neutral);
};
