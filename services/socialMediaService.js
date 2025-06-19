const axios = require("axios");
const CacheService = require("./cacheService");
const logger = require("../utils/logger");
const { generateCacheKey, prioritizeAlert } = require("../utils/helpers");

class SocialMediaService {
  constructor() {
    this.twitterConfig = {
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    };
  }

  async searchDisasterPosts(keywords = [], location = null) {
    const cacheKey = generateCacheKey(
      "social_media",
      keywords.join(","),
      location || "global"
    );
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    let posts = [];

    // Try real Twitter API if configured
    if (this.isTwitterConfigured()) {
      try {
        posts = await this.searchTwitter(keywords, location);
      } catch (error) {
        logger.error("Twitter search error:", error.message);
        posts = this.getMockPosts(keywords, location);
      }
    } else {
      posts = this.getMockPosts(keywords, location);
    }

    // Prioritize posts
    posts.forEach((post) => {
      post.priority = prioritizeAlert(post.content || post.post);
    });

    // Sort by priority and recency
    posts.sort((a, b) => {
      const priorityOrder = { urgent: 3, high: 2, medium: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    await CacheService.set(cacheKey, posts, 15); // Cache for 15 minutes
    return posts;
  }

  isTwitterConfigured() {
    return (
      this.twitterConfig.apiKey &&
      this.twitterConfig.apiSecret &&
      this.twitterConfig.accessToken &&
      this.twitterConfig.accessTokenSecret
    );
  }

  async searchTwitter(keywords, location) {
    // This is a simplified Twitter search implementation
    // In production, you'd use the official Twitter API v2
    const query = keywords.map((k) => `#${k}`).join(" OR ");

    // Mock Twitter API response since we can't implement full OAuth flow here
    return this.getMockPosts(keywords, location);
  }

  getMockPosts(keywords = [], location = null) {
    const mockPosts = [
      {
        id: "1",
        post: `#floodrelief Need immediate food supplies in ${
          location || "downtown area"
        }. Family of 4 trapped on second floor.`,
        user: "citizen_help",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
        engagement: { likes: 15, retweets: 8, replies: 3 },
      },
      {
        id: "2",
        post: `SOS: Medical emergency in ${
          location || "affected area"
        }. Need ambulance access! #emergency #disaster`,
        user: "firstresponder",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        engagement: { likes: 45, retweets: 23, replies: 12 },
      },
      {
        id: "3",
        post: `Red Cross shelter now open at ${
          location || "community center"
        }. Safe space available for families. #shelter #safety`,
        user: "redcross_local",
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
        engagement: { likes: 67, retweets: 34, replies: 8 },
      },
      {
        id: "4",
        post: `Urgent: Running low on water supplies. Distribution point needs restocking. #water #supplies`,
        user: "relief_coord",
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        engagement: { likes: 23, retweets: 15, replies: 6 },
      },
      {
        id: "5",
        post: `Power restored to sectors 1-3. Still working on sector 4. Updates every hour. #infrastructure`,
        user: "power_company",
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 1.5 hours ago
        engagement: { likes: 89, retweets: 45, replies: 22 },
      },
    ];

    // Filter based on keywords if provided
    if (keywords.length > 0) {
      return mockPosts.filter((post) =>
        keywords.some((keyword) =>
          post.post.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    return mockPosts;
  }
}

module.exports = new SocialMediaService();
