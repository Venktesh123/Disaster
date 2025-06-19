const { supabase } = require("../config/supabase");
const logger = require("../utils/logger");

class CacheService {
  static async get(key) {
    try {
      const { data, error } = await supabase
        .from("cache")
        .select("value, expires_at")
        .eq("key", key)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) return null;

      // Check if expired
      if (new Date(data.expires_at) <= new Date()) {
        await this.delete(key);
        return null;
      }

      return data.value;
    } catch (error) {
      logger.error("Cache get error:", error);
      return null;
    }
  }

  static async set(key, value, ttlMinutes = 60) {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

      const { error } = await supabase.from("cache").upsert({
        key,
        value,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      logger.debug(`Cache set: ${key}`);
      return true;
    } catch (error) {
      logger.error("Cache set error:", error);
      return false;
    }
  }

  static async delete(key) {
    try {
      const { error } = await supabase.from("cache").delete().eq("key", key);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error("Cache delete error:", error);
      return false;
    }
  }

  static async clear() {
    try {
      const { error } = await supabase
        .from("cache")
        .delete()
        .lt("expires_at", new Date().toISOString());

      if (error) throw error;
      logger.info("Cache cleared of expired entries");
      return true;
    } catch (error) {
      logger.error("Cache clear error:", error);
      return false;
    }
  }
}

module.exports = CacheService;
