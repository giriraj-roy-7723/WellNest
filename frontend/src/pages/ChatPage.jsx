import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../utils/api";
import { getToken, isAuthenticated } from "../utils/auth";
import Navbar from "../components/Navbar.jsx";
import "../styles/ChatPage.css";

const ChatPage = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  // State management
  const [socket, setSocket] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Get user data from localStorage
  const authToken = getToken();
  const userId = localStorage.getItem("userId");
  const userRole = localStorage.getItem("userRole");
  const firstName = localStorage.getItem("firstName");
  const lastName = localStorage.getItem("lastName");

  // Initialize current user
  useEffect(() => {
    if (userId && userRole) {
      setCurrentUser({
        id: userId,
        name: `${firstName || ""} ${lastName || ""}`.trim() || "User",
        userType: userRole,
        email: "", // We can get this from profile if needed
      });
    }
  }, [userId, userRole, firstName, lastName]);

  // Fetch user's chats using your API utility
  const fetchChats = async () => {
    try {
      setError(null);
      const response = await api.get("/chat/my-chats");

      if (response.data.success) {
        setChats(response.data.data);
      } else {
        setError(response.data.message || "Failed to fetch chats");
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
      if (error.response?.status === 404) {
        setChats([]); // No chats found is ok
      } else {
        setError(error.response?.data?.message || "Failed to fetch chats");
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch specific chat history using your API
  const fetchChatHistory = async (appointmentId) => {
    try {
      const response = await api.get(
        `/chat/appointment/${appointmentId}?limit=50`
      );

      if (response.data.success) {
        setMessages(response.data.data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setError("Failed to load chat history");
    }
  };

  // Create chat using your API
  const createChat = async (appointmentId, doctorId, patientId) => {
    try {
      const response = await api.post("/chat/create", {
        appointmentId,
        doctorId,
        patientId,
      });

      if (response.data.success) {
        // Refresh chats list
        fetchChats();
        return response.data.data;
      }
    } catch (error) {
      console.error("Error creating chat:", error);
      setError("Failed to create chat");
    }
  };

  // Search messages using your API
  const searchMessages = async (appointmentId, searchTerm) => {
    try {
      const response = await api.get(
        `/chat/appointment/${appointmentId}/search?q=${encodeURIComponent(
          searchTerm
        )}`
      );

      if (response.data.success) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error("Error searching messages:", error);
      return [];
    }
  };

  // Initialize socket connection using your API base URL
  useEffect(() => {
    if (!isAuthenticated() || !currentUser) return;

    const socketInstance = io("http://localhost:5000", {
      auth: {
        token: authToken,
      },
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setError(null);
      console.log("Connected to chat server");
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from chat server");
    });

    socketInstance.on("connect_error", (error) => {
      setError("Failed to connect to chat server");
      console.error("Socket connection error:", error);
    });

    socketInstance.on("chat-history", (history) => {
      console.log("Chat history received:", history);
      setMessages(history);
    });

    socketInstance.on("chat-info", (info) => {
      console.log("Chat info received:", info);
    });

    socketInstance.on("new-message", (message) => {
      console.log("New message received:", message);
      setMessages((prev) => [...prev, message]);
    });

    socketInstance.on("user-typing", (data) => {
      if (data.userId !== currentUser.id) {
        setTypingUser(data);
      }
    });

    socketInstance.on("user-stopped-typing", (data) => {
      if (data.userId !== currentUser.id) {
        setTypingUser(null);
      }
    });

    socketInstance.on("error", (error) => {
      console.error("Socket error:", error);
      setError("Chat error: " + error);
    });

    setSocket(socketInstance);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socketInstance.disconnect();
    };
  }, [authToken, currentUser]);

  // Fetch chats on component mount
  useEffect(() => {
    if (isAuthenticated()) {
      fetchChats();
    }
  }, []);

  // Handle direct navigation to specific appointment chat
  useEffect(() => {
    if (appointmentId && socket && isConnected) {
      console.log("Joining chat for appointment:", appointmentId);
      
      // Try to join the specific chat
      socket.emit("join-chat", appointmentId);
      
      // Fetch chat history for this appointment
      fetchChatHistory(appointmentId);
      
      // Set this as the active chat
      setActiveChat({ appointmentId });
      
      // Try to create chat if it doesn't exist
      createChatForAppointment(appointmentId);
    } else {
      console.log("Cannot join chat:", { 
        hasAppointmentId: !!appointmentId, 
        hasSocket: !!socket, 
        isConnected 
      });
    }
  }, [appointmentId, socket, isConnected]);

  // Cleanup appointment data when component unmounts
  useEffect(() => {
    return () => {
      localStorage.removeItem('currentAppointment');
    };
  }, []);

  // Create chat for specific appointment
  const createChatForAppointment = async (appointmentId) => {
    try {
      console.log("Creating chat for appointment:", appointmentId);
      
      // Get appointment data from localStorage
      const appointmentData = localStorage.getItem('currentAppointment');
      if (appointmentData) {
        const appointment = JSON.parse(appointmentData);
        console.log("Appointment data from localStorage:", appointment);
        
        // Create chat with the actual doctorId and patientId
        if (appointment.doctorId && appointment.patientId) {
          console.log("Creating chat with doctorId:", appointment.doctorId, "patientId:", appointment.patientId);
          const chatResult = await createChat(appointmentId, appointment.doctorId, appointment.patientId);
          console.log("Chat creation result:", chatResult);
          
          // Set the active chat with proper info
          setActiveChat({
            _id: appointmentId,
            appointmentId: appointmentId,
            doctor: { name: appointment.doctorName },
            patient: { name: appointment.patientName }
          });
          
          // Refresh chats list
          await fetchChats();
        } else {
          console.error("Missing doctorId or patientId in appointment data");
        }
      } else {
        console.log("No appointment data in localStorage, trying fallback method");
        // Fallback to the old method if no appointment data
        const userResponse = await api.get("/profile/me");
        if (userResponse.data.success) {
          const user = userResponse.data.data.profile;
          console.log("User profile:", user);
          
          // Try to get doctor profile first
          try {
            const doctorResponse = await api.get("/doctor/profile");
            if (doctorResponse.data.success) {
              const doctorId = doctorResponse.data.data._id;
              await createChat(appointmentId, doctorId, doctorId);
            }
          } catch (doctorError) {
            try {
              const patientResponse = await api.get("/patient/profile");
              if (patientResponse.data.success) {
                const patientId = patientResponse.data.data._id;
                await createChat(appointmentId, patientId, patientId);
              }
            } catch (patientError) {
              console.error("Could not determine user type:", patientError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error creating chat for appointment:", error);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleChatSelect = async (chat) => {
    if (!socket) return;

    setActiveChat(chat);
    setMessages([]);
    setTypingUser(null);
    setError(null);

    const appointmentId = chat.appointmentId._id || chat.appointmentId;

    // Join the chat room via socket
    socket.emit("join-chat", appointmentId);

    // Also fetch history via API as backup
    await fetchChatHistory(appointmentId);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket || !activeChat) {
      console.log("Cannot send message:", { 
        hasMessage: !!newMessage.trim(), 
        hasSocket: !!socket, 
        hasActiveChat: !!activeChat 
      });
      return;
    }

    const appointmentId =
      activeChat.appointmentId._id || activeChat.appointmentId;

    console.log("Sending message:", {
      appointmentId,
      message: newMessage,
      socketConnected: socket.connected
    });

    socket.emit("send-message", {
      appointmentId,
      message: newMessage,
    });

    setNewMessage("");

    // Stop typing indicator
    if (isTyping) {
      socket.emit("typing-stop", appointmentId);
      setIsTyping(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!socket || !activeChat) return;

    const appointmentId =
      activeChat.appointmentId._id || activeChat.appointmentId;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing-start", appointmentId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing-stop", appointmentId);
    }, 1000);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return (
        "Yesterday " +
        date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } else {
      return (
        date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }) +
        " " +
        date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  };

  const isMyMessage = (message) => {
    return message.senderId === currentUser?.id;
  };

  const getOtherUser = (chat) => {
    if (!currentUser) return null;

    if (currentUser.userType === "doctor") {
      return chat.patient;
    } else {
      return chat.doctor;
    }
  };

  // Handle authentication check
  if (!isAuthenticated()) {
    return (
      <div className="auth-required-container">
        <div className="auth-required-card">
          <h2 className="auth-required-title">Authentication Required</h2>
          <p className="auth-required-text">
            Please log in to access the chat feature.
          </p>
          <button
            onClick={() => (window.location.href = "/signin")}
            className="auth-required-button"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading chats...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar onLogout={() => { localStorage.removeItem("token"); navigate("/signin"); }} />
      <div className="page-content">
        <div className="chat-container">
      {/* Error Message */}
      {error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            {error}
            <button onClick={() => setError(null)} className="error-close">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Sidebar - Chat List */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-content">
            <h2 className="sidebar-title">Messages</h2>
            <button onClick={fetchChats} className="refresh-button">
              Refresh
            </button>
          </div>
          <div
            className={`connection-status ${
              isConnected ? "connected" : "disconnected"
            }`}
          >
            {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
          </div>
        </div>

        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="empty-chats">
              <div className="empty-chats-icon">
                <svg
                  className="chat-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-3.582 9 8z"
                  />
                </svg>
              </div>
              <p>No chats available</p>
              <p className="empty-chats-subtitle">
                Chats will appear when you have appointments
              </p>
            </div>
          ) : (
            chats.map((chat) => {
              const otherUser = getOtherUser(chat);
              return (
                <div
                  key={chat._id}
                  onClick={() => handleChatSelect(chat)}
                  className={`chat-item ${
                    activeChat?._id === chat._id ? "active" : ""
                  }`}
                >
                  <div className="chat-item-content">
                    <div className="user-avatar">
                      {otherUser?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="chat-item-details">
                      <div className="chat-item-header">
                        <p className="user-name">
                          {otherUser?.name || "Unknown User"}
                        </p>
                        {chat.lastMessage && (
                          <p className="last-message-time">
                            {formatTimestamp(chat.lastMessage.timestamp)}
                          </p>
                        )}
                      </div>
                      <p className="appointment-date">
                        Appointment:{" "}
                        {chat.appointmentId?.date
                          ? new Date(
                              chat.appointmentId.date
                            ).toLocaleDateString()
                          : "No date"}
                      </p>
                      {chat.lastMessage ? (
                        <p className="last-message">
                          {chat.lastMessage.message}
                        </p>
                      ) : (
                        <p className="no-messages">No messages yet</p>
                      )}
                      {chat.messageCount > 0 && (
                        <div className="message-count-container">
                          <span className="message-count">
                            {chat.messageCount} messages
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="main-chat-area">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-content">
                {appointmentId && (
                  <button 
                    onClick={() => {
                      localStorage.removeItem('currentAppointment');
                      navigate("/my-appointments");
                    }}
                    className="back-button"
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "1.2rem",
                      cursor: "pointer",
                      marginRight: "1rem",
                      color: "#666"
                    }}
                  >
                    ← Back to Appointments
                  </button>
                )}
                <div className="chat-header-user">
                  <div className="chat-header-avatar">
                    {getOtherUser(activeChat)?.name?.charAt(0)?.toUpperCase() ||
                      "?"}
                  </div>
                  <div className="chat-header-info">
                    <h3 className="chat-header-name">
                      {getOtherUser(activeChat)?.name || "Unknown User"}
                    </h3>
                    <p className="chat-header-appointment">
                      Appointment:{" "}
                      {activeChat.appointmentId?.date
                        ? new Date(
                            activeChat.appointmentId.date
                          ).toLocaleDateString()
                        : "No date"}
                    </p>
                  </div>
                </div>
                <div className="chat-status">
                  <div
                    className={`status-indicator ${
                      isConnected ? "online" : "offline"
                    }`}
                  />
                  <span className="status-text">
                    {isConnected ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages-container">
                  <div className="no-messages-content">
                    <p className="no-messages-title">No messages yet</p>
                    <p className="no-messages-subtitle">
                      Start the conversation!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`message-wrapper ${
                      isMyMessage(message) ? "own-message" : "other-message"
                    }`}
                  >
                    <div
                      className={`message-bubble ${
                        isMyMessage(message) ? "own" : "other"
                      }`}
                    >
                      <p className="message-text">{message.message}</p>
                      <p className="message-timestamp">
                        {formatTimestamp(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {typingUser && (
                <div className="typing-indicator-wrapper">
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot typing-dot-delay-1"></div>
                      <div className="typing-dot typing-dot-delay-2"></div>
                    </div>
                    <p className="typing-text">
                      {typingUser.userType === "doctor" ? "Doctor" : "Patient"}{" "}
                      is typing...
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="message-input-container">
              <div className="message-input-wrapper">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSendMessage()
                  }
                  placeholder="Type your message..."
                  className="message-input"
                  disabled={!isConnected}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isConnected}
                  className="send-button"
                >
                  Send
                </button>
              </div>
              <div className="input-helper-text">Press Enter to send</div>
            </div>
          </>
        ) : (
          /* No Chat Selected */
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <div className="no-chat-icon">
                <svg
                  className="no-chat-svg"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="no-chat-title">Select a chat</h3>
              <p className="no-chat-subtitle">
                Choose a conversation to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
