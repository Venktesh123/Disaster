// ================ services/browsePageService.js ================
const axios = require("axios");
const cheerio = require("cheerio");
const CacheService = require("./cacheService");
const logger = require("../utils/logger");
const { generateCacheKey } = require("../utils/helpers");

class BrowsePageService {
  constructor() {
    this.sources = {
      fema: "https://www.fema.gov/news-release",
      redcross: "https://www.redcross.org/about-us/news-and-events",
      cdc: "https://www.cdc.gov/media/releases/index.html",
    };
  }

  async getOfficialUpdates(disasterId = null) {
    const cacheKey = generateCacheKey(
      "official_updates",
      disasterId || "general"
    );
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const updates = [];

    // Try to fetch from multiple sources
    for (const [source, url] of Object.entries(this.sources)) {
      try {
        const sourceUpdates = await this.scrapeSource(source, url);
        updates.push(...sourceUpdates);
      } catch (error) {
        logger.error(`Error scraping ${source}:`, error.message);
      }
    }

    // If no real updates, return mock data
    if (updates.length === 0) {
      updates.push(...this.getMockUpdates());
    }

    // Sort by date (newest first)
    updates.sort((a, b) => new Date(b.date) - new Date(a.date));

    await CacheService.set(cacheKey, updates, 30); // Cache for 30 minutes
    return updates;
  }

  async scrapeSource(source, url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "DisasterResponseApp/1.0 (Educational Purpose)",
        },
      });

      const $ = cheerio.load(response.data);
      const updates = [];

      // Generic scraping logic - would need to be customized per site
      $("article, .news-item, .press-release")
        .slice(0, 5)
        .each((i, element) => {
          const title = $(element)
            .find("h1, h2, h3, .title")
            .first()
            .text()
            .trim();
          const summary = $(element)
            .find("p, .summary, .excerpt")
            .first()
            .text()
            .trim();
          const link = $(element).find("a").first().attr("href");

          if (title && summary) {
            updates.push({
              id: `${source}_${i}`,
              source: source.toUpperCase(),
              title,
              summary: summary.substring(0, 200) + "...",
              link: link
                ? link.startsWith("http")
                  ? link
                  : `${new URL(url).origin}${link}`
                : url,
              date: new Date().toISOString(),
              type: "official",
            });
          }
        });

      return updates;
    } catch (error) {
      logger.error(`Scraping error for ${source}:`, error.message);
      return [];
    }
  }

  getMockUpdates() {
    return [
      {
        id: "fema_001",
        source: "FEMA",
        title:
          "Federal Emergency Management Agency Issues Disaster Declaration",
        summary:
          "FEMA has issued a major disaster declaration for affected areas, making federal funding available for emergency response and recovery efforts. Residents are advised to register for assistance through DisasterAssistance.gov.",
        link: "https://www.fema.gov/press-release/20230615/fema-issues-disaster-declaration",
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        type: "official",
      },
      {
        id: "redcross_001",
        source: "RED CROSS",
        title: "Emergency Shelters Activated Across Affected Region",
        summary:
          "American Red Cross has opened multiple emergency shelters providing safe accommodation, meals, and basic necessities for displaced residents. Volunteers are providing support 24/7.",
        link: "https://www.redcross.org/about-us/news-and-events/news/emergency-shelters-activated",
        date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        type: "official",
      },
      {
        id: "cdc_001",
        source: "CDC",
        title: "Health and Safety Guidelines for Disaster Response",
        summary:
          "CDC issues health recommendations for disaster-affected areas including water safety, food handling, and preventive measures to avoid illness during recovery operations.",
        link: "https://www.cdc.gov/disasters/healthandsafety.html",
        date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        type: "official",
      },
    ];
  }
}

module.exports = new BrowsePageService();
