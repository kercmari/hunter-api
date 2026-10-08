import { IsEmail, IsIn, IsString, Length, Matches } from 'class-validator';

export class CreateContractCommand {

  @IsIn(['sale', 'renewal'], { message: 'type must be either sale or renewal' })
  readonly type!: string;

  readonly vehicle?: unknown;

  @IsString()
  @Length(5, 30)
  @Matches(/^[0-9A-Za-z-]+$/, { message: 'taxId accepts letters, digits and hyphens only' })
  readonly taxId!: string;

  @IsString()
  @Length(3, 20)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'productCode is not valid' })
  readonly productCode!: string;

  @IsString()
  @Length(3, 200)
  readonly fullName!: string;

  @IsEmail({}, { message: 'email is not valid' })
  @Length(5, 254)
  readonly email!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format (+5939…)' })
  readonly phone!: string;
}
