/* @name FindUserByEmail */
SELECT id, name, email, role, password_hash
FROM users
WHERE email = :email!;
