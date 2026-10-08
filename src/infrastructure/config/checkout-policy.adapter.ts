import { BadRequestException, Injectable } from '@nestjs/common';
import { CheckoutPolicyPort } from '../../application/ports/tool-integrations.port';

@Injectable()
export class CheckoutPolicyAdapter implements CheckoutPolicyPort {
  assertDemoEnabled(): void {
    if (process.env.ENABLE_DEMO_CHECKOUT !== 'true') throw new BadRequestException('Checkout de prueba deshabilitado');
  }
}
