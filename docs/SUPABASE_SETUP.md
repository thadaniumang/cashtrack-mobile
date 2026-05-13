# Supabase Setup (cashtrack-native)

This project expects the same Supabase backend used by the `cashback-companion` web app.

Env variables
- Provide these in your environment or in an `.env` file for local dev (see `.env.example`):

  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

How web app config maps
- The web app uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (see `cashback-companion/src/integrations/supabase/client.ts`).
- For RN we use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `src/lib/supabase.ts`).

Runtime notes
- `src/lib/supabase.ts` configures the Supabase client with `AsyncStorage` for session persistence.
- If you plan to run integration tests or the app locally, ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are present in your environment; otherwise calls will hit a placeholder client and throw.

Security
- Do not commit `.env` with real keys. Use CI secrets or local `.env` kept out of source control.
