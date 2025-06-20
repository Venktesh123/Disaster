// Import logger with error handling
let logger;
try {
  logger = require("../utils/logger");
} catch (error) {
  logger = console;
}

// Mock authentication - replace with real auth in production
const mockUsers = {
  netrunnerX: { id: "netrunnerX", role: "admin" },
  reliefAdmin: { id: "reliefAdmin", role: "admin" },
  contributor1: { id: "contributor1", role: "contributor" },
  citizen1: { id: "citizen1", role: "user" },
  anonymous: { id: "anonymous", role: "user" }, // Default fallback user
};

const authenticate = (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] || "citizen1"; // Default user
    const user = mockUsers[userId];

    if (!user) {
      logger.warn(`Authentication failed for user: ${userId}`);
      return res.status(401).json({
        success: false,
        error: "Invalid user",
        available_users: Object.keys(mockUsers),
      });
    }

    req.user = user;
    logger.info(`User authenticated: ${userId}`);
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      error: "Authentication system error",
    });
  }
};

const authorize = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
      }

      const userRole = req.user.role;
      const roleHierarchy = { user: 1, contributor: 2, admin: 3 };

      if (!roleHierarchy[userRole] || !roleHierarchy[requiredRole]) {
        return res.status(403).json({
          success: false,
          error: "Invalid role configuration",
        });
      }

      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        logger.warn(
          `Authorization failed: ${userRole} tried to access ${requiredRole} resource`
        );
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions",
          required_role: requiredRole,
          user_role: userRole,
        });
      }

      next();
    } catch (error) {
      logger.error("Authorization error:", error);
      return res.status(500).json({
        success: false,
        error: "Authorization system error",
      });
    }
  };
};

module.exports = { authenticate, authorize };
