// utils/logger.js - Vercel compatible logger
let winston;
try {
  winston = require("winston");
} catch (error) {
  // Fallback if winston is not available
  console.warn("Winston not available, using console logger");
  module.exports = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.log,
  };
  return;
}

// Create logger configuration that works in serverless environments
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "disaster-response-backend" },
  transports: [
    // Console transport - works in all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple()
      ),
    }),
  ],
});

// Only add file transports in local development (not in Vercel)
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  try {
    const fs = require("fs");
    const path = require("path");

    const logsDir = path.join(process.cwd(), "logs");

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Add file transports only in local development
    logger.add(
      new winston.transports.File({
        filename: path.join(logsDir, "error.log"),
        level: "error",
      })
    );

    logger.add(
      new winston.transports.File({
        filename: path.join(logsDir, "combined.log"),
      })
    );
  } catch (error) {
    // If file operations fail, just use console logging
    console.warn(
      "Could not create log files, using console only:",
      error.message
    );
  }
}

// Add error handling to prevent crashes
const safeLogger = {
  info: (message, ...args) => {
    try {
      logger.info(message, ...args);
    } catch (error) {
      console.log(message, ...args);
    }
  },
  warn: (message, ...args) => {
    try {
      logger.warn(message, ...args);
    } catch (error) {
      console.warn(message, ...args);
    }
  },
  error: (message, ...args) => {
    try {
      logger.error(message, ...args);
    } catch (error) {
      console.error(message, ...args);
    }
  },
  debug: (message, ...args) => {
    try {
      logger.debug(message, ...args);
    } catch (error) {
      console.log(message, ...args);
    }
  },
};

// Log startup information
if (process.env.NODE_ENV === "production") {
  safeLogger.info("Logger initialized for production (console only)");
} else {
  safeLogger.info("Logger initialized for development");
}

module.exports = safeLogger;
