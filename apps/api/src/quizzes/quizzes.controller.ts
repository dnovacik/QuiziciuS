import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuizzesRepository } from '../data/quizzes.repository';
import { CreateQuizDto } from './dto/create-quiz.dto';

@Controller('quizzes')
@UseGuards(SupabaseAuthGuard)
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesRepository) {}

  @Post()
  create(@CurrentHost() host: CurrentHostPayload, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(host.id, dto.title);
  }

  @Get()
  list(@CurrentHost() host: CurrentHostPayload) {
    return this.quizzes.listByHost(host.id);
  }
}
