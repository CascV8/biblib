// Biblib settings. Accounts turn on when both Supabase values are filled in.
// The anon key is meant to be public: row-level security in supabase/schema.sql
// is what keeps each user's projects private. Never put the service_role key here.
window.BIBLIB_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
