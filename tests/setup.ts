// Env the modules under test read. Test values only; real secrets never belong here.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
