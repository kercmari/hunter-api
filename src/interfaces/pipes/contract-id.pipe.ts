import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const ID_PATTERN = /^CT-\d{6}$/;

@Injectable()
export class ContractIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const id = (value ?? '').trim().toUpperCase();
    if (!ID_PATTERN.test(id)) {
      throw new BadRequestException({
        error: 'INVALID_ID',
        message: 'Contract identifier must match the format CT-000000',
      });
    }
    return id;
  }
}
