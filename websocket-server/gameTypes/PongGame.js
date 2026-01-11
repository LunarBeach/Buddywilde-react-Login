// Pong Game Logic - Isolated game type class

class PongGame {
  constructor(challengeId, config) {
    this.type = 'pong';
    this.challengeId = challengeId;
    this.config = config;

    this.state = {
      ball: {
        x: config.WIDTH / 2,
        y: config.HEIGHT / 2,
        vx: config.INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
        vy: config.INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
        size: config.BALL_SIZE
      },
      paddles: {
        left: {
          y: config.HEIGHT / 2 - config.PADDLE_HEIGHT / 2,
          height: config.PADDLE_HEIGHT,
          width: config.PADDLE_WIDTH
        },
        right: {
          y: config.HEIGHT / 2 - config.PADDLE_HEIGHT / 2,
          height: config.PADDLE_HEIGHT,
          width: config.PADDLE_WIDTH
        }
      },
      scores: {
        left: 0,
        right: 0
      },
      gameRunning: true,
      lastUpdate: Date.now()
    };

    this.players = new Map(); // playerId -> { role: 'left'|'right', userId, ws }
    this.loopInterval = null;
  }

  // Add player to game
  addPlayer(playerId, userId, role, ws) {
    this.players.set(playerId, { role, userId, ws });
    console.log(`Player ${playerId} joined pong game as ${role}`);
  }

  // Remove player from game
  removePlayer(playerId) {
    this.players.delete(playerId);
    console.log(`Player ${playerId} left pong game`);
  }

  // Get player count
  getPlayerCount() {
    return this.players.size;
  }

  // Update paddle position
  updatePaddle(playerId, y, direction) {
    const player = this.players.get(playerId);
    if (!player) return;

    const paddle = player.role === 'creator' ? 'left' : 'right';

    if (direction === 'up') {
      this.state.paddles[paddle].y = Math.max(0, this.state.paddles[paddle].y - this.config.PADDLE_SPEED);
    } else if (direction === 'down') {
      this.state.paddles[paddle].y = Math.min(
        this.config.HEIGHT - this.config.PADDLE_HEIGHT,
        this.state.paddles[paddle].y + this.config.PADDLE_SPEED
      );
    } else if (y !== undefined) {
      this.state.paddles[paddle].y = Math.max(
        0,
        Math.min(this.config.HEIGHT - this.config.PADDLE_HEIGHT, y)
      );
    }
  }

  // Reset ball to center
  resetBall() {
    this.state.ball.x = this.config.WIDTH / 2;
    this.state.ball.y = this.config.HEIGHT / 2;

    const angle = (Math.random() * Math.PI / 2) - Math.PI / 4;
    const direction = Math.random() > 0.5 ? 1 : -1;

    this.state.ball.vx = Math.cos(angle) * this.config.INITIAL_BALL_SPEED * direction;
    this.state.ball.vy = Math.sin(angle) * this.config.INITIAL_BALL_SPEED;
  }

  // Update game physics
  update() {
    if (!this.state.gameRunning) return;

    const ball = this.state.ball;
    const paddles = this.state.paddles;

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Ball collision with top/bottom walls
    if (ball.y <= 0 || ball.y >= this.config.HEIGHT) {
      ball.vy *= -1;
      ball.y = Math.max(0, Math.min(this.config.HEIGHT, ball.y));
    }

    // Ball collision with left paddle
    if (ball.x <= this.config.PADDLE_WIDTH &&
        ball.y >= paddles.left.y &&
        ball.y <= paddles.left.y + this.config.PADDLE_HEIGHT) {
      ball.vx = Math.abs(ball.vx);
      const hitPos = (ball.y - paddles.left.y) / this.config.PADDLE_HEIGHT;
      ball.vy += (hitPos - 0.5) * 3;

      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed < this.config.MAX_BALL_SPEED) {
        ball.vx *= 1.05;
        ball.vy *= 1.05;
      }
    }

    // Ball collision with right paddle
    if (ball.x >= this.config.WIDTH - this.config.PADDLE_WIDTH &&
        ball.y >= paddles.right.y &&
        ball.y <= paddles.right.y + this.config.PADDLE_HEIGHT) {
      ball.vx = -Math.abs(ball.vx);
      const hitPos = (ball.y - paddles.right.y) / this.config.PADDLE_HEIGHT;
      ball.vy += (hitPos - 0.5) * 3;

      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed < this.config.MAX_BALL_SPEED) {
        ball.vx *= 1.05;
        ball.vy *= 1.05;
      }
    }

    // Scoring
    if (ball.x < 0) {
      this.state.scores.right++;
      this.resetBall();
      this.checkWinCondition();
    } else if (ball.x > this.config.WIDTH) {
      this.state.scores.left++;
      this.resetBall();
      this.checkWinCondition();
    }
  }

  // Check win condition
  checkWinCondition() {
    if (this.state.scores.left >= this.config.WIN_SCORE ||
        this.state.scores.right >= this.config.WIN_SCORE) {
      this.state.gameRunning = false;
      return {
        winner: this.state.scores.left >= this.config.WIN_SCORE ? 'left' : 'right',
        scores: this.state.scores
      };
    }
    return null;
  }

  // Get current game state for clients
  getState() {
    return {
      ball: this.state.ball,
      paddles: this.state.paddles,
      scores: this.state.scores,
      gameRunning: this.state.gameRunning
    };
  }

  // Get full state for new connections
  getFullState() {
    return {
      ...this.state,
      type: this.type,
      challengeId: this.challengeId,
      config: this.config
    };
  }

  // Clean up resources
  destroy() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.players.clear();
  }
}

module.exports = PongGame;
