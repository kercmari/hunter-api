import { Injectable } from '@nestjs/common';
import { CATALOGUE, Product, calculatePrice, findProduct } from '../../domain/entities/product.entity';
import { NotFoundError } from '../../domain/errors/domain.error';

export interface QuoteResult {
  readonly productCode: string;
  readonly productName: string;
  readonly services: readonly string[];
  readonly subtotal: number;
  readonly vat: number;
  readonly total: number;
}

@Injectable()
export class QuoteProductUseCase {

  execute(productCode: string): QuoteResult {
    const product = findProduct(productCode);
    if (!product) throw new NotFoundError('Product', productCode);
    return this.quote(product);
  }

  listCatalogue(): QuoteResult[] {
    return Object.values(CATALOGUE).map((product) => this.quote(product));
  }

  private quote(product: Product): QuoteResult {
    const { subtotal, vat, total } = calculatePrice(product);
    return {
      productCode: product.code,
      productName: product.name,
      services: product.services,
      subtotal,
      vat,
      total,
    };
  }
}
