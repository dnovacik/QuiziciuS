import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuestionsRepository } from '../data/questions.repository';
import { QuizzesRepository } from '../data/quizzes.repository';
import { CreateQuestionDto } from './dto/create-question.dto';

@Controller('quizzes/:quizId/questions')
@UseGuards(SupabaseAuthGuard)
export class QuestionsController {
  constructor(
    private readonly quizzes: QuizzesRepository,
    private readonly questions: QuestionsRepository,
  ) {}

  @Post()
  async create(
    @Param('quizId') quizId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: CreateQuestionDto,
  ) {
    await this.requireOwnedQuiz(quizId, host.id);
    return this.questions.create(quizId, {
      type: dto.type,
      prompt: dto.prompt,
      options: dto.options ?? null,
      accepted_answers: dto.acceptedAnswers ?? null,
      correct_numeric: dto.correctNumeric ?? null,
      points: dto.points ?? 1,
      time_limit_seconds: dto.timeLimitSeconds ?? 30,
      order_index: dto.orderIndex,
    });
  }

  @Get()
  async list(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload) {
    await this.requireOwnedQuiz(quizId, host.id);
    return this.questions.listByQuiz(quizId);
  }


  @Patch(':questionId')
  async update(@Param('quizId') quizId:string,@Param('questionId') questionId:string,@CurrentHost() host:CurrentHostPayload,@Body() dto:CreateQuestionDto){
    await this.requireOwnedQuiz(quizId,host.id);
    const updated=await this.questions.update(quizId,questionId,{
      type:dto.type,prompt:dto.prompt,options:dto.options??null,accepted_answers:dto.acceptedAnswers??null,
      correct_numeric:dto.correctNumeric??null,points:dto.points??1,time_limit_seconds:dto.timeLimitSeconds??30,order_index:dto.orderIndex,
    });
    if(!updated)throw new NotFoundException('Question not found');
    return updated;
  }
  @Delete(':questionId')
  async remove(@Param('quizId') quizId:string,@Param('questionId') questionId:string,@CurrentHost() host:CurrentHostPayload){
    await this.requireOwnedQuiz(quizId,host.id);
    if(!await this.questions.remove(quizId,questionId))throw new NotFoundException('Question not found');
    return {deleted:true};
  }
  private async requireOwnedQuiz(quizId: string, hostId: string): Promise<void> {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== hostId) throw new ForbiddenException('Not your quiz');
  }
}
