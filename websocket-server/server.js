const WebSocket = require('ws');
const mysql = require('mysql2/promise');
require('dotenv').config();

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

// Game state storage
const games = new Map(); // challengeId -> gameState
const playerConnections = new Map(); // ws -> { userId, challengeId, role }

// WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`🎮 BuddyWilde Game Server started on port ${PORT}`);
console.log(`⚡ Game tick rate: ${GAME_TICK_RATE} Hz`);

// Game physics constants
const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  PADDLE_WIDTH: 15,
  PADDLE_HEIGHT: 100,
  PADDLE_OFFSET: 0.05, // 5% from edge, same as client
  BALL_SIZE: 15,
  BALL_RADIUS: 50, // Ball radius for collision (PADDLE_HEIGHT / 2)
  INITIAL_BALL_SPEED: 5,
  MAX_BALL_SPEED: 15,
  PADDLE_SPEED: 8,
  WIN_SCORE: 20
};

// Initialize game state
function createGameState(challengeId, creatorId, opponentId) {
  return {
    challengeId,
    creatorId,
    opponentId,
    ball: {
      x: GAME_CONFIG.WIDTH / 2,
      y: GAME_CONFIG.HEIGHT / 2,
      vx: GAME_CONFIG.INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
      vy: GAME_CONFIG.INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
      size: GAME_CONFIG.BALL_SIZE
    },
    paddles: {
      left: {
        y: GAME_CONFIG.HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2,
        height: GAME_CONFIG.PADDLE_HEIGHT,
        width: GAME_CONFIG.PADDLE_WIDTH
      },
      right: {
        y: GAME_CONFIG.HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2,
        height: GAME_CONFIG.PADDLE_HEIGHT,
        width: GAME_CONFIG.PADDLE_WIDTH
      }
    },
    scores: {
      left: 0,
      right: 0
    },
    gameRunning: false, // Don't start until both players ready
    gameStarted: false, // Track if intro has played
    playersReady: {
      creator: false,
      opponent: false
    },
    lastUpdate: Date.now()
  };
}

// Reset ball to center
function resetBall(game) {
  game.ball.x = GAME_CONFIG.WIDTH / 2;
  game.ball.y = GAME_CONFIG.HEIGHT / 2;

  // Random direction
  const angle = (Math.random() * Math.PI / 2) - Math.PI / 4; // -45 to 45 degrees
  const direction = Math.random() > 0.5 ? 1 : -1;

  game.ball.vx = Math.cos(angle) * GAME_CONFIG.INITIAL_BALL_SPEED * direction;
  game.ball.vy = Math.sin(angle) * GAME_CONFIG.INITIAL_BALL_SPEED;
}

// Update game physics
function updateGame(game) {
  if (!game.gameRunning) return;

  const ball = game.ball;
  const paddles = game.paddles;

  // Store previous ball direction to detect collisions
  const prevVx = ball.vx;

  // Move ball
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Ball collision with top/bottom walls
  if (ball.y <= 0 || ball.y >= GAME_CONFIG.HEIGHT) {
    ball.vy *= -1;
    ball.y = Math.max(0, Math.min(GAME_CONFIG.HEIGHT, ball.y));
  }

  // Calculate paddle positions (matching client's 5% offset from edge)
  const paddleOffset = GAME_CONFIG.WIDTH * GAME_CONFIG.PADDLE_OFFSET;
  const leftPaddleX = paddleOffset;
  const rightPaddleX = GAME_CONFIG.WIDTH - GAME_CONFIG.PADDLE_WIDTH - paddleOffset;

  // Ball collision with left paddle
  // Check if ball's left edge is touching paddle's right edge, and ball is within paddle Y range
  if (ball.x <= leftPaddleX + GAME_CONFIG.PADDLE_WIDTH &&
      ball.x >= leftPaddleX &&
      ball.y >= paddles.left.y &&
      ball.y <= paddles.left.y + GAME_CONFIG.PADDLE_HEIGHT &&
      prevVx < 0) {

    ball.vx = Math.abs(ball.vx);
    ball.x = leftPaddleX + GAME_CONFIG.PADDLE_WIDTH + 1; // Prevent ball from getting stuck

    // Add spin based on where ball hit paddle
    const hitPos = (ball.y - paddles.left.y) / GAME_CONFIG.PADDLE_HEIGHT;
    ball.vy += (hitPos - 0.5) * 3;

    // Increase speed slightly
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed < GAME_CONFIG.MAX_BALL_SPEED) {
      ball.vx *= 1.05;
      ball.vy *= 1.05;
    }

    // Broadcast paddle hit event for sound
    broadcastToGame(game.challengeId, {
      type: 'paddle_hit',
      paddle: 'left'
    });
  }

  // Ball collision with right paddle
  // Check if ball's right edge is touching paddle's left edge, and ball is within paddle Y range
  if (ball.x >= rightPaddleX &&
      ball.x <= rightPaddleX + GAME_CONFIG.PADDLE_WIDTH &&
      ball.y >= paddles.right.y &&
      ball.y <= paddles.right.y + GAME_CONFIG.PADDLE_HEIGHT &&
      prevVx > 0) {

    ball.vx = -Math.abs(ball.vx);
    ball.x = rightPaddleX - 1; // Prevent ball from getting stuck

    // Add spin based on where ball hit paddle
    const hitPos = (ball.y - paddles.right.y) / GAME_CONFIG.PADDLE_HEIGHT;
    ball.vy += (hitPos - 0.5) * 3;

    // Increase speed slightly
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed < GAME_CONFIG.MAX_BALL_SPEED) {
      ball.vx *= 1.05;
      ball.vy *= 1.05;
    }

    // Broadcast paddle hit event for sound
    broadcastToGame(game.challengeId, {
      type: 'paddle_hit',
      paddle: 'right'
    });
  }

  // Scoring - ball must pass the paddle position (not just edge of screen)
  if (ball.x < leftPaddleX) {
    // Right player scores (ball passed left paddle)
    game.scores.right++;
    console.log(`⚽ SCORE! Right player scores. Current: Left=${game.scores.left}, Right=${game.scores.right}`);
    resetBall(game);
    checkWinCondition(game);
  } else if (ball.x > rightPaddleX + GAME_CONFIG.PADDLE_WIDTH) {
    // Left player scores (ball passed right paddle)
    game.scores.left++;
    console.log(`⚽ SCORE! Left player scores. Current: Left=${game.scores.left}, Right=${game.scores.right}`);
    resetBall(game);
    checkWinCondition(game);
  }
}

// Check win condition
function checkWinCondition(game) {
  if (game.scores.left >= GAME_CONFIG.WIN_SCORE || game.scores.right >= GAME_CONFIG.WIN_SCORE) {
    game.gameRunning = false;

    // Notify clients of game over
    broadcastToGame(game.challengeId, {
      type: 'game_over',
      winner: game.scores.left >= GAME_CONFIG.WIN_SCORE ? 'left' : 'right',
      scores: game.scores
    });

    // Update database
    updateChallengeScores(game);
  }
}

// Update challenge scores in database
async function updateChallengeScores(game) {
  try {
    // Determine winner (creator = left, opponent = right)
    const winnerId = game.scores.left >= GAME_CONFIG.WIN_SCORE ? game.creatorId : game.opponentId;

    await dbPool.query(
      'UPDATE challenges SET creator_score = ?, opponent_score = ?, winner_id = ?, status = ?, ended_at = NOW() WHERE id = ?',
      [game.scores.left, game.scores.right, winnerId, 'finished', game.challengeId]
    );
    console.log(`✅ Challenge ${game.challengeId} finished. Winner: ${winnerId}`);
  } catch (error) {
    console.error('Error updating challenge scores:', error);
  }
}

// Broadcast message to all players in a game
function broadcastToGame(challengeId, message) {
  playerConnections.forEach((playerInfo, ws) => {
    if (playerInfo.challengeId === challengeId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('🔌 New client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleMessage(ws, data);
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    const playerInfo = playerConnections.get(ws);
    if (playerInfo) {
      console.log(`👋 Player disconnected from challenge ${playerInfo.challengeId}`);

      // Notify other player
      broadcastToGame(playerInfo.challengeId, {
        type: 'player_disconnected',
        role: playerInfo.role
      });

      // Clean up game if both players gone
      const game = games.get(playerInfo.challengeId);
      if (game) {
        const activePlayers = Array.from(playerConnections.values())
          .filter(p => p.challengeId === playerInfo.challengeId);

        if (activePlayers.length === 1) {
          games.delete(playerInfo.challengeId);
          console.log(`🗑️  Game ${playerInfo.challengeId} cleaned up`);
        }
      }

      playerConnections.delete(ws);
    }
  });
});

// Handle incoming messages
async function handleMessage(ws, data) {
  switch (data.type) {
    case 'join_game':
      await handleJoinGame(ws, data);
      break;

    case 'player_ready':
      handlePlayerReady(ws, data);
      break;

    case 'paddle_move':
      handlePaddleMove(ws, data);
      break;

    case 'intro_complete':
      handleIntroComplete(ws, data);
      break;

    case 'start_game':
      handleStartGame(ws, data);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    default:
      console.warn('Unknown message type:', data.type);
  }
}

// Handle player joining a game
async function handleJoinGame(ws, data) {
  const { challengeId, userId, role } = data;

  console.log(`👤 User ${userId} joining challenge ${challengeId} as ${role}`);

  // Verify challenge exists in database
  try {
    const [rows] = await dbPool.query(
      'SELECT * FROM challenges WHERE id = ? AND status = ?',
      [challengeId, 'active']
    );

    if (rows.length === 0) {
      ws.send(JSON.stringify({ type: 'error', message: 'Challenge not found or not active' }));
      return;
    }

    const challenge = rows[0];

    // Store player connection
    playerConnections.set(ws, { userId, challengeId, role });

    // Create or get game state
    if (!games.has(challengeId)) {
      const game = createGameState(challengeId, challenge.creator_id, challenge.opponent_id);
      games.set(challengeId, game);
      console.log(`🎮 New game created for challenge ${challengeId}`);
    }

    const game = games.get(challengeId);

    // Send initial game state
    ws.send(JSON.stringify({
      type: 'game_state',
      state: game,
      role: role,
      config: GAME_CONFIG
    }));

    // Notify other player
    broadcastToGame(challengeId, {
      type: 'player_joined',
      role: role
    });

    // Check if both players connected
    const connectedPlayers = Array.from(playerConnections.values())
      .filter(p => p.challengeId === challengeId);

    if (connectedPlayers.length === 2) {
      console.log(`✅ Both players connected for challenge ${challengeId}`);
      // Don't start game loop yet - wait for both players to click READY
      broadcastToGame(challengeId, {
        type: 'both_connected'
      });
    }

  } catch (error) {
    console.error('Error joining game:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to join game' }));
  }
}

// Handle player clicking READY
function handlePlayerReady(ws, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo) return;

  const game = games.get(playerInfo.challengeId);
  if (!game) return;

  // Mark this player as ready
  game.playersReady[playerInfo.role] = true;
  console.log(`✅ Player ${playerInfo.role} is ready for challenge ${playerInfo.challengeId}`);

  // Notify the other player that this player is ready
  broadcastToGame(playerInfo.challengeId, {
    type: 'opponent_ready',
    role: playerInfo.role
  });

  // Check if both players are ready
  if (game.playersReady.creator && game.playersReady.opponent) {
    console.log(`🎬 Both players ready! Starting intro for challenge ${playerInfo.challengeId}`);

    // Tell both clients to start the intro video simultaneously
    broadcastToGame(playerInfo.challengeId, {
      type: 'start_intro',
      timestamp: Date.now()
    });
  }
}

// Handle intro video complete - start the actual game
function handleIntroComplete(ws, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo) return;

  const game = games.get(playerInfo.challengeId);
  if (!game) return;

  // Track which players have finished intro
  if (!game.introComplete) {
    game.introComplete = { creator: false, opponent: false };
  }
  game.introComplete[playerInfo.role] = true;

  console.log(`🎬 Player ${playerInfo.role} finished intro for challenge ${playerInfo.challengeId}`);

  // When both have finished intro, start the game loop
  if (game.introComplete.creator && game.introComplete.opponent && !game.loopInterval) {
    console.log(`🏁 Both intros complete! Starting game for challenge ${playerInfo.challengeId}`);

    game.gameRunning = true;
    game.gameStarted = true;
    resetBall(game);

    // Tell both clients the game is starting
    broadcastToGame(playerInfo.challengeId, {
      type: 'game_started',
      state: {
        ball: game.ball,
        paddles: game.paddles,
        scores: game.scores
      }
    });

    // Start the game loop
    game.loopInterval = setInterval(() => {
      updateGame(game);

      // Broadcast state to all players with NORMALIZED coordinates (0-1 range)
      // This allows clients with different canvas sizes to scale appropriately
      broadcastToGame(playerInfo.challengeId, {
        type: 'game_update',
        state: {
          ball: {
            x: game.ball.x / GAME_CONFIG.WIDTH,
            y: game.ball.y / GAME_CONFIG.HEIGHT,
            vx: game.ball.vx / GAME_CONFIG.WIDTH,
            vy: game.ball.vy / GAME_CONFIG.HEIGHT
          },
          paddles: {
            left: { y: game.paddles.left.y / GAME_CONFIG.HEIGHT },
            right: { y: game.paddles.right.y / GAME_CONFIG.HEIGHT }
          },
          scores: game.scores,
          gameRunning: game.gameRunning
        }
      });
    }, TICK_INTERVAL);

    console.log(`🎮 Game loop started for challenge ${playerInfo.challengeId}`);
  }
}

// Handle paddle movement
function handlePaddleMove(ws, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo) return;

  const game = games.get(playerInfo.challengeId);
  if (!game) return;

  const { y, direction } = data;

  // Convert normalized y (0-1) to server coordinates if provided
  const serverY = y !== undefined ? y * GAME_CONFIG.HEIGHT : undefined;

  // Update paddle position
  if (playerInfo.role === 'creator') {
    // Creator controls left paddle
    if (direction === 'up') {
      game.paddles.left.y = Math.max(0, game.paddles.left.y - GAME_CONFIG.PADDLE_SPEED);
    } else if (direction === 'down') {
      game.paddles.left.y = Math.min(
        GAME_CONFIG.HEIGHT - GAME_CONFIG.PADDLE_HEIGHT,
        game.paddles.left.y + GAME_CONFIG.PADDLE_SPEED
      );
    } else if (serverY !== undefined) {
      // Direct position update (from normalized coordinates)
      game.paddles.left.y = Math.max(0, Math.min(GAME_CONFIG.HEIGHT - GAME_CONFIG.PADDLE_HEIGHT, serverY));
    }
  } else if (playerInfo.role === 'opponent') {
    // Opponent controls right paddle
    if (direction === 'up') {
      game.paddles.right.y = Math.max(0, game.paddles.right.y - GAME_CONFIG.PADDLE_SPEED);
    } else if (direction === 'down') {
      game.paddles.right.y = Math.min(
        GAME_CONFIG.HEIGHT - GAME_CONFIG.PADDLE_HEIGHT,
        game.paddles.right.y + GAME_CONFIG.PADDLE_SPEED
      );
    } else if (serverY !== undefined) {
      // Direct position update (from normalized coordinates)
      game.paddles.right.y = Math.max(0, Math.min(GAME_CONFIG.HEIGHT - GAME_CONFIG.PADDLE_HEIGHT, serverY));
    }
  }
}

// Handle game start
function handleStartGame(ws, data) {
  const playerInfo = playerConnections.get(ws);
  if (!playerInfo) return;

  const game = games.get(playerInfo.challengeId);
  if (!game) return;

  console.log(`🏁 Game start requested for challenge ${playerInfo.challengeId}`);

  // Reset game state
  game.scores.left = 0;
  game.scores.right = 0;
  resetBall(game);
  game.gameRunning = true;

  // Notify all players
  broadcastToGame(playerInfo.challengeId, {
    type: 'game_started',
    state: game
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');

  // Clear all game loops
  games.forEach((game) => {
    if (game.loopInterval) {
      clearInterval(game.loopInterval);
    }
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
