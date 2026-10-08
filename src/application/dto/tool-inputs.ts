export interface NewQuoteInput { codigo_producto?: string; }
export interface ServicesInput { cedula: string; placa: string; }
export interface RenewalInput extends ServicesInput { codigos: string[]; }
export interface RegisterContractInput {
  tipo: 'venta' | 'renovacion'; nombre_completo: string; identificacion: string;
  correo: string; codigo_producto: string; vehiculo?: unknown;
}
export interface PaymentLinkInput { contrato_id?: string; cedula?: string; codigo_producto?: string; }
export interface EscalationInput { telefono: string; motivo: string; contexto: string; }
