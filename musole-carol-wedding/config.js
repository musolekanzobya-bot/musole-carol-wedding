/* =========================================================
   M & C WEDDING
   SUPABASE CONFIGURATION
   ========================================================= */

"use strict";

const SUPABASE_URL =
    "https://ziwjpvcqtravnefcujrc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_FB6qTF8Iw8KiNYKQuaf9TA_loRJ29J7";

if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
) {
    console.error(
        "M & C Wedding: Supabase browser library failed to load."
    );

    window.supabaseClient = null;

} else {

    window.supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

    window.SUPABASE_URL =
        SUPABASE_URL;

    window.SUPABASE_PUBLISHABLE_KEY =
        SUPABASE_PUBLISHABLE_KEY;

    console.log(
        "M & C Wedding: Supabase configured successfully."
    );
}