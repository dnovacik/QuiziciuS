import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuizEngineModule } from '../quiz-engine/quiz-engine.module';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [AuthModule, QuizEngineModule],
  controllers: [SessionsController],
})
export class SessionsModule {}
