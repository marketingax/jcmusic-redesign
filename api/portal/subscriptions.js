'use strict';
const { requirePortal, ghlFetch, LOCATION_ID, GHL_VERSIONS } = require('../../lib/ghl');

module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  const loc = LOCATION_ID();
  const r = await ghlFetch(
    `/payments/subscriptions?altId=${loc}&altType=location&contactId=${contactId}&limit=100`,
    { version: GHL_VERSIONS.payments }
  );
  if (!r.ok) return res.status(r.status).json(r.data);
  const data = (r.data.data || r.data.subscriptions || []).filter(
    (s) => !s.contactId || s.contactId === contactId
  );
  return res.status(200).json({ data });
};
