'use strict';
const { requirePortal, ghlFetch, LOCATION_ID, GHL_VERSIONS } = require('../../lib/ghl');

module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const subscriptionId = String(body.subscriptionId || '');
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' });

  const loc = LOCATION_ID();

  const list = await ghlFetch(
    `/payments/subscriptions?altId=${loc}&altType=location&contactId=${contactId}&limit=100`,
    { version: GHL_VERSIONS.payments }
  );
  if (!list.ok) return res.status(list.status).json(list.data);
  const owned = (list.data.data || list.data.subscriptions || []).some(
    (s) => (s._id || s.id) === subscriptionId
  );
  if (!owned) return res.status(403).json({ error: 'forbidden' });

  const cancel = await ghlFetch(
    `/payments/subscriptions/${subscriptionId}/cancel?altId=${loc}&altType=location`,
    { method: 'POST', version: GHL_VERSIONS.payments, body: { cancelAt: 'period_end' } }
  );
  if (!cancel.ok) return res.status(cancel.status).json(cancel.data);
  return res.status(200).json({ ok: true, message: 'Subscription will cancel at period end.' });
};
