'use strict';
const { requirePortal, ghlFetch, LOCATION_ID, GHL_VERSIONS } = require('../../lib/ghl');

module.exports = async (req, res) => {
  const contactId = requirePortal(req, res);
  if (!contactId) return;
  const r = await ghlFetch(
    `/invoices/?altId=${LOCATION_ID()}&altType=location&contactId=${contactId}&limit=100&offset=0`,
    { version: GHL_VERSIONS.invoices }
  );
  if (!r.ok) return res.status(r.status).json(r.data);
  const invoices = (r.data.invoices || []).filter(
    (i) => !i.contactDetails || i.contactDetails.id === contactId
  );
  return res.status(200).json({ invoices });
};
