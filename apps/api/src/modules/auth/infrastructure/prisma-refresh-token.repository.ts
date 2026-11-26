import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { RefreshTokenRepository, type StoredRefreshToken } from '../domain/ports';

@Injectable()
export class PrismaRefreshTokenRepository extends RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
