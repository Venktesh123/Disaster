const logger = require("../utils/logger");

// Mock authentication - replace with real auth in production
const mockUsers = {
  netrunnerX: { id: "netrunnerX", role: "admin" },
  reliefAdmin: { id: "reliefAdmin", role: "admin" },
  contributor1: { id: "contributor1", role: "contributor" },
  citizen1: { id: "citizen1", role: "user" },
};

const authenticate = (req, res, next) => {
  const userId = req.headers["x-user-id"] || "citizen1"; // Default user
  const user = mockUsers[userId];

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Invalid user",
    });
  }

  req.user = user;
  logger.info(`User authenticated: ${userId}`);
  next();
};

const authorize = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const roleHierarchy = { user: 1, contributor: 2, admin: 3 };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
