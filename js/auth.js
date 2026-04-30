import { createSupabaseClient } from "./supabaseClient.js";

export async function getCurrentUser() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) return null;
  return data.user;
}

export async function signUp(email, password) {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = createSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

export function onAuthChange(callback) {
  const supabase = createSupabaseClient();

  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}
