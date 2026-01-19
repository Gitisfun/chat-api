import Room from "../models/Room.js";
import Message from "../models/Message.js";

export default function chatHandler(io, socket) {
  const connectedUsers = io.connectedUsers || new Map();
  io.connectedUsers = connectedUsers;

  // Store user info on connection
  socket.on("user:connect", async ({ username, senderId, applicationId }) => {
    socket.username = username;
    socket.senderId = senderId;
    socket.applicationId = applicationId;
    connectedUsers.set(socket.id, { username, senderId, applicationId, currentRoom: null });
    
    console.log(`User ${username} (${senderId}) connected to application ${applicationId}`);
    
    // Send list of available rooms for this application
    const rooms = await Room.find({ isPrivate: false, applicationId }).select("name description applicationId participants createdAt");
    socket.emit("rooms:list", rooms);
  });

  // Join a chat room
  socket.on("room:join", async ({ roomId }) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        return socket.emit("error", { message: "Room not found" });
      }

      const userData = connectedUsers.get(socket.id);
      const username = userData?.username || "Anonymous";
      const senderId = userData?.senderId || socket.id;

      // Leave current room if in one
      const currentRoomId = userData?.currentRoom;
      if (currentRoomId) {
        socket.leave(currentRoomId);
        io.to(currentRoomId).emit("user:left", { 
          username, 
          message: `${username} left the room` 
        });
      }

      const applicationId = userData?.applicationId;

      // Join new room
      socket.join(roomId);
      connectedUsers.set(socket.id, { username, senderId, applicationId, currentRoom: roomId });

      // Add user to room participants if not already
      if (!room.participants.includes(senderId)) {
        room.participants.push(senderId);
        await room.save();
      }

      // Get recent messages
      const messages = await Message.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Send room info and messages to joining user
      socket.emit("room:joined", {
        room: { id: room._id, name: room.name, description: room.description },
        messages: messages.reverse(),
      });

      // Notify others in the room
      socket.to(roomId).emit("user:joined", {
        username,
        message: `${username} joined the room`,
      });

      console.log(`User ${username} joined room: ${room.name}`);
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Leave current room
  socket.on("room:leave", async () => {
    const userData = connectedUsers.get(socket.id);
    if (!userData?.currentRoom) return;

    const { username, senderId, applicationId, currentRoom } = userData;
    
    socket.leave(currentRoom);
    connectedUsers.set(socket.id, { username, senderId, applicationId, currentRoom: null });

    io.to(currentRoom).emit("user:left", {
      username,
      message: `${username} left the room`,
    });

    socket.emit("room:left");
    console.log(`User ${username} left room`);
  });

  // Send a message
  socket.on("message:send", async ({ content }) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData?.currentRoom) {
        return socket.emit("error", { message: "You must join a room first" });
      }

      const { username, senderId, applicationId, currentRoom } = userData;

      const message = await Message.create({
        roomId: currentRoom,
        applicationId,
        senderId,
        sender: username,
        content,
        type: "text",
      });

      // Broadcast message to all in room (including sender)
      io.to(currentRoom).emit("message:new", {
        id: message._id,
        senderId: message.senderId,
        sender: message.sender,
        content: message.content,
        type: message.type,
        readBy: message.readBy,
        createdAt: message.createdAt,
      });

      console.log(`Message from ${username}: ${content.substring(0, 50)}...`);
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Mark a single message as read
  socket.on("message:read", async ({ messageId }) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData?.senderId) {
        return socket.emit("error", { message: "User not authenticated" });
      }

      const { senderId, currentRoom } = userData;

      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit("error", { message: "Message not found" });
      }

      // Check if already read by this user
      const alreadyRead = message.readBy.some(r => r.odooId === senderId);
      if (!alreadyRead) {
        message.readBy.push({ odooId: senderId, readAt: new Date() });
        await message.save();

        // Notify others in the room that message was read
        if (currentRoom) {
          io.to(currentRoom).emit("message:read", {
            messageId: message._id,
            readBy: { odooId: senderId, readAt: new Date() },
          });
        }
      }

      socket.emit("message:read:success", { messageId });
    } catch (error) {
      console.error("Error marking message as read:", error);
      socket.emit("error", { message: "Failed to mark message as read" });
    }
  });

  // Mark multiple messages as read
  socket.on("messages:read", async ({ messageIds }) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData?.senderId) {
        return socket.emit("error", { message: "User not authenticated" });
      }

      const { senderId, currentRoom } = userData;

      const result = await Message.updateMany(
        { 
          _id: { $in: messageIds },
          "readBy.odooId": { $ne: senderId }
        },
        { 
          $push: { 
            readBy: { odooId: senderId, readAt: new Date() } 
          } 
        }
      );

      // Notify others in the room
      if (currentRoom && result.modifiedCount > 0) {
        io.to(currentRoom).emit("messages:read", {
          messageIds,
          readBy: { odooId: senderId, readAt: new Date() },
        });
      }

      socket.emit("messages:read:success", { 
        messageIds, 
        count: result.modifiedCount 
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      socket.emit("error", { message: "Failed to mark messages as read" });
    }
  });

  // Typing indicator
  socket.on("user:typing", () => {
    const userData = connectedUsers.get(socket.id);
    if (!userData?.currentRoom) return;

    socket.to(userData.currentRoom).emit("user:typing", {
      username: userData.username,
    });
  });

  socket.on("user:stop-typing", () => {
    const userData = connectedUsers.get(socket.id);
    if (!userData?.currentRoom) return;

    socket.to(userData.currentRoom).emit("user:stop-typing", {
      username: userData.username,
    });
  });

  // Create a new room
  socket.on("room:create", async ({ name, description, isPrivate, applicationId }) => {
    try {
      const username = socket.username || "Anonymous";
      const senderId = socket.senderId || socket.id;
      const appId = applicationId || socket.applicationId;

      if (!appId) {
        return socket.emit("error", { message: "applicationId is required" });
      }

      const existingRoom = await Room.findOne({ name, applicationId: appId });
      if (existingRoom) {
        return socket.emit("error", { message: "Room name already exists for this application" });
      }

      const room = await Room.create({
        name,
        description: description || "",
        applicationId: appId,
        createdBy: senderId,
        isPrivate: isPrivate || false,
        participants: [senderId],
      });

      socket.emit("room:created", {
        id: room._id,
        name: room.name,
        description: room.description,
      });

      // Broadcast to all users if public room
      if (!isPrivate) {
        io.emit("rooms:new", {
          id: room._id,
          name: room.name,
          description: room.description,
          createdAt: room.createdAt,
        });
      }

      console.log(`Room created: ${name} by ${username}`);
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", { message: "Failed to create room" });
    }
  });

  // Get list of users in current room
  socket.on("room:users", () => {
    const userData = connectedUsers.get(socket.id);
    if (!userData?.currentRoom) return;

    const roomUsers = [];
    for (const [id, user] of connectedUsers.entries()) {
      if (user.currentRoom === userData.currentRoom) {
        roomUsers.push({ id, username: user.username, senderId: user.senderId });
      }
    }

    socket.emit("room:users", roomUsers);
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      const { username, currentRoom } = userData;
      
      if (currentRoom) {
        io.to(currentRoom).emit("user:left", {
          username,
          message: `${username} disconnected`,
        });
      }

      connectedUsers.delete(socket.id);
      console.log(`User ${username} disconnected`);
    }
  });
}
