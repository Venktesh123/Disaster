const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const logger = require("./utils/logger");
const rateLimiter = require("./middleware/rateLimiter");
const socketHandlers = require("./sockets/socketHandlers");

// Route imports
const disastersRouter = require("./routes/disasters");
const reportsRouter = require("./routes/reports");
const resourcesRouter = require("./routes/resources");
const socialMediaRouter = require("./routes/socialMedia");
const geocodingRouter = require("./routes/geocoding");
const verificationRouter = require("./routes/verification");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-frontend-domain.com"]
        : ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-frontend-domain.com"]
        : ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(rateLimiter);

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/disasters", disastersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/social-media", socialMediaRouter);
app.use("/api/geocoding", geocodingRouter);
app.use("/api/verification", verificationRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

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
  logger.error("Error:", {
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

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Socket.IO connection handling
socketHandlers(io);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, server, io };
