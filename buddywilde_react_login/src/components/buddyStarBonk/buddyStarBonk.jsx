import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './buddyStarBonk.css';

const BuddyStarBonk = ({ user, isLoggedIn, onScoreSubmitted }) => {
  const navigate = useNavigate();

  // Game states
  const STATE_MENU = 'menu';
  const STATE_PLAYING = 'playing';
  const STATE_CHALLENGE_LIST = 'challenge_list';
  const STATE_RULES = 'rules';

  // State management
  const [currentState, setCurrentState] = useState(STATE_MENU);
  const [gameMode, setGameMode] = useState('solo');
  const [challengeId, setChallengeId] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [leftScore, setLeftScore] = useState(0);
  const [rightScore, setRightScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState('');

  // Debug logging
  useEffect(() => {
    console.log('BuddyStarBonk mounted - isLoggedIn:', isLoggedIn, 'user:', user);
    console.log('Initial state:', currentState);
  }, []);

  // Log state changes
  useEffect(() => {
    console.log('State changed to:', currentState);
  }, [currentState]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn || !user) {
      console.log('Not logged in, redirecting to home');
      navigate('/');
    } else {
      console.log('User is logged in, showing game');
    }
  }, [isLoggedIn, user, navigate]);

  // Initialize game when entering PLAYING state
  useEffect(() => {
    if (currentState === STATE_PLAYING && canvasRef.current && gamePlayWindowRef.current) {
      console.log('State changed to PLAYING - initializing canvas and starting game loop');

      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        initializeCanvas();
        resetBall();

        const gv = gameVars.current;

        // Start paddle animation
        gv.isPaddleAnimating = true;
        gv.paddleAnimationProgress = 0;
        gv.ballLaunched = false;

        // Play start sound with fade-in
        audioRefs.current.start.volume = 0;
        audioRefs.current.start.play().catch(e => console.log('Start sound play failed:', e));
        let fadeStart = performance.now();
        const PADDLE_ANIMATION_DURATION = 2000;
        function fadeIn() {
          let progress = (performance.now() - fadeStart) / PADDLE_ANIMATION_DURATION;
          audioRefs.current.start.volume = Math.min(1, progress);
          if (progress < 1) {
            requestAnimationFrame(fadeIn);
          } else {
            audioRefs.current.start.volume = 1;
          }
        }
        requestAnimationFrame(fadeIn);

        // Start background sound
        audioRefs.current.background.volume = 0.5;
        audioRefs.current.background.play().catch(e => console.log('Background sound play failed:', e));

        gv.gameRunning = true;
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }, 100);
    }
  }, [currentState]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (currentState === STATE_PLAYING && canvasRef.current && gamePlayWindowRef.current) {
        console.log('Window resized - reinitializing canvas');
        initializeCanvas();
        // Reposition ball and paddles proportionally
        const gv = gameVars.current;
        gv.leftPaddleY = Math.min(gv.leftPaddleY, gv.HEIGHT - gv.PADDLE_HEIGHT);
        gv.rightPaddleY = Math.min(gv.rightPaddleY, gv.HEIGHT - gv.PADDLE_HEIGHT);
        gv.ballX = Math.min(Math.max(gv.ballX, 0), gv.WIDTH);
        gv.ballY = Math.min(Math.max(gv.ballY, 0), gv.HEIGHT);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentState]);

  // Refs
  const canvasRef = useRef(null);
  const gamePlayWindowRef = useRef(null);
  const backgroundVideoRef = useRef(null);
  const gameLoopRef = useRef(null);
  const challengePollingRef = useRef(null);

  // Audio refs
  const audioRefs = useRef({
    paddleStrike: null,
    start: null,
    background: null,
    doubleBonk: null,
    tripleBonk: null,
    streak1: null,
    streak2: null,
    streak3: null,
    loseStreak2: null,
    loseStreak4: null
  });

  // Game variables (using refs to persist across renders)
  const gameVars = useRef({
    WIDTH: 0,
    HEIGHT: 0,
    ctx: null,
    gameRunning: false,
    lastTime: 0,
    paddleAnimationProgress: 0,
    isPaddleAnimating: false,
    ballLaunched: false,
    PADDLE_WIDTH: 10,
    PADDLE_HEIGHT: 0,
    leftPaddleY: 0,
    rightPaddleY: 0,
    leftPaddleX: 0,
    rightPaddleX: 0,
    leftPaddleXStart: 0,
    rightPaddleXStart: 0,
    ballX: 0,
    ballY: 0,
    ballSpeedX: 0,
    ballSpeedY: 0,
    ballAngle: 0,
    rotation: 0,
    ballOpacity: 0.7,
    ballBlur: 2,
    blurDirection: 1,
    opacityDirection: 1,
    BALL_RADIUS: 0,
    leftStreak: 0,
    rightStreak: 0,
    leftLoseStreak: 0,
    rightLoseStreak: 0,
    HUMAN_VS_COMPUTER: true,
    keys: {},
    isMobile: /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768,
    smoothedGamma: 0,
    // Track scores in refs for immediate access in game loop
    leftScoreRef: 0,
    rightScoreRef: 0,
    totalPointsRef: 0
  });

  const PADDLE_ANIMATION_DURATION = 2000;
  const SMOOTHING_FACTOR = 0.5;
  const ASSET_BASE = 'https://buddywilde.com/wp-content/themes/buddy_wilde_theme/assets/star-bonk-assets';

  // Initialize audio on component mount
  useEffect(() => {
    audioRefs.current = {
      paddleStrike: new Audio(`${ASSET_BASE}/gronk_bonk_paddle_strike.wav`),
      start: new Audio(`${ASSET_BASE}/rocket_sound.wav`),
      background: new Audio(`${ASSET_BASE}/deepspace_gronk_bonk.wav`),
      doubleBonk: new Audio(`${ASSET_BASE}/double_BONK.wav`),
      tripleBonk: new Audio(`${ASSET_BASE}/triple_BONK.wav`),
      streak1: new Audio(`${ASSET_BASE}/great_bonking_GRONK.wav`),
      streak2: new Audio(`${ASSET_BASE}/ur_a_true_HERO.wav`),
      streak3: new Audio(`${ASSET_BASE}/WOW.wav`),
      loseStreak2: new Audio(`${ASSET_BASE}/bonk_more_STARS.wav`),
      loseStreak4: new Audio(`${ASSET_BASE}/BONK_STARS_BETTER.wav`)
    };

    audioRefs.current.background.loop = true;

    // Cleanup on unmount
    return () => {
      if (audioRefs.current.background) {
        audioRefs.current.background.pause();
      }
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      if (challengePollingRef.current) {
        clearInterval(challengePollingRef.current);
      }
    };
  }, []);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      gameVars.current.keys[e.code] = true;
    };

    const handleKeyUp = (e) => {
      gameVars.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize canvas
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const gameWindow = gamePlayWindowRef.current;
    if (!canvas || !gameWindow) return;

    const gv = gameVars.current;
    gv.ctx = canvas.getContext('2d');
    gv.WIDTH = gameWindow.clientWidth;
    gv.HEIGHT = gameWindow.clientHeight;

    canvas.width = gv.WIDTH;
    canvas.height = gv.HEIGHT;

    gv.PADDLE_HEIGHT = gv.HEIGHT * 0.1;
    gv.BALL_RADIUS = gv.PADDLE_HEIGHT / 2;

    const paddleOffset = gv.WIDTH * 0.05;
    gv.leftPaddleX = paddleOffset;
    gv.rightPaddleX = gv.WIDTH - gv.PADDLE_WIDTH - paddleOffset;

    gv.leftPaddleY = gv.HEIGHT / 2 - gv.PADDLE_HEIGHT / 2;
    gv.rightPaddleY = gv.HEIGHT / 2 - gv.PADDLE_HEIGHT / 2;

    gv.leftPaddleXStart = -gv.PADDLE_WIDTH;
    gv.rightPaddleXStart = gv.WIDTH;
  };

  // Reset game state
  const resetGameState = () => {
    const gv = gameVars.current;
    // Reset both state and refs
    gv.leftScoreRef = 0;
    gv.rightScoreRef = 0;
    gv.totalPointsRef = 0;
    setLeftScore(0);
    setRightScore(0);
    setTotalPoints(0);
    setLevel(1);
    setGameOver(false);
    gv.gameRunning = true;
    gv.leftPaddleY = gv.HEIGHT / 2 - gv.PADDLE_HEIGHT / 2;
    gv.rightPaddleY = gv.HEIGHT / 2 - gv.PADDLE_HEIGHT / 2;
    gv.leftStreak = 0;
    gv.rightStreak = 0;
    gv.leftLoseStreak = 0;
    gv.rightLoseStreak = 0;
  };

  // Reset ball
  const resetBall = () => {
    const gv = gameVars.current;
    gv.ballX = gv.WIDTH / 2;
    gv.ballY = gv.HEIGHT / 2;

    const direction = Math.random() < 0.5 ? 1 : -1;
    const angle = Math.random() * (Math.PI / 2) - Math.PI / 4;
    gv.ballAngle = direction === 1 ? angle : Math.PI + angle;

    const baseSpeed = gv.WIDTH / 3;
    const speed = baseSpeed * Math.pow(1.2, level - 1);

    gv.ballSpeedX = Math.cos(gv.ballAngle) * speed;
    gv.ballSpeedY = Math.sin(gv.ballAngle) * speed;
    gv.rotation = 0;
    gv.ballOpacity = 0.7;
    gv.ballBlur = 2;
    gv.ballLaunched = true;
  };

  // Draw star
  const drawStar = (x, y, radius, rotation) => {
    const { ctx, ballBlur, ballOpacity } = gameVars.current;
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.filter = `blur(${ballBlur}px)`;
    ctx.globalAlpha = ballOpacity;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(
        Math.cos(((18 + i * 72) * Math.PI) / 180) * radius,
        Math.sin(((18 + i * 72) * Math.PI) / 180) * radius
      );
      ctx.lineTo(
        Math.cos(((54 + i * 72) * Math.PI) / 180) * (radius / 2),
        Math.sin(((54 + i * 72) * Math.PI) / 180) * (radius / 2)
      );
    }
    ctx.closePath();
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.restore();
  };

  // Play streak sounds
  const playStreakSound = (streak) => {
    let soundToPlay = null;
    if (streak === 2) {
      soundToPlay = audioRefs.current.doubleBonk;
    } else if (streak === 3) {
      soundToPlay = audioRefs.current.tripleBonk;
    } else if (streak >= 5) {
      const streakSounds = [
        audioRefs.current.streak1,
        audioRefs.current.streak2,
        audioRefs.current.streak3
      ];
      soundToPlay = streakSounds[Math.floor(Math.random() * streakSounds.length)];
    }
    if (soundToPlay) {
      soundToPlay.currentTime = 0;
      soundToPlay.play().catch(e => console.log('Streak sound play failed:', e));
    }
  };

  const playLoseStreakSound = (loseStreak) => {
    let soundToPlay = null;
    if (loseStreak === 2) {
      soundToPlay = audioRefs.current.loseStreak2;
    } else if (loseStreak >= 4) {
      soundToPlay = audioRefs.current.loseStreak4;
    }
    if (soundToPlay) {
      soundToPlay.currentTime = 0;
      soundToPlay.play().catch(e => console.log('Lose streak sound play failed:', e));
    }
  };

  // Check level up
  const checkLevelUp = () => {
    const newLevel = Math.floor(totalPoints / 10) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
    }
  };

  // Check game over
  const checkGameOver = () => {
    const gv = gameVars.current;
    // Use ref values for immediate comparison
    if (gv.HUMAN_VS_COMPUTER && gv.rightScoreRef >= gv.leftScoreRef + 10) {
      setGameOver(true);
      setGameOverMessage('Game Over');
      gv.gameRunning = false;
      audioRefs.current.background.pause();
      audioRefs.current.background.currentTime = 0;

      setTimeout(() => {
        submitScores();
        showMenu();
      }, 5000);
    }
  };

  // Submit scores to database
  const submitScores = async () => {
    const gv = gameVars.current;
    // Use ref values to get accurate real-time scores
    let scoreToSend = gv.leftScoreRef;
    if (gameMode === 'challenge' || gameMode === 'accept') {
      scoreToSend = gv.leftScoreRef + gv.rightScoreRef;
    }

    console.log('=== SUBMITTING SCORE ===');
    console.log('Game mode:', gameMode);
    console.log('Left score (ref):', gv.leftScoreRef);
    console.log('Right score (ref):', gv.rightScoreRef);
    console.log('Score to send:', scoreToSend);
    console.log('User email:', user?.email);
    console.log('Challenge ID:', challengeId);

    if (scoreToSend === 0) {
      console.warn('WARNING: Score is 0! This might be incorrect.');
    }

    try {
      const requestBody = {
        action: 'submit_star_bonk_score',
        email: user.email,
        score: scoreToSend,
        challenge_id: challengeId
      };
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://buddywilde.com/wp-content/themes/buddy_wilde_theme/bw-db-credentials.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Score submission response:', data);

      if (data.success) {
        console.log('✓ Score submitted successfully!');
        console.log('New total score from server:', data.new_total_score);

        // Call the callback to refresh user data in parent component
        if (onScoreSubmitted) {
          console.log('Calling onScoreSubmitted callback to refresh user data...');
          onScoreSubmitted();
        } else {
          console.warn('WARNING: onScoreSubmitted callback is not defined!');
        }
      } else {
        console.error('✗ Score submission failed:', data.error);
      }
    } catch (error) {
      console.error('✗ Error submitting scores:', error);
    }
  };

  // AI Move logic
  const aiMove = (paddleY) => {
    const gv = gameVars.current;
    if (gv.ballSpeedX <= 0) return paddleY;

    const paddleX = gv.rightPaddleX;
    const timeToPaddle = Math.abs((paddleX - gv.ballX) / gv.ballSpeedX);
    let predictedY = gv.ballY + gv.ballSpeedY * timeToPaddle;

    let remainingTime = timeToPaddle;
    let currentY = gv.ballY;
    let currentSpeedY = gv.ballSpeedY;

    while (remainingTime > 0) {
      if (currentSpeedY > 0) {
        const timeToBottom = (gv.HEIGHT - currentY) / currentSpeedY;
        if (timeToBottom <= remainingTime) {
          remainingTime -= timeToBottom;
          currentY = gv.HEIGHT;
          currentSpeedY *= -1;
          predictedY = gv.HEIGHT + currentSpeedY * remainingTime;
        } else {
          predictedY = currentY + currentSpeedY * remainingTime;
          break;
        }
      } else {
        const timeToTop = Math.abs(currentY / currentSpeedY);
        if (timeToTop <= remainingTime) {
          remainingTime -= timeToTop;
          currentY = 0;
          currentSpeedY *= -1;
          predictedY = currentSpeedY * remainingTime;
        } else {
          predictedY = currentY + currentSpeedY * remainingTime;
          break;
        }
      }
    }

    const skill = Math.min(0.9, 0.3 + (level - 1) * 0.06);

    if (Math.random() < skill) {
      const targetY = predictedY - gv.PADDLE_HEIGHT / 2;
      const diff = targetY - paddleY;

      if (Math.abs(diff) > 2) {
        const moveAmount = Math.min(4 + level * 0.2, Math.abs(diff));
        if (diff > 0) {
          paddleY += moveAmount;
        } else {
          paddleY -= moveAmount;
        }
      }
    }

    return Math.max(0, Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, paddleY));
  };

  // Mobile tilt handler
  const handleTilt = (event) => {
    const gv = gameVars.current;
    if (!gv.isMobile || gv.isPaddleAnimating) return;

    let gamma = event.gamma;
    gamma = Math.max(-30, Math.min(30, gamma));
    gv.smoothedGamma = gv.smoothedGamma * SMOOTHING_FACTOR + gamma * (1 - SMOOTHING_FACTOR);

    const tiltSpeed = gv.smoothedGamma / 3.75;
    gv.leftPaddleY = Math.max(0, Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.leftPaddleY + tiltSpeed));
  };

  // Game loop
  const gameLoop = (timestamp) => {
    const gv = gameVars.current;
    if (!gv.gameRunning || currentState !== STATE_PLAYING) return;

    if (timestamp - gv.lastTime < 16) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    gv.lastTime = timestamp;

    if (!gv.ctx || canvasRef.current.width !== gamePlayWindowRef.current.clientWidth) {
      initializeCanvas();
    }

    gv.ctx.clearRect(0, 0, gv.WIDTH, gv.HEIGHT);

    // Paddle animation
    if (gv.isPaddleAnimating) {
      gv.paddleAnimationProgress += 16 / PADDLE_ANIMATION_DURATION;
      if (gv.paddleAnimationProgress >= 1) {
        gv.paddleAnimationProgress = 1;
        gv.isPaddleAnimating = false;
        if (!gv.ballLaunched) {
          resetBall();
        }
      }

      const easedProgress = 1 - Math.pow(1 - gv.paddleAnimationProgress, 3);
      gv.leftPaddleX = gv.leftPaddleXStart + easedProgress * (gv.WIDTH * 0.05 - gv.leftPaddleXStart);
      gv.rightPaddleX = gv.rightPaddleXStart - easedProgress * (gv.WIDTH - gv.PADDLE_WIDTH - gv.rightPaddleXStart + gv.WIDTH * 0.05);
    }

    // Paddle controls
    if (!gv.isPaddleAnimating) {
      if (!gv.isMobile) {
        if (gv.keys['KeyW']) gv.leftPaddleY = Math.max(0, gv.leftPaddleY - 12);
        if (gv.keys['KeyS']) gv.leftPaddleY = Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.leftPaddleY + 12);
      }

      if (gv.HUMAN_VS_COMPUTER) {
        if (gv.ballSpeedX > 0 && gv.ballLaunched) {
          gv.rightPaddleY = aiMove(gv.rightPaddleY);
        }
      }

      // Ball physics
      if (gv.ballLaunched) {
        gv.ballX += gv.ballSpeedX / 60;
        gv.ballY += gv.ballSpeedY / 60;

        // Wall collisions
        if (gv.ballY <= 0) {
          gv.ballY = 0;
          gv.ballSpeedY = Math.abs(gv.ballSpeedY);
          gv.rotation += 0.1;
        } else if (gv.ballY >= gv.HEIGHT) {
          gv.ballY = gv.HEIGHT;
          gv.ballSpeedY = -Math.abs(gv.ballSpeedY);
          gv.rotation += 0.1;
        }

        // Left paddle collision
        if (
          gv.ballX - gv.BALL_RADIUS < gv.leftPaddleX + gv.PADDLE_WIDTH &&
          gv.ballX + gv.BALL_RADIUS > gv.leftPaddleX &&
          gv.ballY > gv.leftPaddleY &&
          gv.ballY < gv.leftPaddleY + gv.PADDLE_HEIGHT &&
          gv.ballSpeedX < 0
        ) {
          const hitPos = (gv.ballY - gv.leftPaddleY) / gv.PADDLE_HEIGHT;
          const angleFactor = (hitPos - 0.5) * 0.8;
          const newAngle = angleFactor * Math.PI / 2;

          const currentSpeed = Math.sqrt(gv.ballSpeedX * gv.ballSpeedX + gv.ballSpeedY * gv.ballSpeedY);
          gv.ballSpeedX = Math.abs(Math.cos(newAngle) * currentSpeed);
          gv.ballSpeedY = Math.sin(newAngle) * currentSpeed;
          gv.rotation += 0.05;
          gv.ballX = gv.leftPaddleX + gv.PADDLE_WIDTH + gv.BALL_RADIUS;

          audioRefs.current.paddleStrike.currentTime = 0;
          audioRefs.current.paddleStrike.play().catch(e => console.log('Audio play failed:', e));
        }

        // Right paddle collision
        if (
          gv.ballX + gv.BALL_RADIUS > gv.rightPaddleX &&
          gv.ballX - gv.BALL_RADIUS < gv.rightPaddleX + gv.PADDLE_WIDTH &&
          gv.ballY > gv.rightPaddleY &&
          gv.ballY < gv.rightPaddleY + gv.PADDLE_HEIGHT &&
          gv.ballSpeedX > 0
        ) {
          const hitPos = (gv.ballY - gv.rightPaddleY) / gv.PADDLE_HEIGHT;
          const angleFactor = (hitPos - 0.5) * 0.8;
          const newAngle = Math.PI - (angleFactor * Math.PI / 2);

          const currentSpeed = Math.sqrt(gv.ballSpeedX * gv.ballSpeedX + gv.ballSpeedY * gv.ballSpeedY);
          gv.ballSpeedX = -Math.abs(Math.cos(newAngle) * currentSpeed);
          gv.ballSpeedY = Math.sin(newAngle) * currentSpeed;
          gv.rotation += 0.05;
          gv.ballX = gv.rightPaddleX - gv.BALL_RADIUS;

          audioRefs.current.paddleStrike.currentTime = 0;
          audioRefs.current.paddleStrike.play().catch(e => console.log('Audio play failed:', e));
        }

        // Scoring
        let scored = false;
        if (gv.ballX < 0 && !scored) {
          // Update ref immediately for game logic
          gv.rightScoreRef++;
          // Update state for UI display
          setRightScore(gv.rightScoreRef);

          gv.rightStreak++;
          gv.leftLoseStreak++;
          gv.leftStreak = 0;
          gv.rightLoseStreak = 0;

          if (gv.HUMAN_VS_COMPUTER) {
            playLoseStreakSound(gv.leftLoseStreak);
          }

          scored = true;
          gv.totalPointsRef++;
          setTotalPoints(gv.totalPointsRef);
          checkLevelUp();
          checkGameOver();

          if (!gameOver) resetBall();
        } else if (gv.ballX > gv.WIDTH && !scored) {
          // Update ref immediately for game logic
          gv.leftScoreRef++;
          // Update state for UI display
          setLeftScore(gv.leftScoreRef);

          gv.leftStreak++;
          gv.rightLoseStreak++;
          gv.rightStreak = 0;
          gv.leftLoseStreak = 0;

          playStreakSound(gv.leftStreak);

          scored = true;
          gv.totalPointsRef++;
          setTotalPoints(gv.totalPointsRef);
          checkLevelUp();
          checkGameOver();

          if (!gameOver) resetBall();
        }
      }
    }

    // Draw paddles
    if (!gv.isPaddleAnimating || gv.paddleAnimationProgress > 0) {
      gv.ctx.fillStyle = 'white';
      gv.ctx.fillRect(gv.leftPaddleX, gv.leftPaddleY, gv.PADDLE_WIDTH, gv.PADDLE_HEIGHT);
      gv.ctx.fillRect(gv.rightPaddleX, gv.rightPaddleY, gv.PADDLE_WIDTH, gv.PADDLE_HEIGHT);
    }

    // Draw ball
    if (gv.ballLaunched) {
      drawStar(gv.ballX, gv.ballY, gv.BALL_RADIUS, gv.rotation);
    }

    // Ball effects
    gv.ballOpacity += 0.005 * gv.opacityDirection;
    if (gv.ballOpacity >= 0.9 || gv.ballOpacity <= 0.7) gv.opacityDirection *= -1;

    gv.ballBlur += 0.1 * gv.blurDirection;
    if (gv.ballBlur >= 15 || gv.ballBlur <= 2) gv.blurDirection *= -1;

    gv.rotation += 0.02;

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  // Menu and state control functions
  const showMenu = () => {
    setCurrentState(STATE_MENU);
    gameVars.current.gameRunning = false;
    audioRefs.current.background.pause();
    audioRefs.current.background.currentTime = 0;
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    if (challengePollingRef.current) {
      clearInterval(challengePollingRef.current);
    }
  };

  const showGame = () => {
    // Reset game state
    resetGameState();

    const gv = gameVars.current;

    // Mobile fullscreen and orientation
    if (gv.isMobile) {
      const gameDiv = document.getElementById('star-bonk-game');
      if (gameDiv && gameDiv.requestFullscreen) {
        gameDiv.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
      }
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => console.error('Orientation lock error:', err));
      }
      // Device orientation permission
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(permissionState => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleTilt);
          }
        }).catch(console.error);
      } else {
        window.addEventListener('deviceorientation', handleTilt);
      }
    }

    // Change state to PLAYING - useEffect will handle canvas initialization and game loop start
    setCurrentState(STATE_PLAYING);
  };

  const playSolo = () => {
    setGameMode('solo');
    gameVars.current.HUMAN_VS_COMPUTER = true;
    showGame();
  };

  const showChallengeList = async () => {
    setCurrentState(STATE_CHALLENGE_LIST);
    await loadChallenges();
  };

  const showRules = () => {
    setCurrentState(STATE_RULES);
  };

  const loadChallenges = async () => {
    try {
      const response = await fetch('https://buddywilde.com/wp-content/themes/buddy_wilde_theme/bw-db-credentials.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_star_bonk_challenges',
          email: user.email
        })
      });
      const data = await response.json();
      if (data.success && data.challenges) {
        setChallenges(data.challenges);
      } else {
        setChallenges([]);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
      setChallenges([]);
    }
  };

  const createChallenge = async () => {
    try {
      const response = await fetch('https://buddywilde.com/wp-content/themes/buddy_wilde_theme/bw-db-credentials.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_star_bonk_challenge',
          email: user.email
        })
      });
      const data = await response.json();
      if (data.success && data.challenge_id) {
        setChallengeId(data.challenge_id);
        setGameMode('challenge');
        gameVars.current.HUMAN_VS_COMPUTER = true;
        showGame();
        // TODO: Implement WebSocket connection for real-time updates
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
    }
  };

  const joinChallenge = async (challenge_id) => {
    try {
      const response = await fetch('https://buddywilde.com/wp-content/themes/buddy_wilde_theme/bw-db-credentials.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join_star_bonk_challenge',
          email: user.email,
          challenge_id: challenge_id
        })
      });
      const data = await response.json();
      if (data.success) {
        setChallengeId(challenge_id);
        setGameMode('accept');
        gameVars.current.HUMAN_VS_COMPUTER = true;
        showGame();
        // TODO: Implement WebSocket connection for real-time updates
      }
    } catch (error) {
      console.error('Error joining challenge:', error);
    }
  };

  const handleExit = async () => {
    if (challengeId) {
      try {
        await fetch('https://buddywilde.com/wp-content/themes/buddy_wilde_theme/bw-db-credentials.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'end_star_bonk_challenge',
            email: user.email,
            challenge_id: challengeId
          })
        });
      } catch (error) {
        console.error('Error ending challenge:', error);
      }
    }
    submitScores();
    showMenu();
  };

  const toggleFullscreen = () => {
    const gameDiv = document.getElementById('star-bonk-game');
    if (!document.fullscreenElement) {
      gameDiv.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  if (!isLoggedIn || !user) {
    return null;
  }

  return (
    <div id="star-bonk-game" className="star-bonk-container">
      <video
        ref={backgroundVideoRef}
        className="background-video"
        autoPlay
        loop
        muted
        src={`${ASSET_BASE}/background_video.mp4`}
        onError={(e) => {
          console.log('Background video failed to load:', e);
          // Hide video if it fails to load
          if (backgroundVideoRef.current) {
            backgroundVideoRef.current.style.display = 'none';
          }
        }}
      />

      {/* Menu */}
      {currentState === STATE_MENU && (
        <div className="game-menu" ref={(el) => {
          if (el) console.log('Game menu rendered in DOM:', el);
        }}>
          <h1 className="game-title">GRONK BONK</h1>
          <div className="menu-buttons">
            <button onClick={playSolo} className="menu-button">Play Solo</button>
            <button onClick={createChallenge} className="menu-button">Create Challenge</button>
            <button onClick={showChallengeList} className="menu-button">Accept Challenge</button>
            <button onClick={showRules} className="menu-button">Rules</button>
            <button onClick={() => navigate('/')} className="menu-button">Exit Game</button>
          </div>
        </div>
      )}

      {/* Challenge List */}
      {currentState === STATE_CHALLENGE_LIST && (
        <div className="challenge-list">
          <h2 className="section-title">Available Challenges</h2>
          {challenges.length > 0 ? (
            <ul className="challenges-ul">
              {challenges.map(challenge => (
                <li key={challenge.id}>
                  <button
                    onClick={() => joinChallenge(challenge.id)}
                    className="challenge-button"
                  >
                    Challenge from {challenge.creator_name} - Click to Join
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-challenges">There are currently no available challenges</p>
          )}
          <button onClick={showMenu} className="back-button">Back to Menu</button>
        </div>
      )}

      {/* Rules */}
      {currentState === STATE_RULES && (
        <div className="rules-popup">
          <h2 className="section-title">Game Rules</h2>
          <div className="rules-content">
            <p>Control your paddle using W/S keys (or tilt on mobile)</p>
            <p>Hit the star to score points!</p>
            <p>Game ends when computer scores 10 points ahead</p>
            <p>Build streaks to earn bonus sounds!</p>
            <p>Level up every 10 points for increased difficulty</p>
          </div>
          <button onClick={showMenu} className="back-button">Back to Menu</button>
        </div>
      )}

      {/* Game */}
      {currentState === STATE_PLAYING && (
        <>
          <div className="game-hud">
            <div className="score left-score">{leftScore}</div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button onClick={handleExit} className="exit-button">✖</button>
              {!gameVars.current.isMobile && (
                <button onClick={toggleFullscreen} className="fullscreen-button">⛶</button>
              )}
            </div>
            <div className="score right-score">{rightScore}</div>
          </div>

          <div ref={gamePlayWindowRef} className="game-play-window">
            <canvas ref={canvasRef} />
          </div>

          {gameOver && (
            <div className="game-over">
              {gameOverMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BuddyStarBonk;
