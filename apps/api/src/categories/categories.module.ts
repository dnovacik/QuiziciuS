import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
