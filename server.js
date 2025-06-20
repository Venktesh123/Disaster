const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { createServer } = require("http");
const { Server } = require("socket.io");

// Load environment variables FIRST
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const logger = require("./utils/logger");

// Route imports
const disastersRouter = require("./routes/disasters");
const reportsRouter = require("./routes/reports");
const resourcesRouter = require("./routes/resources");
const socialMediaRouter = require("./routes/socialMedia");
const geocodingRouter = require("./routes/geocoding");
const verificationRouter = require("./routes/verification");

const app = express();
const server = createServer(app);

// CORS configuration - Allow all origins
const corsOptions = {
  origin: "*", // Allow all origins
  credentials: false, // Set to false when using origin: "*"
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-user-id",
    "Origin",
    "X-Requested-With",
    "Accept",
  ],
  optionsSuccessStatus: 200,
};

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
  },
});

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

// Other middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting only in production
if (process.env.NODE_ENV === "production") {
  const rateLimit = require("express-rate-limit");
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased limit
    message: {
      success: false,
      error: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
}

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Root route - IMPORTANT for Vercel
app.get("/", (req, res) => {
  res.json({
    message: "Disaster Response API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    status: "OK",
    timestamp: new Date().toISOString(),
    cors: "enabled-all-origins",
    endpoints: {
      health: "/api/health",
      disasters: "/api/disasters",
      reports: "/api/reports",
      resources: "/api/resources",
      socialMedia: "/api/social-media",
      geocoding: "/api/geocoding",
      verification: "/api/verification",
    },
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    server: "Vercel",
    cors: "all-origins-allowed",
  });
});

// API Routes
app.use("/api/disasters", disastersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/social-media", socialMediaRouter);
app.use("/api/geocoding", geocodingRouter);
app.use("/api/verification", verificationRouter);

// Mock social media endpoint
app.get("/api/mock-social-media", (req, res) => {
  const mockPosts = [
    {
      post: "#floodrelief Need food in NYC Lower East Side",
      user: "citizen1",
      timestamp: new Date().toISOString(),
      priority: "high",
    },
    {
      post: "Shelter available at Red Cross Manhattan #disaster",
      user: "relieforg",
      timestamp: new Date().toISOString(),
      priority: "medium",
    },
    {
      post: "SOS: Trapped in building, need rescue #emergency",
      user: "victim123",
      timestamp: new Date().toISOString(),
      priority: "urgent",
    },
  ];

  res.json({
    success: true,
    data: mockPosts,
    meta: { count: mockPosts.length },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Ensure CORS headers are present even in error responses
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-user-id"
  );

  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// 404 handler - IMPORTANT: This should be last
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    requested_path: req.originalUrl,
    method: req.method,
    available_routes: [
      "/",
      "/api/health",
      "/api/disasters",
      "/api/reports",
      "/api/resources",
      "/api/social-media",
      "/api/geocoding",
      "/api/verification",
      "/api/mock-social-media",
    ],
  });
});

// Socket.IO connection handling (only in development)
if (process.env.NODE_ENV !== "production") {
  try {
    const socketHandlers = require("./sockets/socketHandlers");
    socketHandlers(io);
  } catch (error) {
    console.warn("Socket handlers not loaded:", error.message);
  }
}

const PORT = process.env.PORT || 3001;

// Local development server
if (process.env.NODE_ENV !== "production") {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 CORS: All origins allowed`);
  });
}

// Export for Vercel
module.exports = app;
