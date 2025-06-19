// utils/logger.js - Fixed for Vercel deployment
const winston = require("winston");

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
  // Check if logs directory exists, create if not (only in local dev)
  const fs = require("fs");
  const path = require("path");

  const logsDir = path.join(process.cwd(), "logs");

  try {
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

// Log startup information
if (process.env.NODE_ENV === "production") {
  logger.info("Logger initialized for production (console only)");
} else {
  logger.info("Logger initialized for development (console + files)");
}

module.exports = logger;
