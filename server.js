const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { createServer } = require("http");
const { Server } = require("socket.io");
app.use(cors());
// Load environment variables
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

// CORS configuration
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [
          process.env.FRONTEND_URL || "https://your-frontend-domain.vercel.app",
          "https://*.vercel.app",
        ]
      : ["http://localhost:3000", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
};

const io = new Server(server, {
  cors: corsOptions,
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API
  })
);
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting only in production
if (process.env.NODE_ENV === "production") {
  const rateLimit = require("express-rate-limit");
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      success: false,
      error: "Too many requests, please try again later",
    },
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

// Socket.IO connection handling
if (process.env.NODE_ENV !== "production") {
  // Socket.IO doesn't work well with Vercel serverless functions
  const socketHandlers = require("./sockets/socketHandlers");
  socketHandlers(io);
}

const PORT = process.env.PORT || 3001;

// Local development server
if (process.env.NODE_ENV !== "production") {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

// Export for Vercel
module.exports = app;
