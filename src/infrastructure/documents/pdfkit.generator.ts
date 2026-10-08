import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Contract } from '../../domain/entities/contract.entity';
import { VAT_RATE, findProduct } from '../../domain/entities/product.entity';
import { DocumentGenerator } from '../../application/ports/document-generator.port';

@Injectable()
export class PdfKitGenerator implements DocumentGenerator {
  async generateReceipt(contract: Contract): Promise<Buffer> {
    const product = findProduct(contract.productCode);
    const productName = product?.name ?? contract.productCode;

    const subtotal = this.round(contract.amount / (1 + VAT_RATE));
    const vat = this.round(contract.amount - subtotal);

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).text('Hunter — Seguridad Vehicular');
        doc.moveDown(0.3);
        doc.fontSize(14).fillColor('#444').text('Comprobante de contratación');
        doc.moveDown(1);

        doc.fillColor('#000').fontSize(11);
        const row = (label: string, value: string) => {
          doc.font('Helvetica-Bold').text(label, { continued: true });
          doc.font('Helvetica').text(` ${value}`);
        };

        row('N° de contrato:', contract.id);
        row('Fecha:', contract.createdAt.toISOString().slice(0, 10));
        row('Tipo:', contract.type === 'renewal' ? 'Renovación' : 'Venta');
        doc.moveDown(0.5);
        row('Cliente:', contract.fullName);
        row('Identificación:', contract.taxId);
        row('Correo:', contract.email);
        row('Teléfono:', contract.phone);
        doc.moveDown(1);

        doc.font('Helvetica-Bold').fontSize(12).text('Detalle');
        doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
        doc.moveDown(0.5);

        doc.fontSize(11);
        row('Producto:', `${productName} (${contract.productCode})`);
        if (product?.services.length) {
          row('Servicios:', product.services.join(', '));
        }
        doc.moveDown(0.5);
        row('Subtotal:', `$${subtotal.toFixed(2)}`);
        row(`IVA (${(VAT_RATE * 100).toFixed(0)}%):`, `$${vat.toFixed(2)}`);
        doc.font('Helvetica-Bold');
        row('Total:', `$${contract.amount.toFixed(2)}`);
        doc.font('Helvetica');
        doc.moveDown(0.5);
        row('Estado del pago:', this.paymentLabel(contract.paymentStatus));

        doc.moveDown(2);
        doc.fontSize(9).fillColor('#666').text(
          'Documento generado automáticamente. No constituye factura electrónica con validez tributaria.',
          { align: 'center' },
        );

        doc.end();
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  private paymentLabel(status: string): string {
    if (status === 'confirmed') return 'Pagado';
    if (status === 'rejected') return 'Rechazado';
    return 'Pendiente de pago';
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
