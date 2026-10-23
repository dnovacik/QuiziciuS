import { SupabaseService } from '../supabase/supabase.service';

interface MockResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

function fluentBuilder(result: MockResult): PromiseLike<MockResult> & Record<string, unknown> {
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    order: () => builder,
    delete: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (onResolve: (value: MockResult) => unknown) => Promise.resolve(result).then(onResolve),
  };
  return builder as PromiseLike<MockResult> & Record<string, unknown>;
}

/** `resultsByTable` keys are table names, or `rpc:<function>` for database functions. */
export function fakeSupabaseService(resultsByTable: Record<string, MockResult>): SupabaseService {
  return {
    getClient: () => ({
      from: (table: string) => fluentBuilder(resultsByTable[table]),
      rpc: (fn: string) => Promise.resolve(resultsByTable[`rpc:${fn}`]),
    }),
  } as unknown as SupabaseService;
}
