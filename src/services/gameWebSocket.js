// WebSocket service for real-time multiplayer game

class GameWebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageHandlers = new Map();
    this.isConnected = false;
    this.challengeId = null;
    this.role = null;
  }

  // Connect to WebSocket server
  connect(wsUrl, challengeId, userId, role) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔌 Connecting to game server: ${wsUrl}`);
        console.log(`Challenge ID: ${challengeId}, Role: ${role}`);

        this.challengeId = challengeId;
        this.role = role;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ Connected to game server');
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Join the game
          this.send({
            type: 'join_game',
            challengeId,
            userId,
            role
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 Disconnected from game server');
          this.isConnected = false;
          this.attemptReconnect(wsUrl, challengeId, userId, role);
        };

      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        reject(error);
      }
    });
  }

  // Attempt to reconnect
  attemptReconnect(wsUrl, challengeId, userId, role) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.triggerHandler('connection_lost');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      this.connect(wsUrl, challengeId, userId, role)
        .catch(error => {
          console.error('Reconnection failed:', error);
        });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Handle incoming messages
  handleMessage(data) {
    console.log('📨 Received:', data.type);

    const handler = this.messageHandlers.get(data.type);
    if (handler) {
      handler(data);
    } else {
      console.warn('No handler for message type:', data.type);
    }
  }

  // Register message handler
  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  // Remove message handler
  off(messageType) {
    this.messageHandlers.delete(messageType);
  }

  // Trigger a handler
  triggerHandler(messageType, data = {}) {
    const handler = this.messageHandlers.get(messageType);
    if (handler) {
      handler(data);
    }
  }

  // Send message to server
  send(data) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not connected, cannot send message');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  // Send paddle movement
  sendPaddleMove(y, direction) {
    return this.send({
      type: 'paddle_move',
      y,
      direction
    });
  }

  // Start the game
  startGame() {
    return this.send({
      type: 'start_game'
    });
  }

  // Ping server
  ping() {
    return this.send({
      type: 'ping'
    });
  }

  // Disconnect from server
  disconnect() {
    if (this.ws) {
      console.log('🔌 Disconnecting from game server');
      this.isConnected = false;
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
      this.ws.close();
      this.ws = null;
    }
  }

  // Check connection status
  isConnectionOpen() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export default new GameWebSocketService();
