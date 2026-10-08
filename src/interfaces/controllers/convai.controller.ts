import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { QuoteNewToolUseCase, ListContractedToolsUseCase, QuoteRenewalToolUseCase } from '../../application/use-cases/convai-catalogue.use-cases';
import { RegisterToolContractUseCase } from '../../application/use-cases/register-tool-contract.use-case';
import { GeneratePaymentLinkUseCase, QueryPaymentStatusUseCase } from '../../application/use-cases/convai-payment.use-cases';
import { SendToolInvoiceUseCase } from '../../application/use-cases/send-tool-invoice.use-case';
import { EscalateToolUseCase } from '../../application/use-cases/escalate-tool.use-case';
import { ContratoDto, CotizarNuevoDto, CotizarRenovacionDto, EscalarDto, FacturaDto, PagoEstadoDto, PagoLinkDto, ServiciosDto } from '../dto/convai.dto';

@Controller('api/convai')
@UseGuards(ApiKeyGuard)
export class ConvaiController {
  constructor(
    private readonly quotes: QuoteNewToolUseCase,
    private readonly services: ListContractedToolsUseCase,
    private readonly renewals: QuoteRenewalToolUseCase,
    private readonly contracts: RegisterToolContractUseCase,
    private readonly links: GeneratePaymentLinkUseCase,
    private readonly payments: QueryPaymentStatusUseCase,
    private readonly escalations: EscalateToolUseCase,
    private readonly invoices: SendToolInvoiceUseCase,
  ) {}
  @Post('cotizar/nuevo') quote(@Body() dto: CotizarNuevoDto) { return this.quotes.execute(dto); }
  @Post('servicios') list(@Body() dto: ServiciosDto) { return this.services.execute(dto); }
  @Post('cotizar/renovacion') renewal(@Body() dto: CotizarRenovacionDto) { return this.renewals.execute(dto); }
  @Post('contratos') create(@Body() dto: ContratoDto) { return this.contracts.execute(dto); }
  @Post('pagos/link') link(@Body() dto: PagoLinkDto) { return this.links.execute(dto); }
  @Post('pagos/estado') status(@Body() dto: PagoEstadoDto) { return this.payments.execute(dto.contrato_id); }
  @Post('crm/escalar') escalate(@Body() dto: EscalarDto) { return this.escalations.execute(dto); }
  @Post('factura/enviar') invoice(@Body() dto: FacturaDto) { return this.invoices.execute(dto.contrato_id); }
}
