const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aygdawwqjpbemzonevqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2Rhd3dxanBiZW16b25ldnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mjc2NzksImV4cCI6MjA5NDIwMzY3OX0.S5gOJc8OQ05M8hOhLwexjMp74rTeemvWwBHYDMIn9b4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  // Test 1: Check bucket
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  console.log("Buckets Error:", bucketError?.message || "No error");
  console.log("Buckets:", buckets?.map(b => b.name));

  // Test 2: Try to insert dummy record (we don't have a userId, so we'll see what the error is)
  const { error: insertError } = await supabase.from('registros').insert({
    nombre_tradicional: 'Test',
  });
  console.log("Insert Error:", insertError?.message || "No error");
})();
