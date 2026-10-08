import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

@Injectable()
export class PhonePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const cleaned = (value ?? '').trim().replace(/[\s()-]/g, '');
    const normalised = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;

    if (!E164_PATTERN.test(normalised)) {
      throw new BadRequestException({
        error: 'INVALID_PHONE',
        message: 'Phone number must be in E.164 format (+5939…)',
      });
    }
    return normalised;
  }
}
