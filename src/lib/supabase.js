import { createClient } from '@supabase/supabase-js';

// Публичные параметры (publishable key рассчитан на браузер; доступ закрыт RLS)
const URL = 'https://ozgorwowudjhyvdncilu.supabase.co';
const KEY = 'sb_publishable__m_20U0l39X58kjoO9RjFw_fTEIu36-';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
