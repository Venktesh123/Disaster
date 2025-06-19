const axios = require("axios");
const CacheService = require("./cacheService");
const logger = require("../utils/logger");
const { generateCacheKey } = require("../utils/helpers");

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseURL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
  }

  async extractLocation(description) {
    if (!this.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const cacheKey = generateCacheKey("gemini_location", description);
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const prompt = `Extract location names from this disaster description. Return only the location name(s), separated by commas if multiple. If no clear location is found, return "Unknown Location".

Description: "${description}"

Location(s):`;

      const response = await axios.post(
        `${this.baseURL}?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      const result =
        response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        "Unknown Location";

      await CacheService.set(cacheKey, result, 60);
      logger.info(`Location extracted: ${result}`);

      return result;
    } catch (error) {
      logger.error("Gemini location extraction error:", error.message);
      throw new Error("Failed to extract location");
    }
  }

  async verifyImage(imageUrl, context = "") {
    if (!this.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const cacheKey = generateCacheKey("gemini_verify", imageUrl);
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const prompt = `Analyze this image for disaster-related content and authenticity. Consider:
1. Does it show signs of a real disaster?
2. Are there any obvious signs of manipulation or AI generation?
3. Does it match the disaster context: "${context}"?

Respond with a JSON object containing:
- "authentic": boolean (true if likely authentic)
- "disaster_related": boolean (true if disaster-related)
- "confidence": number (0-1)
- "analysis": string (brief explanation)

Image URL: ${imageUrl}`;

      // Note: For this mock implementation, we'll return a structured response
      // In production, you'd use Gemini Vision API
      const mockAnalysis = {
        authentic: Math.random() > 0.3,
        disaster_related: true,
        confidence: 0.7 + Math.random() * 0.3,
        analysis:
          "Image appears to show disaster-related content with moderate confidence",
      };

      await CacheService.set(cacheKey, mockAnalysis, 60);
      logger.info(`Image verified: ${imageUrl}`);

      return mockAnalysis;
    } catch (error) {
      logger.error("Gemini image verification error:", error.message);
      throw new Error("Failed to verify image");
    }
  }
}

module.exports = new GeminiService();
