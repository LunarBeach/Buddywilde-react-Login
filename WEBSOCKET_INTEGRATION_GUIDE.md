# WebSocket Integration Guide for BuddyStarBonk Component

This guide explains how to integrate the WebSocket server with the existing BuddyStarBonk React component to enable real-time multiplayer gameplay.

## Overview

The integration involves:
1. Connecting to WebSocket server when a multiplayer game starts
2. Receiving authoritative game state from server (ball position, scores)
3. Sending paddle positions to server
4. Rendering received game state instead of running local physics

## Configuration

### 1. Add WebSocket URL to Environment

Create or update `.env` file in React project root:

```env
# Development
VITE_WS_URL=ws://localhost:8080

# Production (update when deploying)
# VITE_WS_URL=wss://buddywilde.com:8080
```

### 2. Import WebSocket Service

At the top of `buddyStarBonk.jsx`:

```javascript
import gameWebSocket from '../services/gameWebSocket';
```

## Key Changes to buddyStarBonk.jsx

### 1. Add WebSocket State Variables

Add these state variables after existing state declarations:

```javascript
const [isMultiplayerConnected, setIsMultiplayerConnected] = useState(false);
const [connectionError, setConnectionError] = useState(null);
const wsUrlRef = useRef(import.meta.env.VITE_WS_URL || 'ws://localhost:8080');
```

### 2. Modify startGameIntro Function

Update to connect to WebSocket for multiplayer games:

```javascript
const startGameIntro = async () => {
  // Reset game state
  resetGameState();

  const gv = gameVars.current;

  // For multiplayer, connect to WebSocket
  if (!gv.HUMAN_VS_COMPUTER && challengeId) {
    try {
      console.log('🎮 Connecting to multiplayer server...');

      // Determine role
      const role = gameMode === 'challenge' ? 'creator' : 'opponent';

      // Connect to WebSocket
      await gameWebSocket.connect(wsUrlRef.current, challengeId, user.id, role);

      setIsMultiplayerConnected(true);
      setupWebSocketHandlers();

      console.log('✅ Connected to multiplayer server');

    } catch (error) {
      console.error('❌ Failed to connect to multiplayer server:', error);
      setConnectionError('Failed to connect to game server');
      return;
    }
  }

  // Mobile fullscreen and orientation
  if (gv.isMobile) {
    const gameDiv = document.getElementById('star-bonk-game');
    if (gameDiv && gameDiv.requestFullscreen) {
      gameDiv.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
    }
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(err => console.log('Orientation lock error:', err));
    }
  }

  // Show intro video
  setShowingIntro(true);
};
```

### 3. Add WebSocket Message Handlers

Add this new function to handle WebSocket messages:

```javascript
const setupWebSocketHandlers = () => {
  const gv = gameVars.current;

  // Handle initial game state
  gameWebSocket.on('game_state', (data) => {
    console.log('📦 Received initial game state:', data);

    // Store game config from server
    gv.SERVER_CONFIG = data.config;
    gv.playerRole = data.role;

    // Update canvas size to match server
    if (canvasRef.current && data.config) {
      canvasRef.current.width = data.config.WIDTH;
      canvasRef.current.height = data.config.HEIGHT;
    }
  });

  // Handle game updates
  gameWebSocket.on('game_update', (data) => {
    // Update local state with server state
    const state = data.state;

    // Update ball position
    gv.ballX = state.ball.x;
    gv.ballY = state.ball.y;

    // Update paddle positions
    if (gv.playerRole === 'creator') {
      // We control left paddle, server updates right
      gv.rightPaddleY = state.paddles.right.y;
    } else {
      // We control right paddle, server updates left
      gv.leftPaddleY = state.paddles.left.y;
    }

    // Update scores
    gv.leftScoreRef = state.scores.left;
    gv.rightScoreRef = state.scores.right;
    setLeftScore(state.scores.left);
    setRightScore(state.scores.right);

    // Check if game is still running
    if (!state.gameRunning && gv.gameRunning) {
      gv.gameRunning = false;
    }
  });

  // Handle game over
  gameWebSocket.on('game_over', (data) => {
    console.log('🏁 Game over:', data);

    gv.gameRunning = false;
    setGameOver(true);

    // Determine if we won or lost
    const weAreLeft = gv.playerRole === 'creator';
    const weWon = (weAreLeft && data.winner === 'left') || (!weAreLeft && data.winner === 'right');

    setGameOverMessage(weWon ? 'WINNER' : 'LOSER');
    setIsWinner(weWon);
  });

  // Handle player disconnected
  gameWebSocket.on('player_disconnected', (data) => {
    console.log('👋 Player disconnected:', data);
    alert('Opponent disconnected from the game');
    showMenu();
  });

  // Handle connection lost
  gameWebSocket.on('connection_lost', () => {
    console.log('❌ Connection to server lost');
    alert('Lost connection to game server');
    showMenu();
  });

  // Handle errors
  gameWebSocket.on('error', (data) => {
    console.error('❌ Server error:', data.message);
    setConnectionError(data.message);
  });
};
```

### 4. Modify Game Loop for Multiplayer

Update the `gameLoop` function to handle multiplayer differently:

```javascript
const gameLoop = () => {
  const gv = gameVars.current;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');

  if (!canvas || !ctx || !gv.gameRunning) {
    return;
  }

  // For multiplayer, we only handle local paddle and send position to server
  if (!gv.HUMAN_VS_COMPUTER && isMultiplayerConnected) {
    handleMultiplayerLoop(ctx);
  } else {
    // Original single-player/AI logic
    handleSinglePlayerLoop(ctx);
  }

  gameLoopRef.current = requestAnimationFrame(gameLoop);
};

const handleMultiplayerLoop = (ctx) => {
  const gv = gameVars.current;

  // Handle local paddle movement
  if (gv.keys.w || gv.keys.ArrowUp) {
    const paddle = gv.playerRole === 'creator' ? 'left' : 'right';
    const paddleKey = paddle + 'PaddleY';

    gv[paddleKey] = Math.max(0, gv[paddleKey] - gv.PADDLE_SPEED);

    // Send paddle position to server
    gameWebSocket.sendPaddleMove(gv[paddleKey], 'up');
  }

  if (gv.keys.s || gv.keys.ArrowDown) {
    const paddle = gv.playerRole === 'creator' ? 'left' : 'right';
    const paddleKey = paddle + 'PaddleY';

    gv[paddleKey] = Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv[paddleKey] + gv.PADDLE_SPEED);

    // Send paddle position to server
    gameWebSocket.sendPaddleMove(gv[paddleKey], 'down');
  }

  // Render game (ball and paddles are updated via WebSocket)
  drawGame(ctx);
};

const handleSinglePlayerLoop = (ctx) => {
  // Original game loop logic for single-player/AI
  // Keep all existing physics code here
  // ...existing code...
};
```

### 5. Update showMenu Function

Disconnect from WebSocket when returning to menu:

```javascript
const showMenu = async () => {
  // Disconnect from WebSocket if connected
  if (isMultiplayerConnected) {
    gameWebSocket.disconnect();
    setIsMultiplayerConnected(false);
  }

  // ... rest of existing showMenu code ...
};
```

### 6. Add Connection Status Indicator

Add visual indicator in the UI during multiplayer:

```javascript
{/* Connection Status Indicator - show during multiplayer */}
{!gv.HUMAN_VS_COMPUTER && challengeId && (
  <div style={{
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(0,0,0,0.7)',
    padding: '10px 15px',
    borderRadius: '20px'
  }}>
    <div style={{
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: isMultiplayerConnected ? '#00ff00' : '#ff0000'
    }} />
    <span style={{ color: 'white', fontSize: '14px' }}>
      {isMultiplayerConnected ? 'Connected' : 'Connecting...'}
    </span>
  </div>
)}
```

## Testing

### Local Testing

1. **Start WebSocket Server**
   ```bash
   cd websocket-server
   npm start
   ```

2. **Start React Dev Server**
   ```bash
   npm run dev
   ```

3. **Test Multiplayer**
   - Open two browser windows
   - Log in as different users in each
   - Create challenge in window 1
   - Accept challenge in window 2
   - Both should connect and play the same game

### Production Deployment

1. Deploy WebSocket server to production (see websocket-server/README.md)
2. Update `VITE_WS_URL` in production environment
3. Rebuild React app with production config
4. Deploy React app

## Troubleshooting

### Connection Fails

- Check WebSocket server is running: `pm2 status`
- Check firewall allows port 8080
- Verify WebSocket URL is correct
- Check browser console for errors

### Game Lag

- Check server logs for performance issues
- Verify network latency (should be < 100ms)
- Consider reducing GAME_TICK_RATE if server is overloaded

### Paddle Not Moving

- Check WebSocket messages in browser console
- Verify paddle_move messages are being sent
- Check server logs for errors

## Next Steps

After integration:
1. Test thoroughly with multiple players
2. Monitor server performance
3. Adjust GAME_TICK_RATE if needed
4. Add analytics/monitoring
5. Consider adding reconnection UI improvements
