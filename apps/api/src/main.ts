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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
