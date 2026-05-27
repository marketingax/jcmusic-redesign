'use strict';
const { requirePortal, ghlFetch } = require('../../lib/ghl');

// GET returns current notification (DND) state; PUT updates per-channel toggles.
// In GHL, `dnd: true` blocks ALL channels. `dndSettings.<channel>.status` blocks a single channel.
module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;

  if (req.method === 'GET') {
    const r = await ghlFetch(`/contacts/${contactId}`);
    if (!r.ok) return res.status(r.status).json(r.data);
    const c = r.data.contact || {};
    const s = c.dndSettings || {};
    const ch = (k) => !(c.dnd || (s[k] && s[k].status === 'active'));
    return res.status(200).json({
      email: ch('Email'),
      sms: ch('SMS'),
      call: ch('Call'),
    });
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // Build dndSettings: set status to 'active' (blocked) or 'inactive' (allowed).
    const mk = (allowed) => ({
      status: allowed ? 'inactive' : 'active',
      message: allowed ? '' : 'User-requested opt-out via student portal.',
      code: 'user_portal',
    });
    const dndSettings = {};
    if (typeof body.email === 'boolean') dndSettings.Email = mk(body.email);
    if (typeof body.sms === 'boolean') dndSettings.SMS = mk(body.sms);
    if (typeof body.call === 'boolean') dndSettings.Call = mk(body.call);

    if (!Object.keys(dndSettings).length) {
      return res.status(400).json({ error: 'No channels supplied' });
    }

    // When the user re-enables ANY channel we must clear the global dnd flag.
    const reEnabling = Object.values(dndSettings).some((v) => v.status === 'inactive');
    const update = { dndSettings };
    if (reEnabling) update.dnd = false;

    const r = await ghlFetch(`/contacts/${contactId}`, { method: 'PUT', body: update });
    if (!r.ok) return res.status(r.status).json(r.data);
    return res.status(200).json({ ok: true, message: 'Notification preferences updated.' });
  }

  return res.status(405).json({ error: 'method not allowed' });
};
