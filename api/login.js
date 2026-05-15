'use strict';
const { createSession } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  if (body.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const hours = 12;
  const token = createSession(hours);
  res.setHeader(
    'Set-Cookie',
    `jc_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${hours * 3600}`
  );
  return res.status(200).json({ ok: true });
};
