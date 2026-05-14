const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aygdawwqjpbemzonevqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2Rhd3dxanBiZW16b25ldnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mjc2NzksImV4cCI6MjA5NDIwMzY3OX0.S5gOJc8OQ05M8hOhLwexjMp74rTeemvWwBHYDMIn9b4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  // 1. Sign up a dummy user
  const email = `test_${Date.now()}@example.com`;
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password: 'password123'
  });

  if (authErr) {
    console.log("Auth Error:", authErr.message);
    return;
  }
  console.log("Logged in as:", authData.user.id);

  // 2. Try inserting a record
  const { error: insertErr } = await supabase.from('registros').insert({
    usuario_id: authData.user.id,
    nombre_tradicional: 'Test',
    media_url: 'test.jpg',
    tipo_media: 'imagen',
    latitud: 0,
    longitud: 0
  });
  console.log("Registros Insert result:", insertErr ? insertErr.message : "Success!");

  // 3. Try uploading a file
  const blob = new Blob(["dummy content"], { type: 'text/plain' });
  const { error: uploadErr } = await supabase.storage.from('registros_media').upload('test.txt', blob);
  console.log("Storage Upload result:", uploadErr ? uploadErr.message : "Success!");
})();
