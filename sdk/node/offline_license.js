'use strict';
const crypto = require('node:crypto');

/**
 * Verify a cached credential with a trusted, embedded Ed25519 public key.
 * Never obtain the trust key from the same untrusted response as the credential.
 * expected must contain the application's numeric app_id and local device_id.
 */
function verifyOfflineLicense(credential, publicKeyBase64, expected) {
  try {
    if (!expected || !Number.isSafeInteger(expected.app_id) || typeof expected.device_id !== 'string' || !expected.device_id) return false;
    const { license, signature } = credential;
    if (!license || typeof signature !== 'string' || license.app_id !== expected.app_id || license.device_id !== expected.device_id) return false;
    const key = crypto.createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519') return false;
    if (!crypto.verify(null, Buffer.from(JSON.stringify(license)), key, Buffer.from(signature, 'base64'))) return false;
    const issued = Date.parse(license.issued_at), expires = Date.parse(license.expires_at), now = Date.now();
    return Number.isFinite(issued) && Number.isFinite(expires) && issued <= now && expires > now && expires > issued;
  } catch { return false; }
}

module.exports = { verifyOfflineLicense };
