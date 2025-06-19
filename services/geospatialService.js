const { supabase } = require("../config/supabase");
const logger = require("../utils/logger");

class GeospatialService {
  static async findNearbyResources(lat, lng, radiusKm = 10, type = null) {
    try {
      let query = supabase
        .from("resources")
        .select(
          `
          *,
          disasters (
            id,
            title,
            location_name
          )
        `
        )
        .not("location", "is", null);

      // Add type filter if specified
      if (type) {
        query = query.eq("type", type);
      }

      const { data: allResources, error } = await query;

      if (error) throw error;

      // Filter by distance (since we can't use PostGIS functions easily)
      const nearbyResources = allResources.filter((resource) => {
        if (!resource.location) return false;

        // Parse the location (assuming it's stored as POINT format)
        const locationMatch = resource.location.match(/POINT\(([^)]+)\)/);
        if (!locationMatch) return false;

        const [resourceLng, resourceLat] = locationMatch[1]
          .split(" ")
          .map(parseFloat);
        const distance = this.calculateDistance(
          lat,
          lng,
          resourceLat,
          resourceLng
        );

        resource.distance = distance;
        return distance <= radiusKm;
      });

      // Sort by distance
      nearbyResources.sort((a, b) => a.distance - b.distance);

      logger.info(
        `Found ${nearbyResources.length} resources within ${radiusKm}km`
      );
      return nearbyResources;
    } catch (error) {
      logger.error("Geospatial query error:", error);
      throw error;
    }
  }

  static async findDisastersInArea(lat, lng, radiusKm = 50) {
    try {
      const { data, error } = await supabase
        .from("disasters")
        .select("*")
        .not("location", "is", null);

      if (error) throw error;

      // Filter by distance
      const nearbyDisasters = data.filter((disaster) => {
        if (!disaster.location) return false;

        const locationMatch = disaster.location.match(/POINT\(([^)]+)\)/);
        if (!locationMatch) return false;

        const [disasterLng, disasterLat] = locationMatch[1]
          .split(" ")
          .map(parseFloat);
        const distance = this.calculateDistance(
          lat,
          lng,
          disasterLat,
          disasterLng
        );

        disaster.distance = distance;
        return distance <= radiusKm;
      });

      nearbyDisasters.sort((a, b) => a.distance - b.distance);

      return nearbyDisasters;
    } catch (error) {
      logger.error("Geospatial disaster query error:", error);
      throw error;
    }
  }

  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = GeospatialService;
