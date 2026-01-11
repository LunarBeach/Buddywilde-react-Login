const WebSocket = require('ws');
const mysql = require('mysql2/promise');
require('dotenv').config();

const PongGame = require('./gameTypes/PongGame');
const CardGame = require('./gameTypes/CardGame');

const PORT = process.env.WS_PORT || 8080;
const GAME_TICK_RATE = parseInt(process.env.GAME_TICK_RATE) || 60;
const TICK_INTERVAL = 1000 / GAME_TICK_RATE;

// Database connection pool
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Game storage - supports multiple game types
const games = new Map(); // gameId -> Game instance (PongGame or CardGame)
const playerConnections = new Map(); // ws -> { playerId, userId, gameId, gameType }

// WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`🎮 BuddyWilde Multi-Game Server started on port ${PORT}`);
console.log(`⚡ Game tick rate: ${GAME_TICK_RATE} Hz`);

// Game configurations
const GAME_CONFIGS = {
  pong: {
    WIDTH: 800,
    HEIGHT: 600,
    PADDLE_WIDTH: 15,
    PADDLE_HEIGHT: 100,
    BALL_SIZE: 15,
    INITIAL_BALL_SPEED: 5,
    MAX_BALL_SPEED: 15,
    PADDLE_SPEED: 8,
    WIN_SCORE: 20
  },
  card: {
    MAX_PLAYERS: 4,
    MIN_PLAYERS: 2,
    DECK_SIZE: 52,
    HAND_SIZE: 7,
    // Add more card game specific config
  }
};

// Create game instance based on type
function createGame(gameId, gameType, additionalData = {}) {
  const config = GAME_CONFIGS[gameType];

  if (!config) {
    throw new Error(`Unknown game type: ${gameType}`);
  }

  let game;

  switch (gameType) {
    case 'pong':
      game = new PongGame(gameId, config);
      break;

    case 'card':
      game = new CardGame(gameId, config);
      break;

    default:
      throw new Error(`Unsupported game type: ${gameType}`);
  }

  console.log(`🎮 Created ${gameType} game with ID: ${gameId}`);
  return game;
}

// Start game loop for game types that need it
function startGameLoop(gameId, game) {
  if (game.type !== 'pong') return; // Only pong needs continuous updates

  if (game.loopInterval) return; // Already running

  game.loopInterval = setInterval(() => {
    game.update();

    // Broadcast state to all players
    broadcastToGame(gameId, {
      type: 'game_update',
      state: game.getState()
    });

    // Check for game over
    const result = game.checkWinCondition();
    if (result) {
      broadcastToGame(gameId, {
        type: 'game_over',
        winner: result.winner,
        scores: result.scores
      });

      updateGameResults(gameId, game.type, result);
      stopGameLoop(gameId);
    }
  }, TICK_INTERVAL);

  console.log(`🏁 Game loop started for ${game.type} game ${gameId}`);
}

// Stop game loop
function stopGameLoop(gameId) {
  const game = games.get(gameId);
  if (game && game.loopInterval) {
    clearInterval(game.loopInterval);
    game.loopInterval = null;
    console.log(`🛑 Game loop stopped for game ${gameId}`);
  }
}

// Update game results in database
async function updateGameResults(gameId, gameType, result) {
  try {
    if (gameType === 'pong') {
      await dbPool.query(
        'UPDATE challenges SET creator_score = ?, opponent_score = ?, status = ? WHERE id = ?',
        [result.scores.left, result.scores.right, 'finished', gameId]
      );
    } else if (gameType === 'card') {
      // TODO: Implement card game result storage
      console.log('Card game results:', result);
    }
  } catch (error) {
    console.error('Error updating game results:', error);
  }
}

// Broadcast message to all players in a game
function broadcastToGame(gameId, message) {
  playerConnections.forEach((playerInfo, ws) => {
    if (playerInfo.gameId === gameId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  const playerId = generatePlayerId();
  console.log(`🔌 New client connected: ${playerId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleMessage(ws, playerId, data);
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws, playerId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${playerId}:`, error);
  });
});

// Generate unique player ID
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Handle player disconnect
function handleDisconnect(ws, playerId) {
  const playerInfo = playerConnections.get(ws);

  if (playerInfo) {
    console.log(`👋 Player ${playerId} disconnected from ${playerInfo.gameType} game ${playerInfo.gameId}`);

    // Get game
    const game = games.get(playerInfo.gameId);

    if (game) {
      // Remove player from game
      game.removePlayer(playerId);

      // Notify other players
      broadcastToGame(playerInfo.gameId, {
        type: 'player_disconnected',
        playerId: playerId
      });

      // Clean up game if empty
      if (game.getPlayerCount() === 0) {
        stopGameLoop(playerInfo.gameId);
        game.destroy();
        games.delete(playerInfo.gameId);
        console.log(`🗑️  Game ${playerInfo.gameId} cleaned up`);
      }
    }

    playerConnections.delete(ws);
  }
}

// Handle incoming messages
async function handleMessage(ws, playerId, data) {
  switch (data.type) {
    case 'join_game':
      await handleJoinGame(ws, playerId, data);
      break;

    case 'paddle_move': // Pong specific
      handlePaddleMove(ws, playerId, data);
      break;

    case 'player_action': // Card game specific
      handlePlayerAction(ws, playerId, data);
      break;

    case 'player_ready':
      handlePlayerReady(ws, playerId, data);
      break;

    case 'start_game':
      handleStartGame(ws, playerId, data);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    default:
      console.warn('Unknown message type:', data.type);
  }
}

// Handle player joining a game
async function handleJoinGame(ws, playerId, data) {
  const { gameId, userId, gameType, role } = data;

  console.log(`👤 User ${userId} (${playerId}) joining ${gameType} game ${gameId}`);

  try {
    // Verify game exists in database
    let dbGame;

    if (gameType === 'pong') {
      const [rows] = await dbPool.query(
        'SELECT * FROM challenges WHERE id = ? AND status = ?',
        [gameId, 'active']
      );

      if (rows.length === 0) {
        throw new Error('Challenge not found or not active');
      }
      dbGame = rows[0];
    } else if (gameType === 'card') {
      // TODO: Query card_games table when implemented
      throw new Error('Card game support coming soon');
    }

    // Create or get game instance
    if (!games.has(gameId)) {
      const game = createGame(gameId, gameType, dbGame);
      games.set(gameId, game);
    }

    const game = games.get(gameId);

    // Add player to game
    game.addPlayer(playerId, userId, role, ws);

    // Store player connection
    playerConnections.set(ws, { playerId, userId, gameId, gameType });

    // Send initial game state
    ws.send(JSON.stringify({
      type: 'game_state',
      state: game.getFullState(),
      playerId: playerId,
      role: role
    }));

    // Notify other players
    broadcastToGame(gameId, {
      type: 'player_joined',
      playerId: playerId,
      playerCount: game.getPlayerCount()
    });

    // For pong, start game loop when both players connected
    if (gameType === 'pong' && game.getPlayerCount() === 2) {
      startGameLoop(gameId, game);
    }

  } catch (error) {
    console.error('Error joining game:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

// Handle paddle movement (Pong)
function handlePaddleMove(ws, playerId, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo || playerInfo.gameType !== 'pong') return;

  const game = games.get(playerInfo.gameId);
  if (!game) return;

  game.updatePaddle(playerId, data.y, data.direction);
}

// Handle player action (Card game)
function handlePlayerAction(ws, playerId, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo || playerInfo.gameType !== 'card') return;

  const game = games.get(playerInfo.gameId);
  if (!game) return;

  game.handlePlayerAction(playerId, data.action);

  // Broadcast updated state
  broadcastToGame(playerInfo.gameId, {
    type: 'game_update',
    state: game.getState()
  });
}

// Handle player ready status
function handlePlayerReady(ws, playerId, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo) return;

  const game = games.get(playerInfo.gameId);
  if (!game) return;

  if (game.type === 'card') {
    game.setPlayerReady(playerId, data.ready);

    broadcastToGame(playerInfo.gameId, {
      type: 'player_ready_update',
      playerId: playerId,
      ready: data.ready,
      allReady: game.allPlayersReady()
    });
  }
}

// Handle game start
function handleStartGame(ws, playerId, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo) return;

  const game = games.get(playerInfo.gameId);
  if (!game) return;

  console.log(`🏁 Game start requested for ${game.type} game ${playerInfo.gameId}`);

  if (game.type === 'pong') {
    game.state.scores.left = 0;
    game.state.scores.right = 0;
    game.resetBall();
    game.state.gameRunning = true;
  } else if (game.type === 'card') {
    game.startGame();
  }

  // Notify all players
  broadcastToGame(playerInfo.gameId, {
    type: 'game_started',
    state: game.getFullState()
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');

  // Stop all game loops
  games.forEach((game, gameId) => {
    stopGameLoop(gameId);
    game.destroy();
  });

  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.close();
  });

  // Close database pool
  dbPool.end().then(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

console.log('✅ Server ready to accept connections');
console.log('📦 Supported game types: pong, card');
