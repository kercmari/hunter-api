import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { AssetLinksPort, AssetPurpose } from '../../application/ports/tool-integrations.port';

@Injectable()
export class HmacAssetLinksAdapter implements AssetLinksPort {
  signedUrl(id: string, purpose: AssetPurpose): string {
    const expires = String(Math.floor(Date.now() / 1000) + 86400);
    const token = this.signature(id, purpose, expires);
    const base = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/${purpose === 'pay' ? 'pay' : 'receipts'}/${encodeURIComponent(id)}?expires=${expires}&token=${token}`;
  }

  verify(id: string, purpose: AssetPurpose, expires: string, token: string): void {
    if (!/^\d+$/.test(expires || '') || Number(expires) < Date.now() / 1000 || !/^[a-f0-9]{64}$/.test(token || '')) throw new BadRequestException('Enlace inválido o vencido');
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(this.signature(id, purpose, expires)))) throw new BadRequestException('Enlace inválido');
  }

  private signature(id: string, purpose: AssetPurpose, expires: string): string {
    const key = process.env.LINK_SIGNING_SECRET || process.env.CONVAI_API_KEY || process.env.API_KEY;
    if (!key) throw new ServiceUnavailableException('Falta clave de firma');
    return createHmac('sha256', key).update(`${purpose}:${id}:${expires}`).digest('hex');
  }
}
