import { Controller, Get } from '@nestjs/common';
import { RequireRole } from '../auth/require-role';
import { CategoriesRepository } from '../data/categories.repository';

@Controller('categories')
@RequireRole('HOST')
export class CategoriesController {
  constructor(private readonly categories: CategoriesRepository) {}

  @Get()
  list() {
    return this.categories.list();
  }
}
