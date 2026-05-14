const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aygdawwqjpbemzonevqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2Rhd3dxanBiZW16b25ldnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mjc2NzksImV4cCI6MjA5NDIwMzY3OX0.S5gOJc8OQ05M8hOhLwexjMp74rTeemvWwBHYDMIn9b4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  // Test notificaciones
  const { data: n, error: ne } = await supabase.from('notificaciones').select('*').limit(1);
  console.log("Notificaciones table:", ne ? ne.message : "Exists!");

  // Test registros columns
  const { data: r, error: re } = await supabase.from('registros').select('*').limit(1);
  console.log("Registros table:", re ? re.message : "Exists!");
  if (r && r.length > 0) {
    console.log("Registros columns:", Object.keys(r[0]));
  } else {
    // try to trigger a column error
    const { error: ce } = await supabase.from('registros').select('ia_certeza, metadatos_especie').limit(1);
    console.log("Registros columns check:", ce ? ce.message : "Columns exist!");
  }
})();
