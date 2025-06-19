const express = require("express");
const { supabase } = require("../config/supabase");
const { authenticate } = require("../middleware/auth");
const { validate, resourceSchema } = require("../middleware/validation");
const geocodingService = require("../services/geocodingService");
const GeospatialService = require("../services/geospatialService");
const logger = require("../utils/logger");

const router = express.Router();

// Get resources for a disaster with geospatial filtering
router.get("/disaster/:id", async (req, res) => {
  try {
    const { lat, lng, radius = 10, type } = req.query;
    const disasterId = req.params.id;

    let query = supabase
      .from("resources")
      .select("*")
      .eq("disaster_id", disasterId);

    if (type) {
      query = query.eq("type", type);
    }

    const { data: resources, error } = await query;

    if (error) throw error;

    let filteredResources = resources;

    // Apply geospatial filtering if coordinates provided
    if (lat && lng) {
      filteredResources = await GeospatialService.findNearbyResources(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius),
        type
      );

      // Filter by disaster_id
      filteredResources = filteredResources.filter(
        (r) => r.disaster_id === disasterId
      );
    }

    logger.info(
      `Retrieved ${filteredResources.length} resources for disaster ${disasterId}`
    );

    res.json({
      success: true,
      data: filteredResources,
      meta: {
        disaster_id: disasterId,
        filters: { lat, lng, radius, type },
        count: filteredResources.length,
      },
    });
  } catch (error) {
    logger.error("Get resources error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve resources",
    });
  }
});

// Get nearby resources by coordinates
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 10, type } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: "Latitude and longitude are required",
      });
    }

    const resources = await GeospatialService.findNearbyResources(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius),
      type
    );

    res.json({
      success: true,
      data: resources,
      meta: {
        center: { lat: parseFloat(lat), lng: parseFloat(lng) },
        radius: parseFloat(radius),
        type,
        count: resources.length,
      },
    });
  } catch (error) {
    logger.error("Get nearby resources error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve nearby resources",
    });
  }
});

// Create new resource
router.post("/", authenticate, validate(resourceSchema), async (req, res) => {
  try {
    const { disaster_id, name, location_name, type } = req.body;

    // Verify disaster exists
    const { data: disaster, error: disasterError } = await supabase
      .from("disasters")
      .select("id")
      .eq("id", disaster_id)
      .single();

    if (disasterError || !disaster) {
      return res.status(404).json({
        success: false,
        error: "Disaster not found",
      });
    }

    // Geocode the resource location
    let locationPoint = null;
    try {
      const geocoded = await geocodingService.geocode(location_name);
      if (geocoded) {
        locationPoint = `POINT(${geocoded.lng} ${geocoded.lat})`;
      }
    } catch (geocodeError) {
      logger.warn("Resource geocoding failed:", geocodeError.message);
    }

    const { data, error } = await supabase
      .from("resources")
      .insert({
        disaster_id,
        name,
        location_name,
        location: locationPoint,
        type,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Emit real-time update
    req.io.emit("resources_updated", {
      type: "create",
      data,
    });

    logger.info(`Resource created: ${data.id} for disaster ${disaster_id}`);

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Create resource error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create resource",
    });
  }
});

// Update resource
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { name, location_name, type } = req.body;
    const resourceId = req.params.id;

    // Check if resource exists
    const { data: existing, error: fetchError } = await supabase
      .from("resources")
      .select("*")
      .eq("id", resourceId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: "Resource not found",
      });
    }

    // Check permission (creator or admin)
    if (existing.created_by !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    // Geocode if location changed
    let locationPoint = existing.location;
    if (location_name && location_name !== existing.location_name) {
      try {
        const geocoded = await geocodingService.geocode(location_name);
        if (geocoded) {
          locationPoint = `POINT(${geocoded.lng} ${geocoded.lat})`;
        }
      } catch (geocodeError) {
        logger.warn(
          "Resource geocoding failed during update:",
          geocodeError.message
        );
      }
    }

    const { data, error } = await supabase
      .from("resources")
      .update({
        name: name || existing.name,
        location_name: location_name || existing.location_name,
        location: locationPoint,
        type: type || existing.type,
      })
      .eq("id", resourceId)
      .select()
      .single();

    if (error) throw error;

    // Emit real-time update
    req.io.emit("resources_updated", {
      type: "update",
      data,
    });

    logger.info(`Resource updated: ${resourceId} by ${req.user.id}`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Update resource error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update resource",
    });
  }
});

// Delete resource
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const resourceId = req.params.id;

    // Check if resource exists and user has permission
    const { data: existing, error: fetchError } = await supabase
      .from("resources")
      .select("*")
      .eq("id", resourceId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: "Resource not found",
      });
    }

    if (existing.created_by !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", resourceId);

    if (error) throw error;

    // Emit real-time update
    req.io.emit("resources_updated", {
      type: "delete",
      id: resourceId,
    });

    logger.info(`Resource deleted: ${resourceId} by ${req.user.id}`);

    res.json({
      success: true,
      message: "Resource deleted successfully",
    });
  } catch (error) {
    logger.error("Delete resource error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete resource",
    });
  }
});

module.exports = router;
