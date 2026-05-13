const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lurpzudnafegijlteoym.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_xrr8bYspSYSFmkH2V3IG3A_NJ4QAF7y';

async function checkPublicaciones() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('--- Verificando tabla "publicaciones" ---');
  
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*');
    
  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Se encontraron ${data.length} publicaciones.`);
  
  if (data.length > 0) {
    console.log('Intentando borrar publicaciones...');
    const { count } = await supabase
      .from('publicaciones')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    console.log(`Se eliminaron ${count} publicaciones.`);
  }
}

checkPublicaciones();
