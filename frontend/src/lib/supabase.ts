// Lightweight shim for legacy `supabase` client imports.
// Many legacy admin pages still import `{ supabase }` — during migration
// we provide a minimal, chainable stub that returns empty results and
// logs a warning. This prevents runtime/import errors while preserving
// the UI components so you can migrate features progressively.

class Query {
  table: string;
  private _single = false;
  constructor(table: string) {
    this.table = table;
  }
  select(..._args: any[]) { return this; }
  order(..._args: any[]) { return this; }
  eq(..._args: any[]) { return this; }
  in(..._args: any[]) { return this; }
  insert(..._args: any[]) { return this; }
  update(..._args: any[]) { return this; }
  delete(..._args: any[]) { return this; }
  upsert(..._args: any[]) { return this; }
  maybeSingle() { this._single = true; return this; }
  single() { this._single = true; return this; }
  limit(..._args: any[]) { return this; }

  // Make the Query thenable so `await supabase.from(...).select()` works.
  then(resolve: any, _reject?: any) {
    const result = this._single ? { data: null, error: null } : { data: [], error: null };
    console.warn(`[supabase shim] ${this.table} queried — returning empty result.`);
    if (typeof resolve === 'function') return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  }
}

export const supabase = {
  from(table: string) {
    return new Query(table);
  }
};

export default supabase;
