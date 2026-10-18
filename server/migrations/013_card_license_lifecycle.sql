-- Duplicate legacy card licenses must be resolved explicitly before upgrade; never discard licenses.
ALTER TABLE licenses ADD UNIQUE INDEX uk_license_card (card_id);

-- Preserve historical card expiry and binding; running sessions become managed licenses too.
INSERT INTO licenses (app_id, card_id, device_id, status, issued_at, expires_at)
SELECT c.app_id, c.id, NULLIF(c.mac, ''),
       CASE WHEN c.status <> 'enabled' THEN 'banned'
            WHEN c.expires_at IS NOT NULL AND c.expires_at <= NOW() THEN 'expired'
            ELSE 'active' END,
       COALESCE(c.activated_at, c.created_at), c.expires_at
FROM cards c LEFT JOIN licenses l ON l.card_id = c.id
WHERE c.is_activated = 1 AND l.id IS NULL;

-- Honor already-recorded legacy unbinds: revoke stale card session instead of recreating a binding.
UPDATE cards c JOIN licenses l ON l.card_id = c.id
SET c.mac = NULL, c.token = NULL, c.token_expires_at = NULL, l.device_id = NULL
WHERE c.mac = l.device_id
AND EXISTS (SELECT 1 FROM license_device_bindings b WHERE b.license_id = l.id)
AND NOT EXISTS (SELECT 1 FROM license_device_bindings b WHERE b.license_id = l.id AND b.unbound_at IS NULL);

INSERT INTO license_device_bindings (license_id, device_id)
SELECT l.id, l.device_id FROM licenses l
WHERE l.device_id IS NOT NULL AND l.device_id <> ''
AND NOT EXISTS (SELECT 1 FROM license_device_bindings b WHERE b.license_id = l.id);

ALTER TABLE license_device_bindings ADD COLUMN active_marker TINYINT GENERATED ALWAYS AS (CASE WHEN unbound_at IS NULL THEN 1 ELSE NULL END) STORED;
ALTER TABLE license_device_bindings ADD UNIQUE INDEX uk_license_active_device (license_id, device_id, active_marker);
