export interface Product {
  readonly code: string;
  readonly name: string;

  readonly services: readonly string[];

  readonly yearlyPrice: number;
}

export const VAT_RATE = 0.15;

export const CATALOGUE: Readonly<Record<string, Product>> = Object.freeze({
  SEG01: {
    code: 'SEG01',
    name: 'Hunter Monitoreo',
    services: ['Paralizador'],
    yearlyPrice: 263.39,
  },
  SEG02: {
    code: 'SEG02',
    name: 'Hunter Rastreo',
    services: ['Rastreo satelital', 'Paralizador'],
    yearlyPrice: 263.39,
  },
  SEG03: {
    code: 'SEG03',
    name: 'Hunter Full',
    services: ['Rastreo satelital', 'Paralizador', 'Botón de pánico'],
    yearlyPrice: 263.39,
  },
});

export function findProduct(code: string): Product | undefined {
  return CATALOGUE[code.trim().toUpperCase()];
}

export interface PriceBreakdown {
  readonly subtotal: number;
  readonly vat: number;
  readonly total: number;
}

export function calculatePrice(product: Product): PriceBreakdown {
  const subtotal = round(product.yearlyPrice);
  const vat = round(subtotal * VAT_RATE);
  return { subtotal, vat, total: round(subtotal + vat) };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
