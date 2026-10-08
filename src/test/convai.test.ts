import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConvaiController } from '../interfaces/controllers/convai.controller';
import { ToolAssetsController } from '../interfaces/controllers/tool-assets.controller';
import { QuoteNewToolUseCase, ListContractedToolsUseCase, QuoteRenewalToolUseCase } from '../application/use-cases/convai-catalogue.use-cases';
import { RegisterToolContractUseCase } from '../application/use-cases/register-tool-contract.use-case';
import { GeneratePaymentLinkUseCase, QueryPaymentStatusUseCase, ProcessDemoPaymentUseCase } from '../application/use-cases/convai-payment.use-cases';
import { SendToolInvoiceUseCase } from '../application/use-cases/send-tool-invoice.use-case';
import { EscalateToolUseCase } from '../application/use-cases/escalate-tool.use-case';
import { LoadContractUseCase } from '../application/use-cases/load-contract.use-case';
import { ASSET_LINKS, CHECKOUT_POLICY, CONTRACT_CONTACT, CONVERSATION_IDENTITY, INVOICE_DELIVERY, PAYMENT_NOTIFICATION } from '../application/ports/tool-integrations.port';
import { CONTRACT_SEARCH, PENDING_CONTRACT } from '../application/ports/tool-contracts.port';
import { HmacAssetLinksAdapter } from '../infrastructure/links/hmac-asset-links.adapter';
import { CheckoutPolicyAdapter } from '../infrastructure/config/checkout-policy.adapter';
import { ContractSearchPostgresAdapter, PendingContractPostgresAdapter } from '../infrastructure/persistence/postgres/tool-contracts.postgres.adapter';
import { QuoteProductUseCase } from '../application/use-cases/quote-product.use-case';
import { CreateContractUseCase } from '../application/use-cases/create-contract.use-case';
import { ManagePaymentUseCase } from '../application/use-cases/manage-payment.use-case';
import { IssueReceiptUseCase } from '../application/use-cases/issue-receipt.use-case';
import { EscalateConversationUseCase } from '../application/use-cases/escalate-conversation.use-case';
import { Contract } from '../domain/entities/contract.entity';
import { Invoice } from '../domain/entities/invoice.entity';
import { Customer } from '../domain/entities/customer.entity';
import { PdfKitGenerator } from '../infrastructure/documents/pdfkit.generator';

test('eight ElevenLabs tools preserve Spanish payloads, persistence and signed assets', async () => {
  process.env.CONVAI_API_KEY = 'test-key';
  process.env.ENABLE_DEMO_CHECKOUT = 'true';
  const contracts = new Map<string, Contract>();
  const customers = new Map<string, Customer>();
  const invoices = new Map<string, { invoice: Invoice; document: Buffer }>();
  let seq = 0;
  let crmWrites = 0;
  const repo = {
    findById: async (id: string) => contracts.get(id) ?? null,
    create: async (c: Contract) => { contracts.set(c.id, c); return c; },
    update: async (c: Contract) => { contracts.set(c.id, c); return c; },
    nextSequence: async () => ++seq,
    findByPhone: async (phone: string) => [...contracts.values()].filter(c => c.phone === phone),
  };
  const customerRepo = {
    findByTaxId: async (id: string) => [...customers.values()].find(c => c.taxId === id) ?? null,
    findByPhone: async (phone: string) => customers.get(phone) ?? null,
    save: async (c: Customer) => { customers.set(c.phone, c); return c; },
  };
  const receipts = new IssueReceiptUseCase(repo, {
    findByContract: async id => invoices.get(id)?.invoice ?? null,
    save: async (invoice, document) => { invoices.set(invoice.contractId, { invoice, document }); return invoice; },
    getDocument: async id => invoices.get(id)?.document ?? null,
  }, new PdfKitGenerator());
  const search = {
    findServices: async (taxId: string, plate: string) => [...contracts.values()]
      .filter(c => c.taxId === taxId && (c.toJSON().vehicle as any)?.placa.toUpperCase() === plate.toUpperCase())
      .map(c => ({ fullName: c.fullName, productCode: c.productCode })),
    findPendingIds: async (taxId: string, code: string) => [...contracts.values()]
      .filter(c => c.taxId === taxId && c.productCode === code && c.paymentStatus === 'pending').map(c => c.id),
  };
  const pending = { getOrCreate: async (command: any) =>
    [...contracts.values()].find(c => c.taxId === command.taxId && c.productCode === command.productCode && c.type === command.type && c.paymentStatus === 'pending')
    ?? new CreateContractUseCase(repo, customerRepo).execute(command),
  };
  const crm: any = { contactExists: async () => true, markOptInAndContract: async () => true, setEmail: async () => {}, setFacturaUrl: async () => { crmWrites++; return true; }, notificarPago: async () => { crmWrites++; } };
  const directory: any = { findContactByText: async () => ({ contactId: 'contact-test', phoneE164: '+593999999999' }) };
  const tickets: any = { nextSequence: async () => 1, create: async (t: any) => t };
  const links = new HmacAssetLinksAdapter();
  const policy = new CheckoutPolicyAdapter();
  const quotes = new QuoteProductUseCase();
  const services = new ListContractedToolsUseCase(search, quotes);
  const load = new LoadContractUseCase(repo);
  const providers = [
    { provide: QuoteNewToolUseCase, useValue: new QuoteNewToolUseCase(quotes) },
    { provide: ListContractedToolsUseCase, useValue: services },
    { provide: QuoteRenewalToolUseCase, useValue: new QuoteRenewalToolUseCase(services, quotes) },
    { provide: RegisterToolContractUseCase, useValue: new RegisterToolContractUseCase(pending, directory, crm, quotes) },
    { provide: GeneratePaymentLinkUseCase, useValue: new GeneratePaymentLinkUseCase(repo, search, links) },
    { provide: QueryPaymentStatusUseCase, useValue: new QueryPaymentStatusUseCase(load, links) },
    { provide: SendToolInvoiceUseCase, useValue: new SendToolInvoiceUseCase(load, receipts, links, crm) },
    { provide: EscalateToolUseCase, useValue: new EscalateToolUseCase(new EscalateConversationUseCase(tickets)) },
    { provide: LoadContractUseCase, useValue: load },
    { provide: IssueReceiptUseCase, useValue: receipts },
    { provide: ASSET_LINKS, useValue: links },
    { provide: CHECKOUT_POLICY, useValue: policy },
    { provide: ProcessDemoPaymentUseCase, useValue: new ProcessDemoPaymentUseCase(load, new ManagePaymentUseCase(repo), receipts, links, crm, policy) },
  ];
  @Module({ controllers: [ConvaiController, ToolAssetsController], providers })
  class TestModule {}
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  process.env.PUBLIC_BASE_URL = base;
  const post = async (path: string, body: unknown, auth = true) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer test-key' } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };
  const call = (path: string, body: unknown, auth = true) => post('/api/convai/' + path, body, auth);
  try {
    assert.equal((await call('pagos/estado', { contrato_id: 'CT-000001' }, false)).status, 401);
    const quote = await call('cotizar/nuevo', { codigo_producto: 'SEG03', marca: 'Toyota', modelo: 'Hilux', anio: '2024', ciudad: 'Quito', uso: 'personal' });
    assert.equal(quote.status, 201);
    assert.equal(quote.body.precio, 263.39);
    assert.equal(quote.body.incluye_impuestos, false);
    assert.equal((await call('cotizar/nuevo', { codigo_producto: 'SEG03' })).status, 400);
    const input = { nombre_completo: 'Prueba Local', identificacion: 'TEST12345', correo: 'test@example.com', codigo_producto: 'SEG03', vehiculo: { placa: 'TEST001', motor: 'motor', chasis: 'chasis' } };
    const created = await call('contratos', input);
    assert.equal(created.status, 201);
    assert.equal(created.body.monto, 302.9);
    const id = created.body.contrato_id;
    assert.equal(contracts.get(id)?.type, 'sale');
    assert.deepEqual(contracts.get(id)?.toJSON().vehicle, input.vehiculo);
    assert.equal((await call('contratos', input)).body.contrato_id, id);
    assert.equal((await call('contratos', { ...input, amount: 1 })).status, 400);
    const services = await call('servicios', { cedula: input.identificacion, placa: 'test001' });
    assert.equal(services.body.servicios[0].codigo, 'SEG03');
    assert.deepEqual((await call('servicios', { cedula: input.identificacion, placa: 'OTHER' })).body.servicios, []);
    assert.equal((await call('cotizar/renovacion', { cedula: input.identificacion, placa: 'TEST001', codigos: 'TODOS' })).body.total, 302.9);
    assert.equal((await call('cotizar/renovacion', { cedula: input.identificacion, placa: 'OTHER', codigos: 'TODOS' })).status, 400);
    assert.equal((await call('pagos/estado', { contrato_id: id })).body.estado, 'pendiente');
    assert.equal(crmWrites, 0);
    const link = await call('pagos/link', { contrato_id: id });
    assert.equal(link.body.codigo, id);
    assert.equal((await fetch(link.body.url)).status, 200);
    assert.equal((await fetch(link.body.url.replace('token=', 'token=x'))).status, 400);
    const signed = new URL(link.body.url);
    const payment = { contrato_id: id, status: 'approved', expires: signed.searchParams.get('expires'), token: signed.searchParams.get('token') };
    assert.equal((await post('/api/pagos/webhook', payment, false)).body.ok, true);
    assert.equal((await post('/api/pagos/webhook', payment, false)).body.already, true);
    assert.equal(crmWrites, 1);
    assert.equal((await call('pagos/estado', { contrato_id: id })).body.estado, 'confirmado');
    const invoice = await call('factura/enviar', { contrato_id: id });
    assert.equal(invoice.body.ok, true);
    const pdf = await fetch(invoice.body.url);
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
    assert.equal((await fetch(base + `/receipts/${id}`)).status, 400);
    assert.equal((await call('crm/escalar', { telefono: '+593999999999', motivo: 'indeciso', contexto: 'Prueba local' })).body.ticket_id, 'TK-000001');
    assert.equal((await call('imagen/enviar', { nombre: 'test' })).status, 404);
    assert.equal((await call('clientes/registrar', { nombre: 'test' })).status, 404);
    assert.equal((await post('/api/v1/contracts', {})).status, 404);
    assert.throws(() => links.verify(id, 'pay', '1', 'a'.repeat(64)));
  } finally { await app.close(); }
});
