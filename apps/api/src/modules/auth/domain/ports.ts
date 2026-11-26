export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;
  abstract verify(hash: string, plain: string): Promise<boolean>;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Se guarda solo el hash (sha256) del refresh token, nunca el token en claro. */
export abstract class RefreshTokenRepository {
  abstract create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  abstract findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  abstract revoke(id: string): Promise<void>;
  abstract revokeAllForUser(userId: string): Promise<void>;
}
