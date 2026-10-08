import { Inject, Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { renderCheckout } from '../views/checkout.html';
import type { Response } from 'express';
import { IsIn, IsString, Matches } from 'class-validator';
import { ASSET_LINKS, AssetLinksPort, CHECKOUT_POLICY, CheckoutPolicyPort } from '../../application/ports/tool-integrations.port';
import { LoadContractUseCase } from '../../application/use-cases/load-contract.use-case';
import { IssueReceiptUseCase } from '../../application/use-cases/issue-receipt.use-case';
import { ProcessDemoPaymentUseCase } from '../../application/use-cases/convai-payment.use-cases';

class DemoPaymentDto {
  @IsString() contrato_id!: string;
  @IsIn(['approved', 'rejected']) status!: 'approved' | 'rejected';
  @Matches(/^\d+$/) expires!: string;
  @Matches(/^[a-f0-9]{64}$/) token!: string;
}


@Controller()
export class ToolAssetsController {
  constructor(
    @Inject(ASSET_LINKS) private readonly links: AssetLinksPort,
    @Inject(CHECKOUT_POLICY) private readonly policy: CheckoutPolicyPort,
    private readonly contracts: LoadContractUseCase,
    private readonly receipts: IssueReceiptUseCase,
    private readonly payments: ProcessDemoPaymentUseCase,
  ) {}

  @Get('receipts/:id')
  async receipt(@Param('id') id: string, @Query('expires') expires: string, @Query('token') token: string, @Res() res: Response) {
    this.links.verify(id, 'receipt', expires, token);
    const { document, invoice } = await this.receipts.getDocument(id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.id}.pdf"`);
    res.type('application/pdf').send(document);
  }

  @Get('pay/:id')
  async checkout(@Param('id') id: string, @Query('expires') expires: string, @Query('token') token: string, @Res() res: Response) {
    this.links.verify(id, 'pay', expires, token);
    const c = await this.contracts.execute(id);
    this.policy.assertDemoEnabled();
    const nonce = randomBytes(18).toString('base64');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
    res.type('html').send(renderCheckout({
      contratoId: c.id,
      producto: c.productCode,
      nombreCompleto: c.fullName,
      monto: c.amount,
      yaPagado: c.paymentStatus === 'confirmed',
      rechazado: c.paymentStatus === 'rejected',
      expires, token, nonce,
    }));
  }

  @Post('api/pagos/webhook')
  payment(@Body() dto: DemoPaymentDto) {
    this.links.verify(dto.contrato_id, 'pay', dto.expires, dto.token);
    return this.payments.execute(dto.contrato_id, dto.status);
  }
}
