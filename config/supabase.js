let createClient;
try {
  ({ createClient } = require("@supabase/supabase-js"));
} catch (error) {
  console.warn("Supabase client not available:", error.message);
  // Create mock client
  const mockClient = {
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
      single: () => ({ data: null, error: null }),
      eq: () => ({ data: [], error: null }),
      order: () => ({ data: [], error: null }),
      range: () => ({ data: [], error: null }),
    }),
  };

  module.exports = {
    supabase: mockClient,
    supabaseAdmin: mockClient,
  };
  return;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// More graceful error handling
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase configuration:");
  console.error("Required environment variables:");
  console.error("- SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
  console.error(
    "- SUPABASE_ANON_KEY:",
    supabaseAnonKey ? "✅ Set" : "❌ Missing"
  );
  console.error(
    "- SUPABASE_SERVICE_KEY:",
    supabaseServiceKey ? "✅ Set" : "⚠️ Optional"
  );

  // Create mock clients for development/when Supabase is not configured
  const mockClient = {
    from: (table) => ({
      select: (columns = "*") => ({
        data: [],
        error: null,
        eq: () => ({ data: [], error: null }),
        order: () => ({ data: [], error: null }),
        range: () => ({ data: [], error: null }),
        single: () => ({
          data: null,
          error: { code: "PGRST116", message: "Mock: No data found" },
        }),
        contains: () => ({ data: [], error: null }),
        ilike: () => ({ data: [], error: null }),
        not: () => ({ data: [], error: null }),
        lt: () => ({ data: [], error: null }),
      }),
      insert: (data) => ({
        data: {
          id: Date.now().toString(),
          ...data,
          created_at: new Date().toISOString(),
        },
        error: null,
        select: () => ({
          data: {
            id: Date.now().toString(),
            ...data,
            created_at: new Date().toISOString(),
          },
          error: null,
          single: () => ({
            data: {
              id: Date.now().toString(),
              ...data,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
      update: (data) => ({
        data: { ...data, updated_at: new Date().toISOString() },
        error: null,
        eq: () => ({
          data: { ...data, updated_at: new Date().toISOString() },
          error: null,
          select: () => ({
            data: { ...data, updated_at: new Date().toISOString() },
            error: null,
            single: () => ({
              data: { ...data, updated_at: new Date().toISOString() },
              error: null,
            }),
          }),
        }),
      }),
      delete: () => ({
        data: null,
        error: null,
        eq: () => ({ data: null, error: null }),
      }),
      upsert: (data) => ({
        data: { id: Date.now().toString(), ...data },
        error: null,
      }),
    }),
  };

  console.warn(
    "⚠️ Using mock Supabase client - database operations will be simulated"
  );

  module.exports = {
    supabase: mockClient,
    supabaseAdmin: mockClient,
  };
  return;
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

  // Still provide mock clients to prevent crashes
  const mockClient = {
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  };

  module.exports = {
    supabase: mockClient,
    supabaseAdmin: mockClient,
  };
}
