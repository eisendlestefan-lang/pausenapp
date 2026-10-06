import { createClient } from "@supabase/supabase-js";

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  adminEmail: import.meta.env.VITE_ADMIN_EMAIL || "",
  paypalPaymentLink: import.meta.env.VITE_PAYPAL_PAYMENT_LINK || "",
  bankIban: import.meta.env.VITE_BANK_IBAN || "",
  bankRecipient: import.meta.env.VITE_BANK_RECIPIENT || "",
  emailFunctionName: import.meta.env.VITE_EMAIL_FUNCTION_NAME || "email-versand",
};

export const isSupabaseConfigured =
  Boolean(env.supabaseUrl) &&
  Boolean(env.supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(
      env.supabaseUrl,
      env.supabaseAnonKey
    )
  : null;
