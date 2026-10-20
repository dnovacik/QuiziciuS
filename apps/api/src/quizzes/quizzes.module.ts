import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuizzesController } from './quizzes.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuizzesController],
})
export class QuizzesModule {}
