/* @name InsertSession */
INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at)
VALUES (:idHash!, :userId!, :now!, :now!, :expiresAt!);

/* @name FindSessionWithUser */
SELECT s.last_seen_at, s.expires_at, u.id, u.name, u.email, u.role
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id_hash = :idHash!;

/* @name TouchSession */
UPDATE sessions SET last_seen_at = :now!
WHERE id_hash = :idHash!;

/* @name DeleteSession */
DELETE FROM sessions
WHERE id_hash = :idHash!;
