'use strict';
const { requirePortal, ghlFetch, LOCATION_ID } = require('../../lib/ghl');

module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  const r = await ghlFetch(
    `/payments/transactions?altId=${LOCATION_ID()}&altType=location&contactId=${contactId}&limit=100`
  );
  if (!r.ok) return res.status(r.status).json(r.data);
  // Defense in depth: never leak another contact's transactions.
  const data = (r.data.data || []).filter((t) => t.contactId === contactId);
  return res.status(200).json({ data });
};
