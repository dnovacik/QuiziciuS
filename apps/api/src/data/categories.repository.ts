import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CategoryRecord {
  id: string;
  name: string;
}

export abstract class CategoriesRepository {
  abstract list(): Promise<CategoryRecord[]>;
}

@Injectable()
export class SupabaseCategoriesRepository extends CategoriesRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async list(): Promise<CategoryRecord[]> {
    const { data, error } = await this.supabase.getClient().from('categories').select('id, name').order('name');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as CategoryRecord[];
  }
}
