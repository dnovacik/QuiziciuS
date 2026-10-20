import { Module } from '@nestjs/common';
import { QuizEngineService } from './quiz-engine.service';

@Module({
  providers: [QuizEngineService],
  exports: [QuizEngineService],
})
export class QuizEngineModule {}
