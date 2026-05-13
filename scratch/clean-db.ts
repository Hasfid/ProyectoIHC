import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://lurpzudnafegijlteoym.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'sb_publishable_xrr8bYspSYSFmkH2V3IG3A_NJ4QAF7y';

async function cleanRecords() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('--- Iniciando limpieza de registros ---');
  
  // En Supabase, para borrar todo sin WHERE, usamos eq con algo que no existe o neq con algo imposible
  const { error, count } = await supabase
    .from('registros')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); 
    
  if (error) {
    console.error('Error al borrar:', error);
  } else {
    console.log(`¡Éxito! Se eliminaron ${count} registros.`);
  }
}

cleanRecords();
