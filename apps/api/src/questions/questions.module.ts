import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionsController } from './questions.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuestionsController],
})
export class QuestionsModule {}
