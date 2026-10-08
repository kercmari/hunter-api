import { Inject, Injectable } from '@nestjs/common';
import { ASSET_LINKS, AssetLinksPort, INVOICE_DELIVERY, InvoiceDeliveryPort } from '../ports/tool-integrations.port';
import { LoadContractUseCase } from './load-contract.use-case';
import { IssueReceiptUseCase } from './issue-receipt.use-case';

@Injectable()
export class SendToolInvoiceUseCase {
  constructor(
    private readonly load: LoadContractUseCase,
    private readonly receipts: IssueReceiptUseCase,
    @Inject(ASSET_LINKS) private readonly links: AssetLinksPort,
    @Inject(INVOICE_DELIVERY) private readonly delivery: InvoiceDeliveryPort,
  ) {}
  async execute(id: string) {
    const c = await this.load.execute(id);
    await this.receipts.issue(id);
    const url = this.links.signedUrl(id, 'receipt');
    const ok = await this.delivery.setFacturaUrl(c.phone, c.email, url, id);
    return { ok, contrato_id: id, url, factura_url: url };
  }
}
