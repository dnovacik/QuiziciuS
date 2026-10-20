import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CategoriesRepository } from '../data/categories.repository';

@Controller('categories')
@UseGuards(SupabaseAuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesRepository) {}

  @Get()
  list() {
    return this.categories.list();
  }
}
