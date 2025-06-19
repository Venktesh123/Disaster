const logger = require("../utils/logger");

module.exports = (io) => {
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join disaster-specific rooms
    socket.on("join_disaster", (disasterId) => {
      socket.join(`disaster_${disasterId}`);
      logger.info(`Socket ${socket.id} joined disaster room: ${disasterId}`);

      socket.emit("joined_disaster", {
        disaster_id: disasterId,
        message: "Successfully joined disaster updates",
      });
    });

    // Leave disaster room
    socket.on("leave_disaster", (disasterId) => {
      socket.leave(`disaster_${disasterId}`);
      logger.info(`Socket ${socket.id} left disaster room: ${disasterId}`);
    });

    // Join general updates room
    socket.on("join_general", () => {
      socket.join("general_updates");
      logger.info(`Socket ${socket.id} joined general updates`);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });

    // Send initial connection confirmation
    socket.emit("connected", {
      socket_id: socket.id,
      timestamp: new Date().toISOString(),
      message: "Connected to disaster response system",
    });
  });

  // Emit disaster updates to specific rooms
  io.emitDisasterUpdate = (disasterId, data) => {
    io.to(`disaster_${disasterId}`).emit("disaster_updated", data);
    io.to("general_updates").emit("disaster_updated", data);
  };

  // Emit social media updates
  io.emitSocialMediaUpdate = (disasterId, data) => {
    io.to(`disaster_${disasterId}`).emit("social_media_updated", data);
  };

  // Emit resource updates
  io.emitResourceUpdate = (disasterId, data) => {
    io.to(`disaster_${disasterId}`).emit("resources_updated", data);
    io.to("general_updates").emit("resources_updated", data);
  };

  logger.info("Socket.IO handlers initialized");
};
