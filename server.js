const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { createServer } = require("http");
const { Server } = require("socket.io");

// Load environment variables
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
const server = createServer(app);

// Import logger with error handling
let logger;
try {
  logger = require("./utils/logger");
} catch (error) {
  logger = console; // Fallback to console if logger fails
  console.warn("Logger not available, using console");
}

// CORS configuration - Allow all origins
const corsOptions = {
  origin: "*",
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "x-user-id",
  ],
  optionsSuccessStatus: 200,
};

// Apply CORS first - before any other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

// Additional CORS middleware for extra safety
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

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

// Socket.IO with CORS enabled
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
  },
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Disaster Response API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    status: "OK",
    cors: "enabled-all-origins",
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
    cors: "all-origins-allowed",
  });
});

// Import routes with error handling
let disastersRouter,
  reportsRouter,
  resourcesRouter,
  socialMediaRouter,
  geocodingRouter,
  verificationRouter;

try {
  disastersRouter = require("./routes/disasters");
} catch (error) {
  console.warn("Disasters route not loaded:", error.message);
  disastersRouter = express.Router();
  disastersRouter.get("/", (req, res) =>
    res.json({ success: true, data: [], message: "Mock disasters endpoint" })
  );
  disastersRouter.post("/", (req, res) =>
    res.json({
      success: true,
      data: { id: "mock", ...req.body },
      message: "Mock disaster created",
    })
  );
}

try {
  reportsRouter = require("./routes/reports");
} catch (error) {
  console.warn("Reports route not loaded:", error.message);
  reportsRouter = express.Router();
  reportsRouter.get("/disaster/:id", (req, res) =>
    res.json({ success: true, data: [], message: "Mock reports endpoint" })
  );
}

try {
  resourcesRouter = require("./routes/resources");
} catch (error) {
  console.warn("Resources route not loaded:", error.message);
  resourcesRouter = express.Router();
  resourcesRouter.get("/disaster/:id", (req, res) =>
    res.json({ success: true, data: [], message: "Mock resources endpoint" })
  );
}

try {
  socialMediaRouter = require("./routes/socialMedia");
} catch (error) {
  console.warn("Social media route not loaded:", error.message);
  socialMediaRouter = express.Router();
  socialMediaRouter.get("/disaster/:id", (req, res) =>
    res.json({ success: true, data: [], message: "Mock social media endpoint" })
  );
}

try {
  geocodingRouter = require("./routes/geocoding");
} catch (error) {
  console.warn("Geocoding route not loaded:", error.message);
  geocodingRouter = express.Router();
  geocodingRouter.post("/", (req, res) =>
    res.json({
      success: true,
      data: { lat: 40.7128, lng: -74.006 },
      message: "Mock geocoding endpoint",
    })
  );
}

try {
  verificationRouter = require("./routes/verification");
} catch (error) {
  console.warn("Verification route not loaded:", error.message);
  verificationRouter = express.Router();
  verificationRouter.post("/disaster/:id/image", (req, res) =>
    res.json({
      success: true,
      data: { verified: true },
      message: "Mock verification endpoint",
    })
  );
}

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

// CORS test endpoint
app.post("/api/test-cors", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working perfectly!",
    received_data: req.body,
    timestamp: new Date().toISOString(),
    cors_headers: {
      origin: res.get("Access-Control-Allow-Origin"),
      methods: res.get("Access-Control-Allow-Methods"),
    },
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
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id"
  );

  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    cors: "enabled-even-in-errors",
  });
});

// 404 handler
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
      "/api/test-cors",
    ],
  });
});

// Socket.IO connection handling (only in development)
if (process.env.NODE_ENV !== "production") {
  try {
    const socketHandlers = require("./sockets/socketHandlers");
    socketHandlers(io);
    console.log("Socket.IO handlers loaded");
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
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  });
}

// Export for Vercel
module.exports = app;
