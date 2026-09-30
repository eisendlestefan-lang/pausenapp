import { createClient } from "@supabase/supabase-js";

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  adminEmail: import.meta.env.VITE_ADMIN_EMAIL,
  paypalPaymentLink: import.meta.env.VITE_PAYPAL_PAYMENT_LINK,
  bankIban: import.meta.env.VITE_BANK_IBAN,
  bankRecipient: import.meta.env.VITE_BANK_RECIPIENT,
};

if (!env.supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL fehlt.");
}

if (!env.supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY fehlt.");
}

export const supabase = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey
);
