import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './buddyStarBonk.css';

const BuddyStarBonk = ({ user, isLoggedIn, onScoreSubmitted }) => {
  const navigate = useNavigate();

  // Game states
  const STATE_MENU = 'menu';
  const STATE_PLAYING = 'playing';
  const STATE_CHALLENGE_LIST = 'challenge_list';
  const STATE_RULES = 'rules';
  const STATE_WAITING_FOR_OPPONENT = 'waiting_for_opponent';
  const STATE_PRE_GAME_RULES = 'pre_game_rules';
  const STATE_OPPONENT_CANCELLED = 'opponent_cancelled';

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
  const [isWinner, setIsWinner] = useState(false);
  const [showingIntro, setShowingIntro] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentName, setOpponentName] = useState(null);
  const [opponentAvatar, setOpponentAvatar] = useState(null);

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

  // Play waiting sound when in waiting state with timed intervals
  useEffect(() => {
    let firstTimeout;
    let intervalId;

    if (currentState === STATE_WAITING_FOR_OPPONENT && audioRefs.current?.waitingSound) {
      console.log('Entering waiting state - scheduling waiting sound');

      // Play first time after 10 seconds
      firstTimeout = setTimeout(() => {
        console.log('Playing waiting sound (first time after 10s)');
        if (audioRefs.current?.waitingSound) {
          audioRefs.current.waitingSound.volume = 0.7;
          audioRefs.current.waitingSound.play().catch(e => console.log('Waiting sound play failed:', e));
        }

        // Then play every 30 seconds after that
        intervalId = setInterval(() => {
          console.log('Playing waiting sound (repeated every 30s)');
          if (audioRefs.current?.waitingSound) {
            audioRefs.current.waitingSound.currentTime = 0;
            audioRefs.current.waitingSound.play().catch(e => console.log('Waiting sound play failed:', e));
          }
        }, 30000);
      }, 10000);
    }

    // Cleanup function
    return () => {
      if (firstTimeout) clearTimeout(firstTimeout);
      if (intervalId) clearInterval(intervalId);
      if (audioRefs.current?.waitingSound) {
        audioRefs.current.waitingSound.pause();
        audioRefs.current.waitingSound.currentTime = 0;
      }
    };
  }, [currentState]);

  // Play background sound during menu states and gameplay, but NOT during intro
  useEffect(() => {
    if (!audioRefs.current?.background) return;

    const isMenuState = currentState === STATE_MENU ||
                        currentState === STATE_CHALLENGE_LIST ||
                        currentState === STATE_RULES ||
                        currentState === STATE_WAITING_FOR_OPPONENT ||
                        currentState === STATE_PRE_GAME_RULES ||
                        currentState === STATE_OPPONENT_CANCELLED;

    // Play background sound in menu states or during gameplay, but stop during intro
    if (isMenuState && !showingIntro) {
      console.log('Playing background sound for menu state');
      audioRefs.current.background.volume = 0.5;
      audioRefs.current.background.play().catch(e => console.log('Background sound play failed:', e));
    } else if (showingIntro || (currentState !== STATE_PLAYING && !isMenuState)) {
      // Pause background sound during intro or when in non-menu/non-playing states
      console.log('Pausing background sound');
      audioRefs.current.background.pause();
    }
  }, [currentState, showingIntro]);

  // Check if both players are ready in multiplayer mode
  useEffect(() => {
    if (currentState === STATE_PRE_GAME_RULES && gameMode === 'challenge' && playerReady && opponentReady) {
      console.log('Both players ready - starting intro cutscene');
      startGameIntro();
    }
  }, [playerReady, opponentReady, currentState, gameMode]);

  // Play winner/loser sound every 3 seconds when game is over
  useEffect(() => {
    let intervalId;

    if (gameOver && audioRefs.current) {
      const soundToPlay = isWinner ? audioRefs.current.winnerSound : audioRefs.current.loserSound;

      // Play immediately
      soundToPlay.currentTime = 0;
      soundToPlay.play().catch(e => console.log('Game over sound play failed:', e));

      // Then play every 3 seconds
      intervalId = setInterval(() => {
        soundToPlay.currentTime = 0;
        soundToPlay.play().catch(e => console.log('Game over sound play failed:', e));
      }, 3000);
    }

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioRefs.current?.loserSound) {
        audioRefs.current.loserSound.pause();
        audioRefs.current.loserSound.currentTime = 0;
      }
      if (audioRefs.current?.winnerSound) {
        audioRefs.current.winnerSound.pause();
        audioRefs.current.winnerSound.currentTime = 0;
      }
    };
  }, [gameOver, isWinner]);

  // Poll for challenge acceptance when waiting for opponent
  useEffect(() => {
    let pollInterval;

    if (currentState === STATE_WAITING_FOR_OPPONENT && challengeId) {
      console.log('Starting to poll for challenge acceptance...');

      const checkChallengeStatus = async () => {
        try {
          const data = await api.post('/challenge/status', {
            challenge_id: challengeId
          });
          console.log('Challenge status:', data);

          if (data.success && data.status === 'active') {
            // Challenge has been accepted!
            console.log('Challenge accepted! Moving to pre-game rules');
            clearInterval(pollInterval);
            // Store opponent info (the person who accepted)
            if (data.opponent_name) {
              setOpponentName(data.opponent_name);
              setOpponentAvatar(data.opponent_avatar);
            }
            // Set to human vs human mode
            gameVars.current.HUMAN_VS_COMPUTER = false;
            // Connect to WebSocket as creator (left paddle)
            connectToWebSocket(challengeId, 'creator');
            setCurrentState(STATE_PRE_GAME_RULES);
          } else if (data.success && data.status === 'cancelled') {
            // Challenge was cancelled by opponent
            console.log('Challenge was cancelled');
            clearInterval(pollInterval);
            setCurrentState(STATE_OPPONENT_CANCELLED);
          }
        } catch (error) {
          console.error('Error checking challenge status:', error);
        }
      };

      // Check immediately
      checkChallengeStatus();

      // Then check every 2 seconds
      pollInterval = setInterval(checkChallengeStatus, 2000);
    }

    // Cleanup
    return () => {
      if (pollInterval) {
        console.log('Stopping challenge status polling');
        clearInterval(pollInterval);
      }
    };
  }, [currentState, challengeId]);

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

        // Play rocket sound during paddle animation
        audioRefs.current.rocketSound.volume = 0;
        audioRefs.current.rocketSound.play().catch(e => console.log('Rocket sound play failed:', e));
        let fadeStart = performance.now();
        const PADDLE_ANIMATION_DURATION = 2000;
        function fadeIn() {
          let progress = (performance.now() - fadeStart) / PADDLE_ANIMATION_DURATION;
          audioRefs.current.rocketSound.volume = Math.min(1, progress);
          if (progress < 1) {
            requestAnimationFrame(fadeIn);
          } else {
            audioRefs.current.rocketSound.volume = 1;
          }
        }
        requestAnimationFrame(fadeIn);

        // Start background sound with 0.1 second fade-in
        audioRefs.current.background.volume = 0;
        audioRefs.current.background.play().catch(e => console.log('Background sound play failed:', e));

        // Fade in background audio over 0.1 seconds
        let bgFadeStart = performance.now();
        const BG_FADE_DURATION = 300; // 0.1 seconds in milliseconds
        const TARGET_VOLUME = 0.5;
        function fadeInBackground() {
          let progress = (performance.now() - bgFadeStart) / BG_FADE_DURATION;
          audioRefs.current.background.volume = Math.min(TARGET_VOLUME, TARGET_VOLUME * progress);
          if (progress < 1) {
            requestAnimationFrame(fadeInBackground);
          } else {
            audioRefs.current.background.volume = TARGET_VOLUME;
          }
        }
        requestAnimationFrame(fadeInBackground);

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
  const introVideoRef = useRef(null);
  const gameplayVideoRef = useRef(null);
  const gameLoopRef = useRef(null);
  const challengePollingRef = useRef(null);
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket URL - use environment variable or default
  const WS_URL = import.meta.env.VITE_WS_URL || 'wss://buddywilde.com/ws';

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
    loseStreak4: null,
    rocketSound: null,
    waitingSound: null
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
  // Use relative path - served from /var/www/buddywilde.com/public_html/assets/games/starbonk on VPS
  // and from public/assets/games/starbonk locally
  const ASSET_BASE = '/assets/games/starbonk';

  // Initialize audio on component mount
  useEffect(() => {
    console.log('Initializing audio refs...');
    try {
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
        loseStreak4: new Audio(`${ASSET_BASE}/BONK_STARS_BETTER.wav`),
        rocketSound: new Audio(`${ASSET_BASE}/rocket_sound.wav`),
        waitingSound: new Audio(`${ASSET_BASE}/we%20need_to_get_bonking.wav`),
        loserSound: new Audio(`${ASSET_BASE}/LOSER.wav`),
        winnerSound: new Audio(`${ASSET_BASE}/ur_a_true_HERO.wav`)
      };

      audioRefs.current.background.loop = true;
      console.log('Audio refs initialized successfully');
    } catch (error) {
      console.error('Error initializing audio:', error);
    }

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
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // WebSocket connection handler for multiplayer games
  const connectToWebSocket = (challengeId, role) => {
    // Don't connect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    console.log(`🔌 Connecting to WebSocket: ${WS_URL}`);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setWsConnected(true);

      // Join the game
      ws.send(JSON.stringify({
        type: 'join_game',
        challengeId: challengeId,
        userId: user?.id || user?.email,
        role: role // 'creator' or 'opponent'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setWsConnected(false);
      wsRef.current = null;
    };
  };

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'game_state':
        // Initial game state received
        console.log('📥 Received initial game state:', data);
        // Store the role (creator = left paddle, opponent = right paddle)
        gameVars.current.myRole = data.role;
        gameVars.current.wsConfig = data.config;
        break;

      case 'game_update':
        // Server-authoritative game state update
        if (data.state) {
          // Update ball position from server (only in multiplayer)
          if (!gameVars.current.HUMAN_VS_COMPUTER) {
            gameVars.current.ballX = data.state.ball.x;
            gameVars.current.ballY = data.state.ball.y;
            gameVars.current.ballSpeedX = data.state.ball.vx;
            gameVars.current.ballSpeedY = data.state.ball.vy;

            // Update opponent paddle position
            if (gameVars.current.myRole === 'creator') {
              // I'm left paddle, update right paddle from server
              gameVars.current.rightPaddleY = data.state.paddles.right.y;
            } else {
              // I'm right paddle, update left paddle from server
              gameVars.current.leftPaddleY = data.state.paddles.left.y;
            }

            // Update scores
            if (data.state.scores.left !== gameVars.current.leftScoreRef) {
              gameVars.current.leftScoreRef = data.state.scores.left;
              setLeftScore(data.state.scores.left);
            }
            if (data.state.scores.right !== gameVars.current.rightScoreRef) {
              gameVars.current.rightScoreRef = data.state.scores.right;
              setRightScore(data.state.scores.right);
            }
          }
        }
        break;

      case 'player_joined':
        console.log(`👤 Player joined as ${data.role}`);
        // Opponent has joined - can show notification
        break;

      case 'player_disconnected':
        console.log(`👋 Player disconnected: ${data.role}`);
        // Handle opponent disconnect - maybe pause game or show message
        setOpponentReady(false);
        break;

      case 'game_started':
        console.log('🏁 Game started!');
        break;

      case 'game_over':
        console.log('🎮 Game over:', data);
        setGameOver(true);
        const didIWin = (gameVars.current.myRole === 'creator' && data.winner === 'left') ||
                        (gameVars.current.myRole === 'opponent' && data.winner === 'right');
        setIsWinner(didIWin);
        setGameOverMessage(didIWin ? 'YOU WIN!' : 'YOU LOSE!');

        // Play appropriate sound
        if (didIWin && audioRefs.current?.winnerSound) {
          audioRefs.current.winnerSound.play().catch(e => console.log('Winner sound failed:', e));
        } else if (!didIWin && audioRefs.current?.loserSound) {
          audioRefs.current.loserSound.play().catch(e => console.log('Loser sound failed:', e));
        }
        break;

      case 'opponent_ready':
        console.log('Opponent is ready!');
        setOpponentReady(true);
        break;

      case 'error':
        console.error('WebSocket error from server:', data.message);
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  // Send paddle position to server in multiplayer mode
  const sendPaddleUpdate = (y, direction) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !gameVars.current.HUMAN_VS_COMPUTER) {
      wsRef.current.send(JSON.stringify({
        type: 'paddle_move',
        y: y,
        direction: direction
      }));
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWsConnected(false);
    }
  };

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
    setIsWinner(false);
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

    // Solo mode: AI wins if 10 points ahead
    if (gv.HUMAN_VS_COMPUTER && gv.rightScoreRef >= gv.leftScoreRef + 10) {
      setGameOver(true);
      setGameOverMessage('LOSER');
      setIsWinner(false);
      gv.gameRunning = false;
      audioRefs.current.background.pause();
      audioRefs.current.background.currentTime = 0;
      // Don't auto-exit, let user click EXIT button
      return;
    }

    // Multiplayer mode: First to 20 points wins
    if (!gv.HUMAN_VS_COMPUTER) {
      if (gv.leftScoreRef >= 20) {
        // Left player (human) wins
        setGameOver(true);
        setGameOverMessage('WINNER');
        setIsWinner(true);
        gv.gameRunning = false;
        audioRefs.current.background.pause();
        audioRefs.current.background.currentTime = 0;
        return;
      } else if (gv.rightScoreRef >= 20) {
        // Right player wins, left player loses
        setGameOver(true);
        setGameOverMessage('LOSER');
        setIsWinner(false);
        gv.gameRunning = false;
        audioRefs.current.background.pause();
        audioRefs.current.background.currentTime = 0;
        return;
      }
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
        email: user.email,
        score: scoreToSend,
        challenge_id: challengeId
      };
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const data = await api.post('/challenge/score', requestBody);
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

    if (gv.HUMAN_VS_COMPUTER) {
      // Solo mode: control left paddle
      gv.leftPaddleY = Math.max(0, Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.leftPaddleY + tiltSpeed));
    } else {
      // Multiplayer mode: control your assigned paddle
      const isCreator = gv.myRole === 'creator';
      if (isCreator) {
        gv.leftPaddleY = Math.max(0, Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.leftPaddleY + tiltSpeed));
        sendPaddleUpdate(gv.leftPaddleY, tiltSpeed > 0 ? 'down' : 'up');
      } else {
        gv.rightPaddleY = Math.max(0, Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.rightPaddleY + tiltSpeed));
        sendPaddleUpdate(gv.rightPaddleY, tiltSpeed > 0 ? 'down' : 'up');
      }
    }
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
      if (gv.HUMAN_VS_COMPUTER) {
        // Solo mode: left paddle controlled by player, right by AI
        if (!gv.isMobile) {
          if (gv.keys['KeyW']) gv.leftPaddleY = Math.max(0, gv.leftPaddleY - 12);
          if (gv.keys['KeyS']) gv.leftPaddleY = Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.leftPaddleY + 12);
        }
        if (gv.ballSpeedX > 0 && gv.ballLaunched) {
          gv.rightPaddleY = aiMove(gv.rightPaddleY);
        }
      } else {
        // Multiplayer mode: each player controls their own paddle
        const isCreator = gv.myRole === 'creator';
        let paddleMoved = false;
        let direction = null;

        if (!gv.isMobile) {
          if (isCreator) {
            // Creator controls left paddle
            if (gv.keys['KeyW']) {
              gv.leftPaddleY = Math.max(0, gv.leftPaddleY - 12);
              direction = 'up';
              paddleMoved = true;
            }
            if (gv.keys['KeyS']) {
              gv.leftPaddleY = Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.leftPaddleY + 12);
              direction = 'down';
              paddleMoved = true;
            }
            if (paddleMoved) {
              sendPaddleUpdate(gv.leftPaddleY, direction);
            }
          } else {
            // Opponent controls right paddle
            if (gv.keys['KeyW'] || gv.keys['ArrowUp']) {
              gv.rightPaddleY = Math.max(0, gv.rightPaddleY - 12);
              direction = 'up';
              paddleMoved = true;
            }
            if (gv.keys['KeyS'] || gv.keys['ArrowDown']) {
              gv.rightPaddleY = Math.min(gv.HEIGHT - gv.PADDLE_HEIGHT, gv.rightPaddleY + 12);
              direction = 'down';
              paddleMoved = true;
            }
            if (paddleMoved) {
              sendPaddleUpdate(gv.rightPaddleY, direction);
            }
          }
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
  const showMenu = async () => {
    // If there's an active challenge, cancel it
    if (challengeId) {
      try {
        await api.post('/challenge/end', {
          email: user.email,
          challenge_id: challengeId
        });
        console.log('Challenge cancelled when returning to menu');
      } catch (error) {
        console.error('Error cancelling challenge:', error);
      }
      setChallengeId(null);
    }

    // Disconnect WebSocket if connected
    disconnectWebSocket();

    setCurrentState(STATE_MENU);
    gameVars.current.gameRunning = false;
    gameVars.current.myRole = null; // Clear multiplayer role
    audioRefs.current.background.pause();
    audioRefs.current.background.currentTime = 0;
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    if (challengePollingRef.current) {
      clearInterval(challengePollingRef.current);
    }
    // Reset gameplay video opacity for next game
    if (gameplayVideoRef.current) {
      gameplayVideoRef.current.classList.remove('gameplay-fade');
    }
    // Reset opponent info
    setOpponentName(null);
    setOpponentAvatar(null);
  };

  const showGame = () => {
    // Show pre-game rules screen first
    setPlayerReady(false);
    setOpponentReady(false);
    setCurrentState(STATE_PRE_GAME_RULES);
  };

  const handlePlayerReady = () => {
    setPlayerReady(true);

    // Start the game intro for both solo and multiplayer modes
    // In multiplayer, both players will start independently when they click READY
    startGameIntro();
  };

  const handleQuitPreGame = async () => {
    // If in multiplayer mode, cancel the challenge and notify opponent
    if (gameMode === 'challenge' && challengeId) {
      try {
        await api.post('/challenge/end', {
          email: user.email,
          challenge_id: challengeId
        });
        console.log('Challenge cancelled - opponent will be notified');
      } catch (error) {
        console.error('Error cancelling challenge:', error);
      }
    }
    // Return to menu
    showMenu();
  };

  const startGameIntro = () => {
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

    // Show intro video first, then game will start after intro ends
    setShowingIntro(true);
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
      const data = await api.post('/challenge/list', {
        email: user.email
      });
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
    console.log('=== CREATE CHALLENGE CLICKED ===');
    console.log('User email:', user?.email);

    if (!user || !user.email) {
      console.error('Cannot create challenge - user not logged in');
      alert('You must be logged in to create a challenge');
      return;
    }

    try {
      console.log('Sending create challenge request...');
      const data = await api.post('/challenge/create', {
        email: user.email
      });
      console.log('Create challenge response:', data);

      if (data.success && data.challenge_id) {
        console.log('✓ Challenge created successfully! ID:', data.challenge_id);
        setChallengeId(data.challenge_id);
        setGameMode('challenge');
        // Show waiting screen instead of starting game
        // Polling for opponent acceptance starts automatically via useEffect
        setCurrentState(STATE_WAITING_FOR_OPPONENT);
      } else {
        console.error('✗ Failed to create challenge:', data.error || 'Unknown error');
        alert(`Failed to create challenge: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('✗ Error creating challenge:', error);
      alert(`Error creating challenge: ${error.message}`);
    }
  };

  const cancelChallengeAndPlaySolo = async () => {
    console.log('=== CANCELLING CHALLENGE AND PLAYING SOLO ===');

    // Cancel the challenge in the database
    if (challengeId) {
      try {
        await api.post('/challenge/end', {
          email: user.email,
          challenge_id: challengeId
        });
        console.log('Challenge cancelled');
      } catch (error) {
        console.error('Error cancelling challenge:', error);
      }
    }

    // Reset challenge state and start solo game
    setChallengeId(null);
    setGameMode('solo');
    gameVars.current.HUMAN_VS_COMPUTER = true;
    showGame();
  };

  const joinChallenge = async (challenge_id) => {
    try {
      // Find the challenge in the list to get opponent info
      const challenge = challenges.find(c => c.id === challenge_id);
      if (challenge) {
        setOpponentName(challenge.creator_name);
        setOpponentAvatar(challenge.creator_avatar);
      }

      const data = await api.post('/challenge/join', {
        email: user.email,
        challenge_id: challenge_id
      });
      if (data.success) {
        setChallengeId(challenge_id);
        setGameMode('accept');
        // Set to human vs human mode (not AI)
        gameVars.current.HUMAN_VS_COMPUTER = false;
        // Connect to WebSocket as opponent (right paddle)
        connectToWebSocket(challenge_id, 'opponent');
        showGame();
      }
    } catch (error) {
      console.error('Error joining challenge:', error);
    }
  };

  const handleExit = async () => {
    if (challengeId) {
      try {
        await api.post('/challenge/end', {
          email: user.email,
          challenge_id: challengeId
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
    console.log('User not logged in, returning null');
    return null;
  }

  console.log('Rendering game with state:', currentState, 'showingIntro:', showingIntro);

  return (
    <div id="star-bonk-game" className="star-bonk-container">
      {/* Space flight loop video for menus and waiting states */}
      {(currentState === STATE_MENU || currentState === STATE_CHALLENGE_LIST || currentState === STATE_RULES || currentState === STATE_WAITING_FOR_OPPONENT || currentState === STATE_PRE_GAME_RULES || currentState === STATE_OPPONENT_CANCELLED) && !showingIntro && (
        <video
          ref={backgroundVideoRef}
          className="background-video"
          autoPlay
          loop
          muted
          src={`${ASSET_BASE}/Gronk_bonk_space_flight_loop.mp4`}
          onError={(e) => {
            console.log('Space flight video failed to load:', e);
            if (backgroundVideoRef.current) {
              backgroundVideoRef.current.style.display = 'none';
            }
          }}
        />
      )}

      {/* Intro cutscene video */}
      {showingIntro && (
        <video
          ref={introVideoRef}
          className="background-video"
          autoPlay
          src={`${ASSET_BASE}/GRONK_BONK_NEW_GAME_INTRO_CUT_SCENE.mp4`}
          onPlay={() => {
            console.log('Intro video playing - stopping background audio');
            if (audioRefs.current?.background) {
              audioRefs.current.background.pause();
              audioRefs.current.background.currentTime = 0;
            }
          }}
          onTimeUpdate={(e) => {
            // Fade out intro video audio 0.1 seconds before it ends
            const video = e.target;
            const timeRemaining = video.duration - video.currentTime;
            if (timeRemaining <= 0.5 && timeRemaining > 0) {
              // Linear fade out over the last 0.5 seconds
              video.volume = timeRemaining / 0.5;
            }
          }}
          onEnded={() => {
            console.log('Intro video ended');
            setShowingIntro(false);
            // Start the actual game after intro
            setCurrentState(STATE_PLAYING);
          }}
          onError={(e) => {
            console.log('Intro video failed to load:', e);
            // If intro fails, just go straight to game
            setShowingIntro(false);
            setCurrentState(STATE_PLAYING);
          }}
        />
      )}

      {/* Gameplay background video */}
      {currentState === STATE_PLAYING && !showingIntro && (
        <video
          ref={gameplayVideoRef}
          className="background-video"
          autoPlay
          loop
          muted
          src={`${ASSET_BASE}/NEW_GAME_BACK_GROUND_LOOP_VIDEO.mp4`}
          onPlay={() => {
            // Apply fade class after video starts playing
            // This triggers the 3-second opacity transition from 100% to 20%
            if (gameplayVideoRef.current) {
              console.log('Gameplay video started - applying fade to 20% opacity');
              gameplayVideoRef.current.classList.add('gameplay-fade');
            }
          }}
          onError={(e) => {
            console.log('Gameplay video failed to load:', e);
            if (gameplayVideoRef.current) {
              gameplayVideoRef.current.style.display = 'none';
            }
          }}
        />
      )}

      {/* Menu */}
      {currentState === STATE_MENU && !showingIntro && (
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
                    {challenge.creator_avatar && (
                      <img
                        src={challenge.creator_avatar}
                        alt={challenge.creator_name}
                        className="challenge-avatar"
                      />
                    )}
                    <span>Challenge from {challenge.creator_name} - Click to Join</span>
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
            <ul>
              <li>Control your paddle using W/S keys (or tilt on mobile)</li>
              <li>Score on your opponent to earn points</li>
              <li>Points earned in a game are added to your wallet</li>
            </ul>
          </div>
          <button onClick={showMenu} className="back-button">Back to Menu</button>
        </div>
      )}

      {/* Waiting for Opponent */}
      {currentState === STATE_WAITING_FOR_OPPONENT && (
        <div className="game-menu">
          <h2 className="game-title">Challenge Created!</h2>
          <div className="rules-content" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ fontSize: '1.3rem', color: '#39ff14' }}>Waiting for an opponent to accept your challenge...</p>
            <p style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '1rem' }}>
              Challenge ID: {challengeId}
            </p>
          </div>
          <div className="menu-buttons">
            <button onClick={cancelChallengeAndPlaySolo} className="menu-button">
              Play Solo Now
            </button>
            <button onClick={showMenu} className="back-button" style={{ marginTop: '1rem' }}>
              Cancel Challenge
            </button>
          </div>
        </div>
      )}

      {/* Pre-Game Rules Screen */}
      {currentState === STATE_PRE_GAME_RULES && !showingIntro && (
        <div className="rules-popup">
          <h2 className="section-title">Game Rules</h2>
          <div className="rules-content">
            <ul>
              <li>Control your paddle using W/S keys (or tilt on mobile)</li>
              <li>Score on your opponent to earn points</li>
              <li>Points earned in a game are added to your wallet</li>
            </ul>
          </div>
          {gameMode === 'solo' || playerReady ? (
            <>
              {playerReady && gameMode !== 'solo' && !opponentReady && (
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h3 className="section-title" style={{ fontSize: '1.5rem', color: '#39ff14' }}>
                    Waiting for opponent...
                  </h3>
                </div>
              )}
              <div className="menu-buttons">
                {!playerReady && (
                  <button onClick={handlePlayerReady} className="menu-button">
                    READY
                  </button>
                )}
                <button onClick={handleQuitPreGame} className="back-button">
                  QUIT
                </button>
              </div>
            </>
          ) : (
            <div className="menu-buttons">
              <button onClick={handlePlayerReady} className="menu-button">
                READY
              </button>
              <button onClick={handleQuitPreGame} className="back-button">
                QUIT
              </button>
            </div>
          )}
        </div>
      )}

      {/* Opponent Cancelled */}
      {currentState === STATE_OPPONENT_CANCELLED && (
        <div className="game-menu">
          <h2 className="game-title">Challenge Cancelled</h2>
          <div className="rules-content" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ fontSize: '1.3rem', color: '#ff4444' }}>Your opponent has cancelled this challenge</p>
          </div>
          <div className="menu-buttons">
            <button onClick={showMenu} className="menu-button">
              Return to Menu
            </button>
          </div>
        </div>
      )}

      {/* Game */}
      {currentState === STATE_PLAYING && (
        <>
          <div className="game-hud">
            <div className="score left-score">
              <div className="player-info">
                {user.avatar_url && (
                  <img src={user.avatar_url} alt={user.display_name} className="player-avatar" />
                )}
                <span className="player-username">{user.display_name}</span>
              </div>
              <span>{leftScore}</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button onClick={handleExit} className="exit-button">✖</button>
              {!gameVars.current.isMobile && (
                <button onClick={toggleFullscreen} className="fullscreen-button">⛶</button>
              )}
            </div>
            <div className="score right-score">
              <span>{rightScore}</span>
              {gameMode !== 'solo' && opponentName && (
                <div className="player-info">
                  <span className="player-username">{opponentName}</span>
                  {opponentAvatar && (
                    <img src={opponentAvatar} alt={opponentName} className="player-avatar" />
                  )}
                </div>
              )}
            </div>
          </div>

          <div ref={gamePlayWindowRef} className="game-play-window">
            <canvas ref={canvasRef} />
          </div>

          {gameOver && (
            <div className="game-over">
              <div style={{ marginBottom: '2rem' }}>{gameOverMessage}</div>
              <button
                onClick={() => {
                  submitScores();
                  showMenu();
                }}
                className="menu-button"
                style={{
                  fontSize: '1.5rem',
                  padding: '1rem 3rem',
                  margin: '0 auto',
                  display: 'block'
                }}
              >
                EXIT
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BuddyStarBonk;
