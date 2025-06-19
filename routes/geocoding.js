const express = require("express");
const geminiService = require("../services/geminiService");
const geocodingService = require("../services/geocodingService");
const logger = require("../utils/logger");

const router = express.Router();

// Extract location from text and geocode
router.post("/", async (req, res) => {
  try {
    const { text, location_name } = req.body;

    if (!text && !location_name) {
      return res.status(400).json({
        success: false,
        error: "Either text or location_name is required",
      });
    }

    let locationToGeocode = location_name;
    let extractedLocation = null;

    // Extract location from text using Gemini if text provided
    if (text) {
      try {
        extractedLocation = await geminiService.extractLocation(text);
        if (extractedLocation && extractedLocation !== "Unknown Location") {
          locationToGeocode = extractedLocation;
        }
      } catch (geminiError) {
        logger.warn("Gemini extraction failed:", geminiError.message);
        if (!location_name) {
          return res.status(500).json({
            success: false,
            error: "Failed to extract location from text",
          });
        }
      }
    }

    // Geocode the location
    let geocoded = null;
    if (locationToGeocode) {
      try {
        geocoded = await geocodingService.geocode(locationToGeocode);
      } catch (geocodeError) {
        logger.warn("Geocoding failed:", geocodeError.message);
      }
    }

    logger.info(
      `Geocoding request: ${text || location_name} -> ${
        geocoded ? `${geocoded.lat}, ${geocoded.lng}` : "failed"
      }`
    );

    res.json({
      success: true,
      data: {
        input_text: text,
        input_location: location_name,
        extracted_location: extractedLocation,
        final_location: locationToGeocode,
        geocoded: geocoded,
        coordinates: geocoded
          ? {
              lat: geocoded.lat,
              lng: geocoded.lng,
              formatted_address: geocoded.formatted_address,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error("Geocoding error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process geocoding request",
    });
  }
});

module.exports = router;
