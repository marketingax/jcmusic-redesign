'use strict';
const { requireAuth, ghlFetch, LOCATION_ID } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const r = await ghlFetch(
    `/conversations/search?locationId=${LOCATION_ID()}&limit=${limit}&sort=desc&sortBy=last_message_date`
  );
  return res.status(r.ok ? 200 : r.status).json(r.data);
};
