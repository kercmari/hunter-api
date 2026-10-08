import { BadRequestException, Injectable } from '@nestjs/common';
import { EscalationInput } from '../dto/tool-inputs';
import { normalizePhone } from '../../domain/value-objects/phone';
import { EscalateConversationUseCase } from './escalate-conversation.use-case';

@Injectable()
export class EscalateToolUseCase {
  constructor(private readonly escalations: EscalateConversationUseCase) {}
  async execute(input: EscalationInput) {
    const phone = normalizePhone(input.telefono);
    if (!phone) throw new BadRequestException('Teléfono inválido');
    const t = await this.escalations.execute({ phone, reason: input.motivo, context: input.contexto });
    return { ok: true, ticket_id: t.id };
  }
}
