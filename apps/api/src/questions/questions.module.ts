import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionsController } from './questions.controller';
import { SessionQuestionMediaController } from './session-question-media.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuestionsController, SessionQuestionMediaController],
})
export class QuestionsModule {}
