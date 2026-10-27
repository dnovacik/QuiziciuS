import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InvalidTransitionExceptionFilter } from './quiz-engine/invalid-transition.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new InvalidTransitionExceptionFilter());
  app.setGlobalPrefix('api');
  // HOST=127.0.0.1 keeps the API behind the server's nginx; unset, it listens on every interface.
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '0.0.0.0');
}
bootstrap();
