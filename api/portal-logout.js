'use strict';

module.exports = async (req, res) => {
  res.setHeader(
    'Set-Cookie',
    'jc_portal=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
  );
  return res.status(200).json({ ok: true });
};
