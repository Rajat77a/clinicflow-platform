import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:54321',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnb3BkZXhhaXFxZW5qem1vdmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODg0OTM2NjEsImV4cCI6MTk5MjI4NTA5OH0.wK--0x4_R7Q_vI5q_1F1C'
); // fake anon key, it might not work

async function run() {
  const { data, error } = await supabase.rpc('list_current_staff');
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if (data) {
    const invites = data.filter(d => d.status === 'Invited' || d.status === 'Inactive' || d.status === 'Expired');
    console.log("Invites:", invites.length);
    console.log(invites);
  }
}
run();
