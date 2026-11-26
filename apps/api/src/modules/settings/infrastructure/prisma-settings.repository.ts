import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { SettingsRepository } from '../domain/settings.repository';

@Injectable()
export class PrismaSettingsRepository extends SettingsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findValue(key: string): Promise<unknown> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value;
  }
}
