import { SupabaseService } from '../supabase/supabase.service';

interface MockResult {
  data: unknown;
  error: { message: string } | null;
}

function fluentBuilder(result: MockResult): PromiseLike<MockResult> & Record<string, unknown> {
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => Promise.resolve(result),
    then: (onResolve: (value: MockResult) => unknown) => Promise.resolve(result).then(onResolve),
  };
  return builder as PromiseLike<MockResult> & Record<string, unknown>;
}

export function fakeSupabaseService(resultsByTable: Record<string, MockResult>): SupabaseService {
  return {
    getClient: () => ({
      from: (table: string) => fluentBuilder(resultsByTable[table]),
    }),
  } as unknown as SupabaseService;
}
