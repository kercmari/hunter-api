import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CONTRACT_SEARCH, ContractSearchPort } from '../ports/tool-contracts.port';
import { NewQuoteInput, RenewalInput, ServicesInput } from '../dto/tool-inputs';
import { QuoteProductUseCase } from './quote-product.use-case';

@Injectable()
export class QuoteNewToolUseCase {
  constructor(private readonly quotes: QuoteProductUseCase) {}
  execute(input: NewQuoteInput) {
    if (!input.codigo_producto?.trim()) throw new BadRequestException('Falta codigo_producto: elige SEG01, SEG02 o SEG03.');
    const p = this.quotes.execute(input.codigo_producto);
    return { codigo: p.productCode, precio: p.subtotal, periodo: 'anual', incluye_impuestos: false, servicios: p.services };
  }
}

@Injectable()
export class ListContractedToolsUseCase {
  constructor(@Inject(CONTRACT_SEARCH) private readonly search: ContractSearchPort, private readonly quotes: QuoteProductUseCase) {}
  async execute(input: ServicesInput) {
    const products = await this.search.findServices(input.cedula, input.placa);
    return { cliente: products[0]?.fullName ?? '', servicios: products.map(p => ({ codigo: p.productCode, nombre: this.quotes.execute(p.productCode).productName })) };
  }
}

@Injectable()
export class QuoteRenewalToolUseCase {
  constructor(private readonly services: ListContractedToolsUseCase, private readonly quotes: QuoteProductUseCase) {}
  async execute(input: RenewalInput) {
    const available = (await this.services.execute(input)).servicios.map(s => s.codigo);
    const codes = input.codigos.some(c => c.trim().toUpperCase() === 'TODOS')
      ? available : [...new Set(input.codigos.map(c => c.trim().toUpperCase()))];
    if (!codes.length || codes.some(c => !available.includes(c))) throw new BadRequestException('No hay servicios contratados que coincidan con la cédula, placa y códigos.');
    const items = codes.map(c => ({ codigo: c, precio: this.quotes.execute(c).total, periodo: 'anual', iva: true }));
    return { items, total: Math.round(items.reduce((n, i) => n + i.precio, 0) * 100) / 100 };
  }
}
