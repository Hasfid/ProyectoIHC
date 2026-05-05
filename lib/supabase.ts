import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://lurpzudnafegijlteoym.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xrr8bYspSYSFmkH2V3IG3A_NJ4QAF7y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
