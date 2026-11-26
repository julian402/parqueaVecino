import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { PasswordHasher } from '../domain/ports';

@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
