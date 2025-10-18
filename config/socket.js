const http = require("http");
const socketIO = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { redisConfig } = require("../lib/Redis");
const jwt = require("jsonwebtoken");

let io;

const connectSocket = async (app) => {
  const server = http.createServer(app);
  const origins = process.env.SOCKET_ORIGINS?.split(",").map((origin) =>
    origin.trim()
  ) || ["*"];

  io = socketIO(server, {
    cors: {
      origin: origins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const pubClient = createClient({
    url: `redis://${redisConfig.host}:${redisConfig.port}`,
    password: redisConfig.password,
  });

  const subClient = pubClient.duplicate();

  try {
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[SOCKET] Redis Adapter configured");
  } catch (error) {
    console.error("[SOCKET] Failed to connect to Redis:", error);
    throw error;
  }

  io.on("connection", (socket) => {
    console.log("[SOCKET] User connected:", socket.id);

    socket.currentPresentationRoom = null;

    // Authenticate socket connection
    const token = socket.handshake.auth.token;

    console.log("socket io token", token);
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      console.log("socket io decoded token", decoded);
      userId = decoded._id;
      socket.userId = userId;
    } catch (error) {
      console.error("[SOCKET] Authentication failed:", error.message);
      socket.emit("error", { message: "Authentication failed" });
      socket.disconnect();
      return;
    }

    socket.on("joinPresentation", async (presentationId) => {
      if (!presentationId) {
        console.error(`[SOCKET] Invalid presentation ID from ${socket.id}`);
        socket.emit("error", { message: "Invalid presentation ID" });
        return;
      }

      // Validate user ownership of presentation
      // Not needed for now
      // const metadataKey = `presentation_metadata:${userId}:${presentationId}`;
      // const metadata = await pubClient.get(metadataKey);
      // if (!metadata) {
      //   console.error(
      //     `[SOCKET] User ${userId} not authorized for presentation ${presentationId}`
      //   );
      //   socket.emit("error", { message: "Unauthorized presentation access" });
      //   return;
      // }

      const newRoomId = `presentation:${userId}:${presentationId}`;

      // Leave current presentation room if exists
      if (
        socket.currentPresentationRoom &&
        socket.currentPresentationRoom !== newRoomId
      ) {
        console.log(
          `[SOCKET] ${socket.id} leaving previous room ${socket.currentPresentationRoom}`
        );
        await socket.leave(socket.currentPresentationRoom);
        socket.to(socket.currentPresentationRoom).emit("userLeft", {
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      }

      await socket.join(newRoomId);
      socket.currentPresentationRoom = newRoomId;

      console.log(`[SOCKET] ${socket.id} joined room ${newRoomId}`);

      const sockets = await io.in(newRoomId).allSockets();
      console.log(
        `[SOCKET] Active sockets in ${newRoomId}:`,
        Array.from(sockets)
      );

      socket.emit("joinedPresentation", {
        presentationId,
        roomId: newRoomId,
        connectedUsers: sockets.size,
        timestamp: new Date().toISOString(),
      });

      socket.to(newRoomId).emit("userJoined", {
        socketId: socket.id,
        connectedUsers: sockets.size,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("leavePresentation", async (presentationId) => {
      if (!presentationId) {
        console.error(
          `[SOCKET] Invalid presentation ID for leave from ${socket.id}`
        );
        return;
      }

      const roomId = `presentation:${userId}:${presentationId}`;

      if (socket.currentPresentationRoom === roomId) {
        await socket.leave(roomId);
        socket.currentPresentationRoom = null;

        console.log(`[SOCKET] ${socket.id} left room ${roomId}`);

        socket.to(roomId).emit("userLeft", {
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });

        socket.emit("leftPresentation", {
          presentationId,
          roomId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on("disconnect", async (reason) => {
      console.log(
        `[SOCKET] User disconnected: ${socket.id}, reason: ${reason}`
      );

      if (socket.currentPresentationRoom) {
        socket.to(socket.currentPresentationRoom).emit("userLeft", {
          socketId: socket.id,
          reason: "disconnect",
          timestamp: new Date().toISOString(),
        });
        socket.currentPresentationRoom = null;
      }

      const rooms = Array.from(socket.rooms).filter(
        (room) => room !== socket.id
      );
      for (const room of rooms) {
        socket.leave(room);
        console.log(`[SOCKET] ${socket.id} left room ${room} on disconnect`);
      }
    });

    // socket.on("presentationUpdate", async (data) => {
    //   const { presentationId, logs, slides, status } = data;

    //   if (!presentationId) {
    //     console.error(
    //       `[SOCKET] Invalid presentation ID for update from ${socket.id}`
    //     );
    //     return;
    //   }

    //   const roomId = `presentation:${userId}:${presentationId}`;

    //   io.to(roomId).emit("presentationUpdate", {
    //     presentationId,
    //     logs,
    //     slides,
    //     status,
    //     timestamp: new Date().toISOString(),
    //   });

    //   console.log(
    //     `[SOCKET] Broadcasted update for presentation ${presentationId} to room ${roomId}`
    //   );
    // });

    socket.on("ping", () => {
      socket.emit("pong", {
        timestamp: new Date().toISOString(),
        socketId: socket.id,
      });
    });
  });

  setInterval(async () => {
    try {
      const rooms = io.sockets.adapter.rooms;
      for (const [roomId, room] of rooms.entries()) {
        if (roomId.startsWith("presentation:") && room.size === 0) {
          console.log(`[SOCKET] Cleaning up empty room ${roomId}`);
          io.sockets.adapter.del(roomId);
        }
      }
    } catch (error) {
      console.error("[SOCKET] Error during room cleanup:", error);
    }
  }, 60 * 60 * 1000);

  return server;
};

const getIO = () => {
  if (!io) {
    throw new Error("[SOCKET] Socket.io not initialized!");
  }
  return io;
};

const broadcastPresentationUpdate = (presentationId, userId, updateData) => {
  if (!io) {
    console.error(
      "[SOCKET] Socket.io not initialized, cannot broadcast update"
    );
    return;
  }

  const roomId = `presentation:${userId}:${presentationId}`;

  io.to(roomId).emit("presentationUpdate", {
    presentationId,
    ...updateData,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[SOCKET] Broadcasted update for presentation ${presentationId} to room ${roomId}`
  );
};

const getRoomInfo = async (presentationId, userId) => {
  if (!io) {
    throw new Error("[SOCKET] Socket.io not initialized!");
  }

  const roomId = `presentation:${userId}:${presentationId}`;
  const sockets = await io.in(roomId).allSockets();

  return {
    roomId,
    connectedUsers: sockets.size,
    socketIds: Array.from(sockets),
  };
};

module.exports = {
  connectSocket,
  getIO,
  broadcastPresentationUpdate,
  getRoomInfo,
};