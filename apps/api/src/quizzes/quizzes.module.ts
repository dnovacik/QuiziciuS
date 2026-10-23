import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PubsModule } from '../pubs/pubs.module';
import { QuizzesController } from './quizzes.controller';

@Module({
  imports: [AuthModule, PubsModule],
  controllers: [QuizzesController],
})
export class QuizzesModule {}
