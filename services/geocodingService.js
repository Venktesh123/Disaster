const axios = require("axios");
const CacheService = require("./cacheService");
const logger = require("../utils/logger");
const { generateCacheKey, isValidCoordinate } = require("../utils/helpers");

class GeocodingService {
  constructor() {
    this.googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  }

  async geocode(locationName) {
    const cacheKey = generateCacheKey("geocode", locationName);
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    let result = null;

    // Try Google Maps first
    if (this.googleMapsKey && !result) {
      result = await this.geocodeWithGoogle(locationName);
    }

    // Try Mapbox if Google fails
    if (this.mapboxToken && !result) {
      result = await this.geocodeWithMapbox(locationName);
    }

    // Try OpenStreetMap as fallback
    if (!result) {
      result = await this.geocodeWithOSM(locationName);
    }

    if (result) {
      await CacheService.set(cacheKey, result, 60);
      logger.info(`Geocoded: ${locationName} -> ${result.lat}, ${result.lng}`);
    }

    return result;
  }

  async geocodeWithGoogle(locationName) {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            address: locationName,
            key: this.googleMapsKey,
          },
          timeout: 5000,
        }
      );

      if (response.data.results?.[0]) {
        const location = response.data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng,
          formatted_address: response.data.results[0].formatted_address,
          source: "google",
        };
      }
    } catch (error) {
      logger.error("Google geocoding error:", error.message);
    }
    return null;
  }

  async geocodeWithMapbox(locationName) {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          locationName
        )}.json`,
        {
          params: {
            access_token: this.mapboxToken,
            limit: 1,
          },
          timeout: 5000,
        }
      );

      if (response.data.features?.[0]) {
        const [lng, lat] = response.data.features[0].center;
        return {
          lat,
          lng,
          formatted_address: response.data.features[0].place_name,
          source: "mapbox",
        };
      }
    } catch (error) {
      logger.error("Mapbox geocoding error:", error.message);
    }
    return null;
  }

  async geocodeWithOSM(locationName) {
    try {
      const response = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: locationName,
            format: "json",
            limit: 1,
          },
          headers: {
            "User-Agent": "DisasterResponseApp/1.0",
          },
          timeout: 5000,
        }
      );

      if (response.data?.[0]) {
        const result = response.data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        if (isValidCoordinate(lat, lng)) {
          return {
            lat,
            lng,
            formatted_address: result.display_name,
            source: "osm",
          };
        }
      }
    } catch (error) {
      logger.error("OSM geocoding error:", error.message);
    }
    return null;
  }
}

module.exports = new GeocodingService();
