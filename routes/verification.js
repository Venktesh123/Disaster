const express = require("express");
const { supabase } = require("../config/supabase");
const { authenticate } = require("../middleware/auth");
const geminiService = require("../services/geminiService");
const logger = require("../utils/logger");

const router = express.Router();

// Verify image for a disaster report
router.post("/disaster/:id/image", authenticate, async (req, res) => {
  try {
    const { image_url, report_id } = req.body;
    const disasterId = req.params.id;

    if (!image_url) {
      return res.status(400).json({
        success: false,
        error: "Image URL is required",
      });
    }

    // Get disaster context for verification
    const { data: disaster, error: disasterError } = await supabase
      .from("disasters")
      .select("title, description, location_name")
      .eq("id", disasterId)
      .single();

    if (disasterError || !disaster) {
      return res.status(404).json({
        success: false,
        error: "Disaster not found",
      });
    }

    // Verify image using Gemini
    const context = `${disaster.title} - ${disaster.description} in ${disaster.location_name}`;
    const verification = await geminiService.verifyImage(image_url, context);

    // Update report if report_id provided
    if (report_id) {
      const { error: updateError } = await supabase
        .from("reports")
        .update({
          verification_status: verification.authentic ? "verified" : "flagged",
          verification_details: verification,
        })
        .eq("id", report_id)
        .eq("disaster_id", disasterId);

      if (updateError) {
        logger.error("Failed to update report verification:", updateError);
      }
    }

    logger.info(
      `Image verified for disaster ${disasterId}: ${
        verification.authentic ? "authentic" : "flagged"
      }`
    );

    res.json({
      success: true,
      data: {
        disaster_id: disasterId,
        report_id,
        image_url,
        verification,
        status: verification.authentic ? "verified" : "flagged",
      },
    });
  } catch (error) {
    logger.error("Image verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify image",
    });
  }
});

// Batch verify multiple images
router.post("/batch", authenticate, async (req, res) => {
  try {
    const { images } = req.body; // Array of { image_url, disaster_id, report_id }

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({
        success: false,
        error: "Images array is required",
      });
    }

    const results = [];

    for (const imageData of images) {
      try {
        const { image_url, disaster_id, report_id } = imageData;

        // Get disaster context
        const { data: disaster } = await supabase
          .from("disasters")
          .select("title, description, location_name")
          .eq("id", disaster_id)
          .single();

        if (disaster) {
          const context = `${disaster.title} - ${disaster.description} in ${disaster.location_name}`;
          const verification = await geminiService.verifyImage(
            image_url,
            context
          );

          results.push({
            image_url,
            disaster_id,
            report_id,
            verification,
            status: verification.authentic ? "verified" : "flagged",
          });

          // Update report if report_id provided
          if (report_id) {
            await supabase
              .from("reports")
              .update({
                verification_status: verification.authentic
                  ? "verified"
                  : "flagged",
                verification_details: verification,
              })
              .eq("id", report_id);
          }
        }
      } catch (imageError) {
        logger.error("Individual image verification failed:", imageError);
        results.push({
          image_url: imageData.image_url,
          disaster_id: imageData.disaster_id,
          report_id: imageData.report_id,
          verification: null,
          status: "error",
          error: imageError.message,
        });
      }
    }

    logger.info(
      `Batch verification completed: ${results.length} images processed`
    );

    res.json({
      success: true,
      data: results,
      meta: {
        total: results.length,
        verified: results.filter((r) => r.status === "verified").length,
        flagged: results.filter((r) => r.status === "flagged").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    });
  } catch (error) {
    logger.error("Batch verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process batch verification",
    });
  }
});

module.exports = router;
