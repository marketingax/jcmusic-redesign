'use strict';
const { verifyMagicToken, createPortalSession } = require('../lib/ghl');

module.exports = async (req, res) => {
  const contactId = verifyMagicToken(req.query.token);
  if (!contactId) {
    res.statusCode = 302;
    res.setHeader('Location', '/portal/?error=expired');
    return res.end();
  }
  const days = 14;
  const session = createPortalSession(contactId, days);
  res.setHeader(
    'Set-Cookie',
    `jc_portal=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${days * 86400}`
  );
  res.statusCode = 302;
  res.setHeader('Location', '/portal/');
  return res.end();
};
