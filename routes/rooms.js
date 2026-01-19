import express from "express";
import Room from "../models/Room.js";
import Message from "../models/Message.js";
import ApiError from "../errors/errors.js";

const router = express.Router();

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Get all public rooms
 *     description: Retrieves a list of all public chat rooms for an application
 *     tags: [Rooms]
 *     parameters:
 *       - in: query
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application identifier
 *         example: app_123
 *     responses:
 *       200:
 *         description: List of rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request (missing applicationId)
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", async (req, res, next) => {
  try {
    const { applicationId } = req.query;

    if (!applicationId) {
      return next(ApiError.badRequest("applicationId is required"));
    }

    const rooms = await Room.find({ isPrivate: false, applicationId })
      .select("name description applicationId participants createdAt")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: rooms });
  } catch (error) {
    next(ApiError.internal("Failed to fetch rooms"));
  }
});

/**
 * @swagger
 * /rooms/unread/{userId}:
 *   get:
 *     summary: Get rooms with unread messages for a user
 *     description: Returns a list of rooms that have unread messages not sent by the user
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's odooId/senderId
 *         example: user_123
 *       - in: query
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application identifier
 *         example: app_123
 *     responses:
 *       200:
 *         description: Rooms with unread messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roomId:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       roomName:
 *                         type: string
 *                         example: "general"
 *                       unreadCount:
 *                         type: integer
 *                         example: 5
 *                       participants:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["user_123", "user_456"]
 *       400:
 *         description: Bad request (missing applicationId)
 *       500:
 *         description: Internal server error
 */
router.get("/unread/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { applicationId } = req.query;

    if (!applicationId) {
      return next(ApiError.badRequest("applicationId is required"));
    }

    // Find all messages not sent by the user and not read by the user
    const unreadMessages = await Message.aggregate([
      {
        // Exclude messages sent by the user and filter by applicationId
        $match: {
          applicationId,
          senderId: { $ne: userId },
          // Not read by this user
          "readBy.odooId": { $ne: userId }
        }
      },
      {
        // Group by roomId and count unread messages
        $group: {
          _id: "$roomId",
          unreadCount: { $sum: 1 }
        }
      },
      {
        // Lookup room details
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "_id",
          as: "room"
        }
      },
      {
        // Unwind the room array
        $unwind: "$room"
      },
      {
        // Only include rooms where the user is a participant
        $match: {
          "room.participants": userId
        }
      },
      {
        // Project the final shape
        $project: {
          _id: 0,
          roomId: "$_id",
          roomName: "$room.name",
          unreadCount: 1,
          participants: "$room.participants"
        }
      },
      {
        // Sort by unread count descending
        $sort: { unreadCount: -1 }
      }
    ]);

    res.json({ success: true, data: unreadMessages });
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    next(ApiError.internal("Failed to fetch unread messages"));
  }
});

/**
 * @swagger
 * /rooms/admin/unread/{userId}:
 *   get:
 *     summary: Get all rooms with unread messages for admin
 *     description: Returns a list of all rooms that have unread messages not sent by the user. Unlike the regular unread endpoint, the user does not need to be a participant of the room.
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user's odooId/senderId
 *         example: admin_123
 *       - in: query
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application identifier
 *         example: app_123
 *     responses:
 *       200:
 *         description: Rooms with unread messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roomId:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       roomName:
 *                         type: string
 *                         example: "general"
 *                       unreadCount:
 *                         type: integer
 *                         example: 5
 *                       participants:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["user_123", "user_456"]
 *       400:
 *         description: Bad request (missing applicationId)
 *       500:
 *         description: Internal server error
 */
router.get("/admin/unread/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { applicationId } = req.query;

    if (!applicationId) {
      return next(ApiError.badRequest("applicationId is required"));
    }

    // Find all messages not sent by the user and not read by the user
    // Admin does not need to be a participant of the room
    const unreadMessages = await Message.aggregate([
      {
        // Exclude messages sent by the user and filter by applicationId
        $match: {
          applicationId,
          senderId: { $ne: userId },
          // Not read by this user
          "readBy.odooId": { $ne: userId }
        }
      },
      {
        // Group by roomId and count unread messages
        $group: {
          _id: "$roomId",
          unreadCount: { $sum: 1 }
        }
      },
      {
        // Lookup room details
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "_id",
          as: "room"
        }
      },
      {
        // Unwind the room array
        $unwind: "$room"
      },
      {
        // Project the final shape
        $project: {
          _id: 0,
          roomId: "$_id",
          roomName: "$room.name",
          unreadCount: 1,
          participants: "$room.participants"
        }
      },
      {
        // Sort by unread count descending
        $sort: { unreadCount: -1 }
      }
    ]);

    res.json({ success: true, data: unreadMessages });
  } catch (error) {
    console.error("Error fetching admin unread messages:", error);
    next(ApiError.internal("Failed to fetch admin unread messages"));
  }
});

/**
 * @swagger
 * /rooms/name/{name}:
 *   get:
 *     summary: Find a room by name with messages
 *     description: Retrieves a chat room by its name including its messages
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Room name
 *         example: general
 *       - in: query
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application identifier
 *         example: app_123
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: Room with messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Room'
 *                     - type: object
 *                       properties:
 *                         messages:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Message'
 *       400:
 *         description: Bad request (missing applicationId)
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
router.get("/name/:name", async (req, res, next) => {
  try {
    const { applicationId, limit = 50 } = req.query;

    if (!applicationId) {
      return next(ApiError.badRequest("applicationId is required"));
    }

    const room = await Room.findOne({ name: req.params.name, applicationId });
    if (!room) {
      return next(ApiError.notFound("Room not found"));
    }

    // Fetch messages for this room
    const messages = await Message.find({ roomId: room._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ 
      success: true, 
      data: {
        ...room.toObject(),
        messages: messages.reverse()
      }
    });
  } catch (error) {
    console.error("Error fetching room by name:", error);
    next(ApiError.internal("Failed to fetch room"));
  }
});

/**
 * @swagger
 * /rooms/{id}:
 *   get:
 *     summary: Get a specific room
 *     description: Retrieves details of a specific chat room by ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
router.get("/:id", async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return next(ApiError.notFound("Room not found"));
    }

    res.json({ success: true, data: room });
  } catch (error) {
    console.error("Error fetching room:", error);
    next(ApiError.internal("Failed to fetch room"));
  }
});

/**
 * @swagger
 * /rooms/{id}/messages:
 *   get:
 *     summary: Get messages for a room
 *     description: Retrieves messages from a specific chat room with pagination
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: 507f1f77bcf86cd799439011
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of messages to return
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Get messages before this timestamp (for pagination)
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       500:
 *         description: Internal server error
 */
router.get("/:id/messages", async (req, res, next) => {
  try {
    const { limit = 50, before } = req.query;

    const query = { roomId: req.params.id };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    next(ApiError.internal("Failed to fetch messages"));
  }
});

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a new room
 *     description: Creates a new chat room
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRoomRequest'
 *     responses:
 *       201:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request (missing fields or room already exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, description, createdBy, isPrivate, applicationId } = req.body;

    if (!name || !createdBy || !applicationId) {
      return next(ApiError.badRequest("Name, createdBy, and applicationId are required"));
    }

    const existingRoom = await Room.findOne({ name, applicationId });
    if (existingRoom) {
      return next(ApiError.badRequest("Room name already exists for this application"));
    }

    const room = await Room.create({
      name,
      description: description || "",
      applicationId,
      createdBy,
      isPrivate: isPrivate || false,
      participants: [createdBy],
    });

    res.status(201).json({ success: true, data: room });
  } catch (error) {
    next(ApiError.internal("Failed to create room"));
  }
});

/**
 * @swagger
 * /rooms/{id}:
 *   delete:
 *     summary: Delete a room
 *     description: Deletes a chat room and all its messages
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Room deleted successfully
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return next(ApiError.notFound("Room not found"));
    }

    // Also delete all messages in the room
    await Message.deleteMany({ roomId: req.params.id });

    res.json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    next(ApiError.internal("Failed to delete room"));
  }
});

export default router;
