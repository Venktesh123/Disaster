const express = require("express");
const { supabase } = require("../config/supabase");
const { authenticate } = require("../middleware/auth");
const { validate, reportSchema } = require("../middleware/validation");
const browsePageService = require("../services/browsePageService");
const logger = require("../utils/logger");

const router = express.Router();

// Get reports for a disaster
router.get("/disaster/:id", async (req, res) => {
  try {
    const { verification_status, limit = 50, offset = 0 } = req.query;
    const disasterId = req.params.id;

    let query = supabase
      .from("reports")
      .select("*")
      .eq("disaster_id", disasterId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (verification_status) {
      query = query.eq("verification_status", verification_status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
      meta: {
        disaster_id: disasterId,
        count: data.length,
        filters: { verification_status },
      },
    });
  } catch (error) {
    logger.error("Get reports error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve reports",
    });
  }
});

// Get official updates for a disaster
router.get("/disaster/:id/official-updates", async (req, res) => {
  try {
    const disasterId = req.params.id;

    const updates = await browsePageService.getOfficialUpdates(disasterId);

    res.json({
      success: true,
      data: updates,
      meta: {
        disaster_id: disasterId,
        count: updates.length,
        sources: [...new Set(updates.map((u) => u.source))],
      },
    });
  } catch (error) {
    logger.error("Get official updates error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve official updates",
    });
  }
});

// Create new report
router.post("/", authenticate, validate(reportSchema), async (req, res) => {
  try {
    const { disaster_id, content, image_url } = req.body;

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

    const { data, error } = await supabase
      .from("reports")
      .insert({
        disaster_id,
        user_id: req.user.id,
        content,
        image_url,
        verification_status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Report created: ${data.id} for disaster ${disaster_id}`);

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Create report error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create report",
    });
  }
});

// Update report
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { content, image_url, verification_status } = req.body;
    const reportId = req.params.id;

    // Check if report exists and user has permission
    const { data: existing, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    if (existing.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    // Only admins can update verification status
    const updateData = {
      content: content || existing.content,
      image_url: image_url !== undefined ? image_url : existing.image_url,
    };

    if (req.user.role === "admin" && verification_status) {
      updateData.verification_status = verification_status;
    }

    const { data, error } = await supabase
      .from("reports")
      .update(updateData)
      .eq("id", reportId)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Report updated: ${reportId} by ${req.user.id}`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Update report error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update report",
    });
  }
});

// Delete report
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const reportId = req.params.id;

    // Check if report exists and user has permission
    const { data: existing, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    if (existing.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("id", reportId);

    if (error) throw error;

    logger.info(`Report deleted: ${reportId} by ${req.user.id}`);

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    logger.error("Delete report error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete report",
    });
  }
});

module.exports = router;
