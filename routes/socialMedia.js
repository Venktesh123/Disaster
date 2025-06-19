const express = require("express");
const socialMediaService = require("../services/socialMediaService");
const logger = require("../utils/logger");

const router = express.Router();

// Get social media posts for a disaster
router.get("/disaster/:id", async (req, res) => {
  try {
    const { keywords, location } = req.query;
    const disasterId = req.params.id;

    // Parse keywords if provided
    const keywordArray = keywords
      ? keywords.split(",").map((k) => k.trim())
      : ["disaster", "emergency", "help"];

    const posts = await socialMediaService.searchDisasterPosts(
      keywordArray,
      location
    );

    // Emit real-time update
    req.io.emit("social_media_updated", {
      disaster_id: disasterId,
      posts: posts.slice(0, 5), // Send only recent posts via socket
    });

    logger.info(
      `Retrieved ${posts.length} social media posts for disaster ${disasterId}`
    );

    res.json({
      success: true,
      data: posts,
      meta: {
        disaster_id: disasterId,
        keywords: keywordArray,
        location,
        count: posts.length,
        urgent_count: posts.filter((p) => p.priority === "urgent").length,
      },
    });
  } catch (error) {
    logger.error("Get social media posts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve social media posts",
    });
  }
});

// General social media search
router.get("/search", async (req, res) => {
  try {
    const { keywords, location } = req.query;

    if (!keywords) {
      return res.status(400).json({
        success: false,
        error: "Keywords parameter is required",
      });
    }

    const keywordArray = keywords.split(",").map((k) => k.trim());
    const posts = await socialMediaService.searchDisasterPosts(
      keywordArray,
      location
    );

    res.json({
      success: true,
      data: posts,
      meta: {
        keywords: keywordArray,
        location,
        count: posts.length,
        priority_breakdown: {
          urgent: posts.filter((p) => p.priority === "urgent").length,
          high: posts.filter((p) => p.priority === "high").length,
          medium: posts.filter((p) => p.priority === "medium").length,
        },
      },
    });
  } catch (error) {
    logger.error("Social media search error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search social media",
    });
  }
});

module.exports = router;
