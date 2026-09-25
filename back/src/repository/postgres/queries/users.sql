/* O e-mail chega já normalizado (minúsculo, sem espaço): é a forma guardada na coluna. */

/* @name FindUserByEmail */
SELECT id, name, email, role, password_hash
FROM users
WHERE email = :email!;
