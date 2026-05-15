'use strict';
const { requireAuth, ghlFetch, LOCATION_ID } = require('../lib/ghl');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const loc = LOCATION_ID();
  const [pipelines, opps] = await Promise.all([
    ghlFetch(`/opportunities/pipelines?locationId=${loc}`),
    ghlFetch(`/opportunities/search?location_id=${loc}&limit=50`),
  ]);
  return res.status(200).json({
    pipelines: pipelines.ok ? pipelines.data.pipelines || [] : [],
    opportunities: opps.ok ? opps.data.opportunities || [] : [],
    meta: opps.ok ? opps.data.meta || {} : {},
  });
};
