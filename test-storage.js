const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aygdawwqjpbemzonevqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2Rhd3dxanBiZW16b25ldnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mjc2NzksImV4cCI6MjA5NDIwMzY3OX0.S5gOJc8OQ05M8hOhLwexjMp74rTeemvWwBHYDMIn9b4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  // 1. Check if bucket exists
  const { data: bucket, error: bucketErr } = await supabase.storage.getBucket('registros_media');
  console.log("Bucket check:", bucketErr ? bucketErr.message : "Exists!");

  // 2. Try to upload anonymously
  const blob = new Blob(["dummy content"], { type: 'text/plain' });
  const fileName = `test_${Date.now()}.txt`;
  console.log(`Trying anonymous upload to registros_media/${fileName}...`);
  const { error: anonUploadErr } = await supabase.storage.from('registros_media').upload(fileName, blob);
  console.log("Anon Upload error:", anonUploadErr ? anonUploadErr.message : "Success!");

  // 3. Login and try authenticated upload
  const email = `test_${Date.now()}@example.com`;
  await supabase.auth.signUp({ email, password: 'password123' });
  console.log(`Trying authenticated upload...`);
  const { error: authUploadErr } = await supabase.storage.from('registros_media').upload(fileName, blob);
  console.log("Auth Upload error:", authUploadErr ? authUploadErr.message : "Success!");

})();
