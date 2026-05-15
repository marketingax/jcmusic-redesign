'use strict';
const { parseCookies, verifySession } = require('../lib/ghl');

module.exports = async (req, res) => {
  const cookies = parseCookies(req);
  return res.status(200).json({ authenticated: verifySession(cookies.jc_session) });
};
