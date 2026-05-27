'use strict';
const { requirePortal, ghlFetch } = require('../../lib/ghl');

// GET returns the contact profile; PUT updates editable fields.
module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;

  if (req.method === 'GET') {
    const r = await ghlFetch(`/contacts/${contactId}`);
    if (!r.ok) return res.status(r.status).json(r.data);
    const c = r.data.contact || {};
    return res.status(200).json({
      id: c.id,
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      email: c.email || '',
      phone: c.phone || '',
      address1: c.address1 || '',
      city: c.city || '',
      state: c.state || '',
      postalCode: c.postalCode || '',
      country: c.country || '',
      timezone: c.timezone || '',
    });
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // Whitelist editable fields (email NOT editable from portal — that breaks login).
    const editable = ['firstName', 'lastName', 'phone', 'address1', 'city', 'state', 'postalCode', 'country'];
    const update = {};
    editable.forEach((k) => {
      if (typeof body[k] === 'string') update[k] = body[k].trim();
    });

    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'No editable fields supplied' });
    }

    const r = await ghlFetch(`/contacts/${contactId}`, { method: 'PUT', body: update });
    if (!r.ok) return res.status(r.status).json(r.data);
    return res.status(200).json({ ok: true, message: 'Profile updated.' });
  }

  return res.status(405).json({ error: 'method not allowed' });
};
