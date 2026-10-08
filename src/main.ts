import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './interfaces/filters/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {

    // La firma del webhook requiere el cuerpo original, sin reserializar.
    rawBody: true,
    logger: process.env.NODE_ENV === 'production'
      ? ['log', 'warn', 'error']
      : ['log', 'warn', 'error', 'debug'],
  });

  app.use(helmet());

  app.useBodyParser('json', { limit: '256kb' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length) {
    app.enableCors({ origin: origins, credentials: false });
  }

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`hunter-apis listening on port ${port}`);
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error(`Startup failed: ${(error as Error).message}`);
  process.exit(1);
});
