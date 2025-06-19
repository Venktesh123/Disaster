const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// More graceful error handling
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase configuration:");
  console.error("Required environment variables:");
  console.error("- SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
  console.error("- SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing");
  console.error("- SUPABASE_SERVICE_KEY:", supabaseServiceKey ? "✅ Set" : "⚠️ Optional");
  
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing required Supabase configuration");
  } else {
    console.warn("⚠️ Running without Supabase in development mode");
    // Create mock clients for development
    module.exports = {
      supabase: null,
      supabaseAdmin: null,
    };
    return;
  }
}

try {
  // Client for general operations
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Admin client for service operations
  const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase; // Fallback to regular client

  console.log("✅ Supabase configuration loaded successfully");

  module.exports = { supabase, supabaseAdmin };
} catch (error) {
  console.error("❌ Failed to create Supabase client:", error.message);
  throw new Error("Failed to initialize Supabase");
}