import bcrypt from 'bcryptjs';

/**
 * Laravel hashes passwords with bcrypt, producing `$2y$` prefixed hashes.
 * bcryptjs verifies `$2a$`/`$2b$`; the `$2y$` variant is algorithmically
 * identical, so we normalise the prefix before comparing existing hashes.
 */
function normalize(hash: string): string {
  return hash.startsWith('$2y$') ? '$2b$' + hash.slice(4) : hash;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, normalize(hash));
}
