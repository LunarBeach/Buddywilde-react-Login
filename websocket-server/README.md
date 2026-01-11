# BuddyWilde Game WebSocket Server

Real-time multiplayer game server for BuddyWilde pong game using WebSockets.

## Features

- Real-time ball physics simulation
- Server-authoritative game state
- Automatic reconnection handling
- 60 FPS game tick rate
- MySQL database integration for persistent scores

## Setup Instructions

### Local Development

1. **Install Dependencies**
   ```bash
   cd websocket-server
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your database credentials:
   ```env
   WS_PORT=8080
   DB_HOST=localhost
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASS=your_database_password
   ```

3. **Run the Server**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

### Production Deployment (Plesk)

1. **Install Node.js in Plesk**
   - Go to Plesk Panel
   - Navigate to "Node.js" section
   - Install Node.js (v18 or higher recommended)

2. **Upload Server Files**
   - Upload the entire `websocket-server` folder to your server
   - Place it outside the public web directory (e.g., `/var/www/vhosts/buddywilde.com/websocket-server/`)

3. **Install Dependencies via SSH**
   ```bash
   cd /path/to/websocket-server
   npm install --production
   ```

4. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update with production values:
   ```env
   WS_PORT=8080
   DB_HOST=localhost
   DB_NAME=production_db_name
   DB_USER=production_db_user
   DB_PASS=production_db_password
   ALLOWED_ORIGINS=https://buddywilde.com
   ```

5. **Run as PM2 Process (Recommended)**

   Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

   Start the server:
   ```bash
   pm2 start server.js --name "buddywilde-game-server"
   pm2 save
   pm2 startup
   ```

   Monitor the server:
   ```bash
   pm2 logs buddywilde-game-server
   pm2 status
   ```

6. **Configure Firewall**
   - Open port 8080 (or your chosen port) in Plesk firewall
   - If using Cloudflare, add a firewall rule to allow WebSocket connections

7. **Update React App Configuration**

   In your React app, update the WebSocket URL:
   ```javascript
   // For production
   const WS_URL = 'wss://buddywilde.com:8080';

   // For development
   const WS_URL = 'ws://localhost:8080';
   ```

## Troubleshooting

### Connection Issues

1. **Check if server is running**
   ```bash
   pm2 status
   ```

2. **View server logs**
   ```bash
   pm2 logs buddywilde-game-server --lines 100
   ```

3. **Test WebSocket connection**
   ```bash
   # Install wscat
   npm install -g wscat

   # Test connection
   wscat -c ws://localhost:8080
   ```

### Database Issues

1. **Verify database credentials**
   ```bash
   mysql -u username -p database_name
   ```

2. **Check database connection in logs**
   ```bash
   pm2 logs buddywilde-game-server | grep "database"
   ```

## Game Protocol

### Client -> Server Messages

```javascript
// Join game
{
  type: 'join_game',
  challengeId: 123,
  userId: 456,
  role: 'creator' | 'opponent'
}

// Move paddle
{
  type: 'paddle_move',
  y: 250,  // Absolute position
  direction: 'up' | 'down'  // Or direction
}

// Start game
{
  type: 'start_game'
}

// Ping
{
  type: 'ping'
}
```

### Server -> Client Messages

```javascript
// Initial game state
{
  type: 'game_state',
  state: { ball, paddles, scores, ... },
  role: 'creator' | 'opponent',
  config: { WIDTH, HEIGHT, ... }
}

// Game update (60 times per second)
{
  type: 'game_update',
  state: { ball, paddles, scores, gameRunning }
}

// Game over
{
  type: 'game_over',
  winner: 'left' | 'right',
  scores: { left: 20, right: 15 }
}

// Player events
{
  type: 'player_joined',
  role: 'creator' | 'opponent'
}

{
  type: 'player_disconnected',
  role: 'creator' | 'opponent'
}

// Errors
{
  type: 'error',
  message: 'Error description'
}
```

## Performance

- **Game Tick Rate**: 60 FPS (configurable)
- **Network Update Rate**: 60 updates/second
- **Expected Latency**: 20-100ms depending on connection
- **Memory Usage**: ~50MB per game instance
- **CPU Usage**: Minimal (~1% per game on modern server)

## Security Considerations

1. **Authentication**: Currently validates challenge exists in database
2. **Rate Limiting**: Consider adding rate limiting for production
3. **CORS**: Configure allowed origins in `.env`
4. **SSL/TLS**: Use `wss://` (WebSocket Secure) in production

## Future Improvements

- [ ] Add player authentication tokens
- [ ] Implement spectator mode
- [ ] Add game replays
- [ ] Implement rate limiting
- [ ] Add metrics and monitoring
- [ ] Support for multiple game types
