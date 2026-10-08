import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateTicketCommand {

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format (+5939…)' })
  readonly phone!: string;

  @IsString()
  @Length(3, 200)
  readonly reason!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  readonly context?: string;
}
