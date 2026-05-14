const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aygdawwqjpbemzonevqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2Rhd3dxanBiZW16b25ldnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mjc2NzksImV4cCI6MjA5NDIwMzY3OX0.S5gOJc8OQ05M8hOhLwexjMp74rTeemvWwBHYDMIn9b4';
// Use the service role key if possible? No, we don't have it.
// We can just use the anon key to query postgresql REST endpoint for policies?
// Actually, anon users can't query pg_policies.
// But we can check if inserting with anon auth fails.

(async () => {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Try to sign in anonymously
  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr) {
    console.log("Anon Auth Error:", authErr.message);
    return;
  }
  console.log("Logged in anonymously as:", authData.user.id);

  // Try to insert a record
  const { error: insertErr } = await supabase.from('registros').insert({
    usuario_id: authData.user.id,
    nombre_tradicional: 'Test',
    media_url: 'test.jpg',
    tipo_media: 'imagen',
    latitud: 0,
    longitud: 0
  });
  
  console.log("Insert result:", insertErr ? insertErr.message : "Success!");
})();
