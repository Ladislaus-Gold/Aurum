import { supabase } from './supabase.js';
import { cclear } from './persist.js';

export const auth = $state({ session: null, ready: false });

supabase.auth.getSession().then(({ data }) => {
  auth.session = data.session;
  auth.ready = true;
});
supabase.auth.onAuthStateChange((_e, session) => {
  auth.session = session;
});

export function signInGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname }
  });
}
export const signOut = () => { cclear(); return supabase.auth.signOut(); };
