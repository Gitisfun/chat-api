import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Chat API",
      version: "1.0.0",
      description: "Real-time chat application API with rooms and messaging",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "/api",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key for authentication",
        },
      },
      schemas: {
        Room: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Room ID",
              example: "507f1f77bcf86cd799439011",
            },
            name: {
              type: "string",
              description: "Room name",
              example: "general",
            },
            description: {
              type: "string",
              description: "Room description",
              example: "A room for general discussion",
            },
            createdBy: {
              type: "string",
              description: "Username of room creator",
              example: "john_doe",
            },
            isPrivate: {
              type: "boolean",
              description: "Whether the room is private",
              example: false,
            },
            participants: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of participant usernames",
              example: ["john_doe", "jane_doe"],
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Room creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Room last update timestamp",
            },
          },
        },
        Message: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Message ID",
              example: "507f1f77bcf86cd799439012",
            },
            roomId: {
              type: "string",
              description: "Room ID the message belongs to",
              example: "507f1f77bcf86cd799439011",
            },
            senderId: {
              type: "string",
              description: "Sender's unique ID",
              example: "user_123",
            },
            sender: {
              type: "string",
              description: "Sender's display name",
              example: "john_doe",
            },
            content: {
              type: "string",
              description: "Message content",
              example: "Hello, world!",
            },
            type: {
              type: "string",
              enum: ["text", "system"],
              description: "Message type",
              example: "text",
            },
            readBy: {
              type: "array",
              description: "List of users who have read this message",
              items: {
                type: "object",
                properties: {
                  odooId: {
                    type: "string",
                    description: "User ID who read the message",
                    example: "user_123",
                  },
                  readAt: {
                    type: "string",
                    format: "date-time",
                    description: "When the message was read",
                  },
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Message timestamp",
            },
          },
        },
        CreateRoomRequest: {
          type: "object",
          required: ["name", "createdBy"],
          properties: {
            name: {
              type: "string",
              description: "Room name",
              example: "general",
            },
            description: {
              type: "string",
              description: "Room description",
              example: "A room for general discussion",
            },
            createdBy: {
              type: "string",
              description: "Username of room creator",
              example: "john_doe",
            },
            isPrivate: {
              type: "boolean",
              description: "Whether the room is private",
              example: false,
            },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Error message",
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

