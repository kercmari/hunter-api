import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTRACT_REPOSITORY, ContractRepository } from '../../domain/repositories/contract.repository';
import { CONTRACT_SEARCH, ContractSearchPort } from '../ports/tool-contracts.port';
import { ASSET_LINKS, AssetLinksPort, CHECKOUT_POLICY, CheckoutPolicyPort, PAYMENT_NOTIFICATION, PaymentNotificationPort } from '../ports/tool-integrations.port';
import { PaymentLinkInput } from '../dto/tool-inputs';
import { LoadContractUseCase } from './load-contract.use-case';
import { ManagePaymentUseCase } from './manage-payment.use-case';
import { IssueReceiptUseCase } from './issue-receipt.use-case';

@Injectable()
export class GeneratePaymentLinkUseCase {
  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CONTRACT_SEARCH) private readonly search: ContractSearchPort,
    @Inject(ASSET_LINKS) private readonly links: AssetLinksPort,
  ) {}
  async execute(input: PaymentLinkInput) {
    let c = input.contrato_id ? await this.contracts.findById(input.contrato_id) : null;
    if (!c && input.cedula && input.codigo_producto) {
      const ids = await this.search.findPendingIds(input.cedula, input.codigo_producto);
      if (ids.length === 1) c = await this.contracts.findById(ids[0]!);
    }
    if (!c) throw new NotFoundException('Envía el contrato_id exacto devuelto por registrar_contrato.');
    return { url: this.links.signedUrl(c.id, 'pay'), codigo: c.id, contrato_id: c.id, monto: c.amount };
  }
}

@Injectable()
export class QueryPaymentStatusUseCase {
  constructor(private readonly load: LoadContractUseCase, @Inject(ASSET_LINKS) private readonly links: AssetLinksPort) {}
  async execute(id: string) {
    const c = await this.load.execute(id);
    return { contrato_id: c.id, estado: { pending: 'pendiente', confirmed: 'confirmado', rejected: 'rechazado' }[c.paymentStatus], monto: c.amount, fecha: c.paymentUpdatedAt ? c.paymentUpdatedAt.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' }) : '', factura_url: c.isPaid ? this.links.signedUrl(id, 'receipt') : '' };
  }
}

@Injectable()
export class ProcessDemoPaymentUseCase {
  constructor(
    private readonly load: LoadContractUseCase,
    private readonly payments: ManagePaymentUseCase,
    private readonly receipts: IssueReceiptUseCase,
    @Inject(ASSET_LINKS) private readonly links: AssetLinksPort,
    @Inject(PAYMENT_NOTIFICATION) private readonly notifications: PaymentNotificationPort,
    @Inject(CHECKOUT_POLICY) private readonly policy: CheckoutPolicyPort,
  ) {}
  async execute(id: string, status: 'approved' | 'rejected') {
    this.policy.assertDemoEnabled();
    const result = status === 'approved' ? await this.payments.confirm(id) : await this.payments.reject(id);
    if (!result.unchanged) {
      const c = await this.load.execute(id);
      if (c.isPaid) await this.receipts.issue(id);
      await this.notifications.notificarPago({ correo: c.email, nombre_completo: c.fullName, telefono: c.phone, contrato_id: id, monto: c.amount, fecha: new Date().toLocaleDateString('es-EC'), estado: c.isPaid ? 'confirmado' : 'rechazado', facturaUrl: c.isPaid ? this.links.signedUrl(id, 'receipt') : undefined });
    }
    return { ok: true, already: result.unchanged, contrato_id: id };
  }
}
