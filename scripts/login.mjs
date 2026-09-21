// Usage: node scripts/login.mjs <email> <password>
// Env vars (optional, default to local Supabase):
//   SUPABASE_URL       (default: http://127.0.0.1:54321)
//   SUPABASE_ANON_KEY  (required)

import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/login.mjs <email> <password>');
  process.exit(1);
}

const supabaseUrl = 'https://rlquskwewjdpxggjrwum.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscXVza3dld2pkcHhnZ2pyd3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NDE0NDIsImV4cCI6MjEwNTAxNzQ0Mn0.g_bJeB3cDQcLGkQo4leoB0tuHzAOyHoNIeMEbViFrXQ';

if (!supabaseAnonKey) {
  console.error('Missing SUPABASE_ANON_KEY env var.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const loginUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
console.error('POST', loginUrl);
console.error('Headers: { "apikey": "<SUPABASE_ANON_KEY>", "Content-Type": "application/json" }');
console.error('Body:', JSON.stringify({ email, password }));

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.error('Login failed:', error.message);
  process.exit(1);
}

console.log(data.session.access_token);
