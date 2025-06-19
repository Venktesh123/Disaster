const express = require("express");
const { supabase } = require("../config/supabase");
const { authenticate, authorize } = require("../middleware/auth");
const { validate, disasterSchema } = require("../middleware/validation");
const geminiService = require("../services/geminiService");
const geocodingService = require("../services/geocodingService");
const logger = require("../utils/logger");

const router = express.Router();

// Get all disasters with optional filtering
router.get("/", async (req, res) => {
  try {
    const { tag, location, owner_id, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from("disasters")
      .select(
        `
        *,
        reports (count)
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (tag) {
      query = query.contains("tags", [tag]);
    }

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    if (location) {
      query = query.ilike("location_name", `%${location}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    logger.info(`Retrieved ${data.length} disasters`);

    res.json({
      success: true,
      data,
      meta: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    logger.error("Get disasters error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve disasters",
    });
  }
});

// Get single disaster
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("disasters")
      .select(
        `
        *,
        reports (*),
        resources (*)
      `
      )
      .eq("id", req.params.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          error: "Disaster not found",
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Get disaster error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve disaster",
    });
  }
});

// Create new disaster
router.post("/", authenticate, validate(disasterSchema), async (req, res) => {
  try {
    const { title, location_name, description, tags } = req.body;

    // Extract and enhance location with Gemini
    let enhancedLocationName = location_name;
    try {
      const geminiLocation = await geminiService.extractLocation(description);
      if (geminiLocation && geminiLocation !== "Unknown Location") {
        enhancedLocationName = geminiLocation;
      }
    } catch (geminiError) {
      logger.warn("Gemini location extraction failed:", geminiError.message);
    }

    // Geocode the location
    let locationPoint = null;
    try {
      const geocoded = await geocodingService.geocode(enhancedLocationName);
      if (geocoded) {
        locationPoint = `POINT(${geocoded.lng} ${geocoded.lat})`;
      }
    } catch (geocodeError) {
      logger.warn("Geocoding failed:", geocodeError.message);
    }

    // Create audit trail
    const auditTrail = [
      {
        action: "create",
        user_id: req.user.id,
        timestamp: new Date().toISOString(),
        details: "Disaster record created",
      },
    ];

    const { data, error } = await supabase
      .from("disasters")
      .insert({
        title,
        location_name: enhancedLocationName,
        location: locationPoint,
        description,
        tags: tags || [],
        owner_id: req.user.id,
        audit_trail: auditTrail,
      })
      .select()
      .single();

    if (error) throw error;

    // Emit real-time update
    req.io.emit("disaster_updated", {
      type: "create",
      data,
    });

    logger.info(`Disaster created: ${data.id} by ${req.user.id}`);

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Create disaster error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create disaster",
    });
  }
});

// Update disaster
router.put("/:id", authenticate, validate(disasterSchema), async (req, res) => {
  try {
    const { title, location_name, description, tags } = req.body;
    const disasterId = req.params.id;

    // Check if disaster exists and user has permission
    const { data: existing, error: fetchError } = await supabase
      .from("disasters")
      .select("*")
      .eq("id", disasterId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          error: "Disaster not found",
        });
      }
      throw fetchError;
    }

    // Check ownership or admin role
    if (existing.owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    // Geocode if location changed
    let locationPoint = existing.location;
    if (location_name !== existing.location_name) {
      try {
        const geocoded = await geocodingService.geocode(location_name);
        if (geocoded) {
          locationPoint = `POINT(${geocoded.lng} ${geocoded.lat})`;
        }
      } catch (geocodeError) {
        logger.warn("Geocoding failed during update:", geocodeError.message);
      }
    }

    // Update audit trail
    const auditTrail = [
      ...(existing.audit_trail || []),
      {
        action: "update",
        user_id: req.user.id,
        timestamp: new Date().toISOString(),
        details: "Disaster record updated",
      },
    ];

    const { data, error } = await supabase
      .from("disasters")
      .update({
        title,
        location_name,
        location: locationPoint,
        description,
        tags: tags || [],
        audit_trail: auditTrail,
      })
      .eq("id", disasterId)
      .select()
      .single();

    if (error) throw error;

    // Emit real-time update
    req.io.emit("disaster_updated", {
      type: "update",
      data,
    });

    logger.info(`Disaster updated: ${disasterId} by ${req.user.id}`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Update disaster error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update disaster",
    });
  }
});

// Delete disaster
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const disasterId = req.params.id;

    const { error } = await supabase
      .from("disasters")
      .delete()
      .eq("id", disasterId);

    if (error) throw error;

    // Emit real-time update
    req.io.emit("disaster_updated", {
      type: "delete",
      id: disasterId,
    });

    logger.info(`Disaster deleted: ${disasterId} by ${req.user.id}`);

    res.json({
      success: true,
      message: "Disaster deleted successfully",
    });
  } catch (error) {
    logger.error("Delete disaster error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete disaster",
    });
  }
});

module.exports = router;
