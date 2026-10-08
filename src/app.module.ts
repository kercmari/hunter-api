import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ConvaiController } from './interfaces/controllers/convai.controller';
import { ToolAssetsController } from './interfaces/controllers/tool-assets.controller';
import { QuoteNewToolUseCase, ListContractedToolsUseCase, QuoteRenewalToolUseCase } from './application/use-cases/convai-catalogue.use-cases';
import { RegisterToolContractUseCase } from './application/use-cases/register-tool-contract.use-case';
import { GeneratePaymentLinkUseCase, QueryPaymentStatusUseCase, ProcessDemoPaymentUseCase } from './application/use-cases/convai-payment.use-cases';
import { SendToolInvoiceUseCase } from './application/use-cases/send-tool-invoice.use-case';
import { EscalateToolUseCase } from './application/use-cases/escalate-tool.use-case';
import { LoadContractUseCase } from './application/use-cases/load-contract.use-case';
import { ASSET_LINKS, CHECKOUT_POLICY, CONTRACT_CONTACT, CONVERSATION_IDENTITY, INVOICE_DELIVERY, PAYMENT_NOTIFICATION } from './application/ports/tool-integrations.port';
import { CONTRACT_SEARCH, PENDING_CONTRACT } from './application/ports/tool-contracts.port';
import { HmacAssetLinksAdapter } from './infrastructure/links/hmac-asset-links.adapter';
import { CheckoutPolicyAdapter } from './infrastructure/config/checkout-policy.adapter';
import { ContractSearchPostgresAdapter, PendingContractPostgresAdapter } from './infrastructure/persistence/postgres/tool-contracts.postgres.adapter';
import { ConversationDirectory } from './infrastructure/convai/conversation-directory.service';
import { HubSpotService } from './infrastructure/convai/hubspot.service';
import { CrmWebhookController } from './interfaces/controllers/crm-webhook.controller';
import { HealthController } from './interfaces/controllers/health.controller';
import { QuoteProductUseCase } from './application/use-cases/quote-product.use-case';
import { CreateContractUseCase } from './application/use-cases/create-contract.use-case';
import { ManagePaymentUseCase } from './application/use-cases/manage-payment.use-case';
import { IssueReceiptUseCase } from './application/use-cases/issue-receipt.use-case';
import { EscalateConversationUseCase } from './application/use-cases/escalate-conversation.use-case';
import { ListCustomerServicesUseCase } from './application/use-cases/list-customer-services.use-case';
import { ResolveConversationUseCase } from './application/use-cases/resolve-conversation.use-case';
import { DOCUMENT_GENERATOR } from './application/ports/document-generator.port';
import { CRM_PORT } from './application/ports/crm.port';
import { PdfKitGenerator } from './infrastructure/documents/pdfkit.generator';
import { HubSpotAdapter } from './infrastructure/crm/hubspot.adapter';

@Module({
  imports: [
    PersistenceModule,

    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000),
        limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
      },
    ]),
  ],
  controllers: [ConvaiController, ToolAssetsController, CrmWebhookController, HealthController],
  providers: [
    ConversationDirectory, HubSpotService,
    QuoteNewToolUseCase, ListContractedToolsUseCase, QuoteRenewalToolUseCase,
    RegisterToolContractUseCase, GeneratePaymentLinkUseCase, QueryPaymentStatusUseCase,
    ProcessDemoPaymentUseCase, SendToolInvoiceUseCase, EscalateToolUseCase, LoadContractUseCase,
    { provide: ASSET_LINKS, useClass: HmacAssetLinksAdapter },
    { provide: CHECKOUT_POLICY, useClass: CheckoutPolicyAdapter },
    { provide: CONTRACT_SEARCH, useClass: ContractSearchPostgresAdapter },
    { provide: PENDING_CONTRACT, useClass: PendingContractPostgresAdapter },
    { provide: CONVERSATION_IDENTITY, useExisting: ConversationDirectory },
    { provide: CONTRACT_CONTACT, useExisting: HubSpotService },
    { provide: INVOICE_DELIVERY, useExisting: HubSpotService },
    { provide: PAYMENT_NOTIFICATION, useExisting: HubSpotService },
    QuoteProductUseCase,
    CreateContractUseCase,
    ManagePaymentUseCase,
    IssueReceiptUseCase,
    EscalateConversationUseCase,
    ListCustomerServicesUseCase,
    ResolveConversationUseCase,
    { provide: DOCUMENT_GENERATOR, useClass: PdfKitGenerator },
    { provide: CRM_PORT, useClass: HubSpotAdapter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
