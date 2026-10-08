import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PENDING_CONTRACT, PendingContractPort } from '../ports/tool-contracts.port';
import { CONTRACT_CONTACT, ContractContactPort, CONVERSATION_IDENTITY, ConversationIdentityPort } from '../ports/tool-integrations.port';
import { RegisterContractInput } from '../dto/tool-inputs';
import { normalizePhone } from '../../domain/value-objects/phone';
import { QuoteProductUseCase } from './quote-product.use-case';

@Injectable()
export class RegisterToolContractUseCase {
  constructor(
    @Inject(PENDING_CONTRACT) private readonly contracts: PendingContractPort,
    @Inject(CONVERSATION_IDENTITY) private readonly identities: ConversationIdentityPort,
    @Inject(CONTRACT_CONTACT) private readonly contacts: ContractContactPort,
    private readonly quotes: QuoteProductUseCase,
  ) {}
  async execute(input: RegisterContractInput) {
    this.quotes.execute(input.codigo_producto);
    const identity = await this.identities.findContactByText(input.identificacion, input.correo);
    if (!identity || !normalizePhone(identity.phoneE164)) throw new BadRequestException('No pude identificar la conversación. Escribe tu cédula en el chat y vuelve a intentar.');
    let contactId = identity.contactId;
    if (!contactId || !(await this.contacts.contactExists(contactId))) contactId = await this.contacts.resolveOrCreateByPhone(identity.phoneE164, input.nombre_completo);
    if (!contactId) throw new ServiceUnavailableException('No se pudo vincular el contacto de HubSpot.');
    const contract = await this.contracts.getOrCreate({
      type: input.tipo === 'renovacion' ? 'renewal' : 'sale', taxId: input.identificacion.trim(),
      productCode: input.codigo_producto, fullName: input.nombre_completo, email: input.correo,
      phone: identity.phoneE164, vehicle: input.vehiculo,
    });
    await this.contacts.markOptInAndContract(contactId, contract.id);
    await this.contacts.setEmail(contactId, input.correo);
    return { contrato_id: contract.id, monto: contract.amount };
  }
}
