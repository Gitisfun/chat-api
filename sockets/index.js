import { Server } from "socket.io";
import chatHandler from "./chatHandler.js";

export function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`New socket connection: ${socket.id}`);
    chatHandler(io, socket);
  });

  return io;
}

