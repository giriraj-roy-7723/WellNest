import jwt from "jsonwebtoken";
import Chat from "../models/Chats.js";

// Middleware for socket authentication
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Missing token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.id; // JWT token contains { id, role }
    socket.userType = decoded.role;

    console.log(
      `Socket authenticated: User ${socket.userId} (${socket.userType})`
    );
    next();
  } catch (error) {
    console.error("Socket authentication failed:", error.message);
    next(new Error("Invalid/expired token"));
  }
};

// Initialize Socket.IO
export const initializeSocket = (io) => {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log(`User ${socket.userId} connected`);

    // Join specific chat room
    socket.on("join-chat", async (appointmentId) => {
      try {
        console.log(
          `User ${socket.userId} trying to join chat ${appointmentId}`
        );

        // Verify user has access to this appointment
        const chat = await Chat.findOne({
          appointmentId,
          $or: [{ doctorId: socket.userId }, { patientId: socket.userId }],
        }).populate("doctorId patientId", "name email");

        if (!chat) {
          console.log(`No chat found for appointmentId: ${appointmentId} and userId: ${socket.userId}`);
          socket.emit("error", "Unauthorized access to chat");
          return;
        }

        console.log(`Found chat for appointmentId: ${appointmentId}`, {
          chatId: chat._id,
          doctorId: chat.doctorId._id,
          patientId: chat.patientId._id,
          messageCount: chat.messages.length
        });

        socket.join(appointmentId);
        console.log(`User ${socket.userId} joined chat ${appointmentId}`);

        // Send chat history (last 50 messages)
        const recentMessages = chat.messages.slice(-50);
        console.log(`Sending ${recentMessages.length} messages to user`);
        socket.emit("chat-history", recentMessages);

        // Send chat info
        socket.emit("chat-info", {
          doctor: chat.doctorId,
          patient: chat.patientId,
          appointmentId: chat.appointmentId,
        });
      } catch (error) {
        console.error("Join chat error:", error);
        socket.emit("error", "Failed to join chat");
      }
    });

    // Handle new messages
    socket.on("send-message", async (data) => {
      try {
        console.log("Received send-message event:", data);
        const { appointmentId, message } = data;

        if (!message || !message.trim()) {
          console.log("Empty message received");
          socket.emit("error", "Message cannot be empty");
          return;
        }

        console.log("Looking for chat with appointmentId:", appointmentId);
        // Find the chat
        let chat = await Chat.findOne({ appointmentId });

        if (!chat) {
          console.log("Chat not found for appointmentId:", appointmentId);
          socket.emit("error", "Chat not found");
          return;
        }

        console.log("Found chat:", {
          chatId: chat._id,
          doctorId: chat.doctorId.toString(),
          patientId: chat.patientId.toString(),
          socketUserId: socket.userId
        });

        // Verify user has access
        if (
          chat.doctorId.toString() !== socket.userId &&
          chat.patientId.toString() !== socket.userId
        ) {
          console.log("Unauthorized access attempt");
          socket.emit("error", "Unauthorized");
          return;
        }

        // Add new message
        const newMessage = {
          senderId: socket.userId,
          message: message.trim(),
          timestamp: new Date(),
        };

        chat.messages.push(newMessage);
        chat.lastUpdated = new Date();

        await chat.save();

        console.log(
          `Message sent in chat ${appointmentId} by user ${socket.userId}`
        );

        // Broadcast to all users in the chat room
        io.to(appointmentId).emit("new-message", {
          ...newMessage,
          senderType: socket.userType,
        });
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", "Failed to send message");
      }
    });

    // Handle typing indicators
    socket.on("typing-start", (appointmentId) => {
      socket.to(appointmentId).emit("user-typing", {
        userId: socket.userId,
        userType: socket.userType,
      });
    });

    socket.on("typing-stop", (appointmentId) => {
      socket.to(appointmentId).emit("user-stopped-typing", {
        userId: socket.userId,
      });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User ${socket.userId} disconnected`);
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  console.log("Socket.IO initialized successfully");
};
