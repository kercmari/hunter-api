import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { normalizePhone } from '../../infrastructure/convai/phone.util';

export class CotizarNuevoDto {

  @IsOptional() @IsString() codigo_producto?: string;
  @IsString() @IsNotEmpty() marca!: string;
  @IsString() @IsNotEmpty() modelo!: string;
  @Type(() => Number) @IsInt() @Min(1950) @Max(2100) anio!: number;
  @IsString() @IsNotEmpty() ciudad!: string;
  @IsString() @IsNotEmpty() uso!: string;
}

export class ServiciosDto {
  @IsString() @IsNotEmpty() cedula!: string;
  @IsString() @IsNotEmpty() placa!: string;
}

function normalizeCodigos(v: unknown): unknown {
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return v;
}

export class CotizarRenovacionDto {
  @IsString() @IsNotEmpty() cedula!: string;
  @IsString() @IsNotEmpty() placa!: string;

  @Transform(({ value }) => normalizeCodigos(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  codigos!: string[]; 
}

export class VehiculoDto {
  @IsString() @IsNotEmpty() motor!: string;
  @IsString() @IsNotEmpty() chasis!: string;
  @IsString() @IsNotEmpty() placa!: string;
}

function normalizeTipo(v: unknown): unknown {

  if (v === undefined || v === null || v === '') return 'venta';
  if (typeof v !== 'string') return v;
  const t = v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); 
  if (['venta', 'compra', 'nueva', 'nuevo'].includes(t)) return 'venta';
  if (['renovacion', 'renovar', 'renueva'].includes(t)) return 'renovacion';
  return v; 
}

export class ContratoDto {

  @Transform(({ value }) => normalizeTipo(value))
  @IsOptional()
  @IsIn(['venta', 'renovacion'])
  tipo: 'venta' | 'renovacion' = 'venta';

  @IsString() @IsNotEmpty() nombre_completo!: string;
  @IsString() @IsNotEmpty() identificacion!: string;
  @IsEmail() correo!: string;

  @IsString() @IsNotEmpty() codigo_producto!: string;

  @IsOptional() vehiculo?: VehiculoDto | string;
}

export class PagoLinkDto {

  @IsOptional() @IsString() contrato_id?: string;
  @IsOptional() @IsString() cedula?: string;
  @IsOptional() @IsString() codigo_producto?: string;

  @Transform(({ value }) => normalizePhone(value))
  @IsOptional()
  @IsString()
  telefono?: string;
}

export class EscalarDto {
  @IsString() @IsNotEmpty() telefono!: string;
  @IsIn(['objecion_precio', 'indeciso', 'fuera_catalogo'])
  motivo!: 'objecion_precio' | 'indeciso' | 'fuera_catalogo';
  @IsString() @IsNotEmpty() contexto!: string;
}

export class FacturaDto {
  @IsString() @IsNotEmpty() contrato_id!: string;

  @Transform(({ value }) => normalizePhone(value))
  @IsOptional()
  @IsString()
  telefono?: string;
}

export class PagoEstadoDto {
  @IsString() @IsNotEmpty() contrato_id!: string;
}
