import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { SupabaseModule } from './supabase/supabase.module';
import { DataModule } from './data/data.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TeamsModule } from './teams/teams.module';
import { AnswersModule } from './answers/answers.module';
import { InfractionsModule } from './infractions/infractions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
    DataModule,
    RealtimeModule,
    TeamsModule,
    AnswersModule,
    InfractionsModule,
  ],
})
export class AppModule {}
