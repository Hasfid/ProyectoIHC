const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aygdawwqjpbemzonevqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2Rhd3dxanBiZW16b25ldnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mjc2NzksImV4cCI6MjA5NDIwMzY3OX0.S5gOJc8OQ05M8hOhLwexjMp74rTeemvWwBHYDMIn9b4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  const { data, error } = await supabase.storage.getBucket('registros_media');
  console.log("Bucket:", data ? data.name : "Not found", error ? error.message : "");
})();
