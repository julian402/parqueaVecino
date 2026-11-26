import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import { SettingsRepository, type StoredSetting } from '../domain/settings.repository';

@Injectable()
export class PrismaSettingsRepository extends SettingsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findValue(key: string): Promise<unknown> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value;
  }

  listAll(): Promise<StoredSetting[]> {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async save(key: string, value: unknown): Promise<StoredSetting | null> {
    const { count } = await this.prisma.systemSetting.updateMany({
      where: { key },
      data: { value: value as Prisma.InputJsonValue },
    });
    if (count === 0) return null;
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }
}
