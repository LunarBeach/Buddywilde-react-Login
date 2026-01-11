(function () {
    // Game states
    const STATE_MENU = 'menu';
    const STATE_PLAYING = 'playing';
    const STATE_CHALLENGE_LIST = 'challenge_list';
    const STATE_RULES = 'rules';
    
    let currentState = STATE_MENU;
    let gameMode = 'solo'; // 'solo', 'challenge', 'accept'
    let challengeId = null;
    let challengeInterval = null;
    
    // DOM Elements
    const gameDiv = document.getElementById("game_div");
    const gamePlayWindow = document.getElementById("game_play_window_div");
    const leftScoreEl = document.getElementById("left_score");
    const rightScoreEl = document.getElementById("right_score");
    const exitBtn = document.getElementById("exit_game");
    const fullscreenBtn = document.getElementById("toggle_fullscreen");
    const gameOverEl = document.getElementById("game_over");
    const backgroundVideo = document.getElementById("background_video");
    const menuEl = document.getElementById("game_menu");
    const challengeListEl = document.getElementById("challenge_list");
    const rulesEl = document.getElementById("rules_popup");
    
    // Audio elements
    const paddleStrikeSound = new Audio("https://buddywilde.com/wp-content/uploads/2025/10/gronk_bonk_paddle_strike.wav");
    const startSound = new Audio("https://buddywilde.com/wp-content/uploads/2025/10/rocket_sound.wav");
    const backgroundSound = new Audio("https://buddywilde.com/wp-content/uploads/2025/10/deepspace_gronk_bonk.wav");
    const doubleBonkSound = new Audio("https://buddywilde.com/wp-content/uploads/2025/10/double_BONK.wav");
    const tripleBonkSound = new Audio("https://buddywilde.com/wp-content/uploads/2025/10/triple_BONK.wav");
    const streakSounds = [
        new Audio("https://buddywilde.com/wp-content/uploads/2025/10/great_bonking_GRONK.wav"),
        new Audio("https://buddywilde.com/wp-content/uploads/2025/10/ur_a_true_HERO.wav"),
        new Audio("https://buddywilde.com/wp-content/uploads/2025/10/WOW.wav")
    ];
    const loseStreak2Sound = new Audio("https://buddywilde.com/wp-content/uploads/2025/10/bonk_more_STARS.wav");
    const loseStreak4Sound = new Audio("https://buddywilde.com/wp-content/uploads/2025/10/BONK_STARS_BETTER.wav");
    
    // Set background video opacity
    if (backgroundVideo) {
        backgroundVideo.style.opacity = "0.2";
    }

    // Configure background sound
    backgroundSound.loop = true;

    let WIDTH, HEIGHT;
    let canvas, ctx;

    // Game state
    let leftScore = 0;
    let rightScore = 0;
    let totalPoints = 0;
    let level = 1;
    let gameOver = false;
    let gameRunning = true;
    let lastTime = 0;
    let paddleAnimationProgress = 0;
    let paddleAnimationDuration = 2000; // 2 seconds to match rocket_sound.wav duration
    let isPaddleAnimating = false;

    // Streak tracking
    let leftStreak = 0; // Tracks left player's scoring streak
    let rightStreak = 0; // Tracks right player's scoring streak
    let leftLoseStreak = 0; // Tracks left player's times scored on
    let rightLoseStreak = 0; // Tracks right player's times scored on

    // Paddle settings
    const PADDLE_WIDTH = 10;
    let PADDLE_HEIGHT;
    let leftPaddleY;
    let rightPaddleY;
    let leftPaddleX, rightPaddleX;
    let leftPaddleXStart, rightPaddleXStart; // Starting positions for animation

    // Ball settings
    let ballX, ballY, ballSpeedX, ballSpeedY, ballAngle, rotation = 0;
    let ballOpacity = 0.7;
    let ballBlur = 2;
    let blurDirection = 1;
    let opacityDirection = 1;
    let BALL_RADIUS;
    let ballLaunched = false; // Tracks if the first ball is launched

    // Game mode (true = human vs computer, false = human vs human)
    let HUMAN_VS_COMPUTER = true;

    // Mobile detection
    const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

    // Tilt smoothing
    let smoothedGamma = 0;
    const smoothingFactor = 0.5; // Adjust for smoothness (0-1, lower = smoother)

    function initializeCanvas() {
        if (!canvas) {
            canvas = document.createElement("canvas");
            gamePlayWindow.appendChild(canvas);
        }
        ctx = canvas.getContext("2d");
        
        WIDTH = gamePlayWindow.clientWidth;
        HEIGHT = gamePlayWindow.clientHeight;
        
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        
        PADDLE_HEIGHT = HEIGHT * 0.1;
        BALL_RADIUS = PADDLE_HEIGHT / 2; // Same size as paddles (effective visual size)
        
        const paddleOffset = WIDTH * 0.05;
        leftPaddleX = paddleOffset;
        rightPaddleX = WIDTH - PADDLE_WIDTH - paddleOffset;
        
        leftPaddleY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
        rightPaddleY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
        
        // Set starting positions for paddle animation
        leftPaddleXStart = -PADDLE_WIDTH;
        rightPaddleXStart = WIDTH;
    }

    function showMenu() {
        currentState = STATE_MENU;
        if (menuEl) menuEl.style.display = "block";
        if (challengeListEl) challengeListEl.style.display = "none";
        if (rulesEl) rulesEl.style.display = "none";
        if (gamePlayWindow) gamePlayWindow.style.display = "none";
        if (leftScoreEl) leftScoreEl.style.display = "none";
        if (rightScoreEl) rightScoreEl.style.display = "none";
        if (exitBtn) exitBtn.style.display = "none";
        if (fullscreenBtn) fullscreenBtn.style.display = "none";
        if (gameOverEl) gameOverEl.style.display = "none";
        backgroundSound.pause();
        backgroundSound.currentTime = 0;
    }

    function showGame() {
        currentState = STATE_PLAYING;
        if (menuEl) menuEl.style.display = "none";
        if (challengeListEl) challengeListEl.style.display = "none";
        if (rulesEl) rulesEl.style.display = "none";
        if (gamePlayWindow) gamePlayWindow.style.display = "block";
        if (leftScoreEl) leftScoreEl.style.display = "block";
        if (rightScoreEl) rightScoreEl.style.display = "block";
        if (exitBtn) {
            exitBtn.style.display = "block";
            exitBtn.style.background = "none";
            exitBtn.style.border = "none";
            exitBtn.style.color = "white";
            exitBtn.style.fontSize = "2em";
            exitBtn.style.padding = "0";
            exitBtn.style.cursor = "pointer";
        }
        if (fullscreenBtn) {
            fullscreenBtn.style.display = isMobile ? "none" : "block";
            if (!isMobile) {
                fullscreenBtn.style.background = "none";
                fullscreenBtn.style.border = "none";
                fullscreenBtn.style.color = "white";
                fullscreenBtn.style.fontSize = "2em";
                fullscreenBtn.style.padding = "0";
                fullscreenBtn.style.cursor = "pointer";
            }
        }
        if (gameOverEl) gameOverEl.style.display = "none";
        
        initializeCanvas();
        resetGameState();
        
        // Mobile full screen and orientation
        if (isMobile) {
            if (gameDiv.requestFullscreen) {
                gameDiv.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
            }
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(err => console.error("Orientation lock error:", err));
            }
            // Request device orientation permission if needed
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
        
        // Start paddle animation and sound
        isPaddleAnimating = true;
        paddleAnimationProgress = 0;
        ballLaunched = false;
        
        // Play start sound with fade-in
        startSound.volume = 0;
        startSound.play().catch(e => console.log("Start sound play failed:", e));
        let fadeStart = performance.now();
        function fadeIn() {
            let progress = (performance.now() - fadeStart) / paddleAnimationDuration;
            startSound.volume = Math.min(1, progress);
            if (progress < 1) {
                requestAnimationFrame(fadeIn);
            } else {
                startSound.volume = 1;
            }
        }
        requestAnimationFrame(fadeIn);
        
        // Start background sound
        backgroundSound.volume = 0.5; // Adjust volume as needed
        backgroundSound.play().catch(e => console.log("Background sound play failed:", e));
        
        gameRunning = true;
        gameOver = false;
        requestAnimationFrame(gameLoop);
    }

    function resetGameState() {
        leftScore = 0;
        rightScore = 0;
        totalPoints = 0;
        level = 1;
        gameOver = false;
        gameRunning = true;
        leftPaddleY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
        rightPaddleY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
        leftStreak = 0;
        rightStreak = 0;
        leftLoseStreak = 0;
        rightLoseStreak = 0;
        updateScore();
    }

    function showChallengeList() {
        currentState = STATE_CHALLENGE_LIST;
        if (menuEl) menuEl.style.display = "none";
        if (challengeListEl) challengeListEl.style.display = "block";
        if (rulesEl) rulesEl.style.display = "none";
        if (gamePlayWindow) gamePlayWindow.style.display = "none";
        loadChallenges();
        backgroundSound.pause();
        backgroundSound.currentTime = 0;
    }

    function showRules() {
        currentState = STATE_RULES;
        if (menuEl) menuEl.style.display = "none";
        if (challengeListEl) challengeListEl.style.display = "none";
        if (rulesEl) rulesEl.style.display = "block";
        if (gamePlayWindow) gamePlayWindow.style.display = "none";
        backgroundSound.pause();
        backgroundSound.currentTime = 0;
    }

    function loadChallenges() {
        fetch(window.location.href, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "action=get_challenges"
        })
        .then(response => response.json())
        .then(data => {
            if (challengeListEl) {
                if (data.challenges && data.challenges.length > 0) {
                    let html = '<h2>Available Challenges</h2><ul>';
                    data.challenges.forEach(challenge => {
                        html += `<li>
                            <button onclick="joinChallenge('${challenge.id}')">
                                Challenge from ${challenge.creator_name} - Click to Join
                            </button>
                        </li>`;
                    });
                    html += '</ul>';
                    challengeListEl.innerHTML = html;
                } else {
                    challengeListEl.innerHTML = '<h2>There are currently no available challenges</h2>';
                }
                challengeListEl.innerHTML += '<button onclick="showMenu()" style="margin-top: 20px;">Back to Menu</button>';
            }
        });
    }

    function createChallenge() {
        fetch(window.location.href, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "action=create_challenge"
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                challengeId = data.challenge_id;
                gameMode = 'challenge';
                HUMAN_VS_COMPUTER = true;
                showGame();
                startChallengePolling();
            }
        });
    }

    window.joinChallenge = function(challenge_id) {
        challengeId = challenge_id;
        gameMode = 'accept';
        HUMAN_VS_COMPUTER = true;
        fetch(window.location.href, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `action=join_challenge&challenge_id=${challenge_id}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showGame();
                startChallengePolling();
            }
        });
    }

    function startChallengePolling() {
        if (challengeInterval) clearInterval(challengeInterval);
        challengeInterval = setInterval(() => {
            if (challengeId && currentState === STATE_PLAYING) {
                fetch(window.location.href, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: `action=poll_challenge&challenge_id=${challengeId}`
                })
                .then(response => response.json())
                .then(data => {
                    if (data.game_over) {
                        gameOver = true;
                        gameRunning = false;
                        if (gameOverEl) {
                            gameOverEl.textContent = data.winner ? `Winner: ${data.winner}` : "Game Over";
                            gameOverEl.style.display = "block";
                        }
                        clearInterval(challengeInterval);
                        backgroundSound.pause();
                        backgroundSound.currentTime = 0;
                        setTimeout(() => {
                            submitScores();
                            showMenu();
                        }, 5000);
                    } else if (data.opponent_left) {
                        if (gameOverEl) {
                            gameOverEl.textContent = "Opponent Left - You Win!";
                            gameOverEl.style.display = "block";
                        }
                        gameOver = true;
                        gameRunning = false;
                        clearInterval(challengeInterval);
                        backgroundSound.pause();
                        backgroundSound.currentTime = 0;
                        setTimeout(() => {
                            submitScores();
                            showMenu();
                        }, 5000);
                    }
                });
            }
        }, 1000);
    }

    function resetBall() {
        ballX = WIDTH / 2;
        ballY = HEIGHT / 2;

        const direction = Math.random() < 0.5 ? 1 : -1;
        const angle = Math.random() * (Math.PI / 2) - Math.PI / 4;

        ballAngle = direction === 1 ? angle : Math.PI + angle;

        const baseSpeed = WIDTH / 3;
        const speed = baseSpeed * Math.pow(1.2, level - 1); // 1.2x increase per level

        ballSpeedX = Math.cos(ballAngle) * speed;
        ballSpeedY = Math.sin(ballAngle) * speed;

        rotation = 0;
        ballOpacity = 0.7;
        ballBlur = 2;
        ballLaunched = true;
    }

    function drawStar(x, y, radius, rotation) {
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
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.restore();
    }

    function updateScore() {
        if (leftScoreEl) leftScoreEl.textContent = leftScore;
        if (rightScoreEl) rightScoreEl.textContent = rightScore;
    }

    function checkLevelUp() {
        const newLevel = Math.floor(totalPoints / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
        }
    }

    function playStreakSound(streak, isLeftPlayer) {
        let soundToPlay = null;
        if (streak === 2) {
            soundToPlay = doubleBonkSound;
        } else if (streak === 3) {
            soundToPlay = tripleBonkSound;
        } else if (streak >= 5) {
            soundToPlay = streakSounds[Math.floor(Math.random() * streakSounds.length)];
        }
        if (soundToPlay) {
            soundToPlay.currentTime = 0;
            soundToPlay.play().catch(e => console.log("Streak sound play failed:", e));
        }
    }

    function playLoseStreakSound(loseStreak, isLeftPlayer) {
        let soundToPlay = null;
        if (loseStreak === 2) {
            soundToPlay = loseStreak2Sound;
        } else if (loseStreak >= 4) {
            soundToPlay = loseStreak4Sound;
        }
        if (soundToPlay) {
            soundToPlay.currentTime = 0;
            soundToPlay.play().catch(e => console.log("Lose streak sound play failed:", e));
        }
    }

    function handleTilt(event) {
        if (!isMobile || isPaddleAnimating) return;
        let gamma = event.gamma; // Left/right tilt in landscape (-90 to 90)
        
        // Clamp gamma to narrower range to prevent extreme tilts
        gamma = Math.max(-30, Math.min(30, gamma));
        
        // Smooth the gamma value
        smoothedGamma = smoothedGamma * smoothingFactor + gamma * (1 - smoothingFactor);
        
        // Map smoothed gamma to movement: positive (tilt right) moves up, negative (tilt left) moves down
        const tiltSpeed = smoothedGamma / 3.75; // More sensitive (original /4.5, increased by ~20%)
        leftPaddleY = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, leftPaddleY + tiltSpeed));
    }

    function aiMove(paddleY) {
        if (ballSpeedX <= 0) return paddleY;
        
        const paddleX = rightPaddleX;
        const timeToPaddle = Math.abs((paddleX - ballX) / ballSpeedX);
        let predictedY = ballY + ballSpeedY * timeToPaddle;
        
        let remainingTime = timeToPaddle;
        let currentY = ballY;
        let currentSpeedY = ballSpeedY;
        
        while (remainingTime > 0) {
            if (currentSpeedY > 0) {
                const timeToBottom = (HEIGHT - currentY) / currentSpeedY;
                if (timeToBottom <= remainingTime) {
                    remainingTime -= timeToBottom;
                    currentY = HEIGHT;
                    currentSpeedY *= -1;
                    predictedY = HEIGHT + currentSpeedY * remainingTime;
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
            const targetY = predictedY - PADDLE_HEIGHT / 2;
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
        
        return Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, paddleY));
    }

    function checkGameOver() {
        if (HUMAN_VS_COMPUTER && rightScore >= leftScore + 10) {
            gameOver = true;
            if (gameOverEl) gameOverEl.style.display = "block";
            gameRunning = false;
            backgroundSound.pause();
            backgroundSound.currentTime = 0;
            setTimeout(() => {
                submitScores();
                showMenu();
            }, 5000);
        }
    }

    function submitScores() {
        let scoreToSend = leftScore;
        if (gameMode === 'challenge' || gameMode === 'accept') {
            scoreToSend = leftScore + rightScore;
        }
        
        const formData = new FormData();
        formData.append('action', 'submit_score');
        formData.append('score', scoreToSend);
        if (challengeId) {
            formData.append('challenge_id', challengeId);
        }
        
        fetch(window.location.href, {
            method: "POST",
            body: new URLSearchParams(formData)
        });
    }

    function gameLoop(timestamp) {
        if (!gameRunning || currentState !== STATE_PLAYING) return;

        if (timestamp - lastTime < 16) {
            requestAnimationFrame(gameLoop);
            return;
        }
        lastTime = timestamp;

        if (!ctx || canvas.width !== gamePlayWindow.clientWidth || canvas.height !== gamePlayWindow.clientHeight) {
            initializeCanvas();
        }

        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        if (isPaddleAnimating) {
            paddleAnimationProgress += 16 / paddleAnimationDuration;
            if (paddleAnimationProgress >= 1) {
                paddleAnimationProgress = 1;
                isPaddleAnimating = false;
                if (!ballLaunched) {
                    resetBall();
                }
            }

            const easedProgress = 1 - Math.pow(1 - paddleAnimationProgress, 3); // Ease-out cubic
            leftPaddleX = leftPaddleXStart + easedProgress * (WIDTH * 0.05 - leftPaddleXStart);
            rightPaddleX = rightPaddleXStart - easedProgress * (WIDTH - PADDLE_WIDTH - rightPaddleXStart + WIDTH * 0.05);
        }

        if (!isPaddleAnimating) {
            if (!isMobile) {
                if (keys["KeyW"]) leftPaddleY = Math.max(0, leftPaddleY - 12); // Increased by 20%
                if (keys["KeyS"]) leftPaddleY = Math.min(HEIGHT - PADDLE_HEIGHT, leftPaddleY + 12); // Increased by 20%
            }

            if (HUMAN_VS_COMPUTER) {
                if (ballSpeedX > 0 && ballLaunched) {
                    rightPaddleY = aiMove(rightPaddleY);
                }
            } else {
                if (!isMobile) {
                    if (keys["ArrowUp"]) rightPaddleY = Math.max(0, rightPaddleY - 12); // Increased by 20%
                    if (keys["ArrowDown"]) rightPaddleY = Math.min(HEIGHT - PADDLE_HEIGHT, rightPaddleY + 12); // Increased by 20%
                }
            }

            if (ballLaunched) {
                ballX += ballSpeedX / 60;
                ballY += ballSpeedY / 60;

                if (ballY <= 0) {
                    ballY = 0;
                    ballSpeedY = Math.abs(ballSpeedY);
                    rotation += 0.1;
                } else if (ballY >= HEIGHT) {
                    ballY = HEIGHT;
                    ballSpeedY = -Math.abs(ballSpeedY);
                    rotation += 0.1;
                }

                if (
                    ballX - BALL_RADIUS < leftPaddleX + PADDLE_WIDTH &&
                    ballX + BALL_RADIUS > leftPaddleX &&
                    ballY > leftPaddleY &&
                    ballY < leftPaddleY + PADDLE_HEIGHT &&
                    ballSpeedX < 0
                ) {
                    const hitPos = (ballY - leftPaddleY) / PADDLE_HEIGHT;
                    const angleFactor = (hitPos - 0.5) * 0.8;
                    const newAngle = angleFactor * Math.PI / 2;
                    
                    const currentSpeed = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
                    ballSpeedX = Math.abs(Math.cos(newAngle) * currentSpeed);
                    ballSpeedY = Math.sin(newAngle) * currentSpeed;
                    rotation += 0.05;
                    ballX = leftPaddleX + PADDLE_WIDTH + BALL_RADIUS;
                    
                    try {
                        paddleStrikeSound.currentTime = 0;
                        paddleStrikeSound.play().catch(e => console.log("Audio play failed:", e));
                    } catch (e) {
                        console.log("Could not play paddle sound:", e);
                    }
                }

                if (
                    ballX + BALL_RADIUS > rightPaddleX &&
                    ballX - BALL_RADIUS < rightPaddleX + PADDLE_WIDTH &&
                    ballY > rightPaddleY &&
                    ballY < rightPaddleY + PADDLE_HEIGHT &&
                    ballSpeedX > 0
                ) {
                    const hitPos = (ballY - rightPaddleY) / PADDLE_HEIGHT;
                    const angleFactor = (hitPos - 0.5) * 0.8;
                    const newAngle = Math.PI - (angleFactor * Math.PI / 2);
                    
                    const currentSpeed = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
                    ballSpeedX = -Math.abs(Math.cos(newAngle) * currentSpeed);
                    ballSpeedY = Math.sin(newAngle) * currentSpeed;
                    rotation += 0.05;
                    ballX = rightPaddleX - BALL_RADIUS;
                    
                    try {
                        paddleStrikeSound.currentTime = 0;
                        paddleStrikeSound.play().catch(e => console.log("Audio play failed:", e));
                    } catch (e) {
                        console.log("Could not play paddle sound:", e);
                    }
                }

                let scored = false;
                if (ballX < 0 && !scored) {
                    rightScore++;
                    rightStreak++;
                    leftLoseStreak++;
                    leftStreak = 0;
                    rightLoseStreak = 0;
                    if (HUMAN_VS_COMPUTER) {
                        playLoseStreakSound(leftLoseStreak, true);
                    } else {
                        playStreakSound(rightStreak, false);
                        playLoseStreakSound(leftLoseStreak, true);
                    }
                    scored = true;
                    totalPoints++;
                    updateScore();
                    checkLevelUp();
                    checkGameOver();
                    if ((gameMode === 'challenge' || gameMode === 'accept') && !gameOver) {
                        submitScores();
                    }
                    if (!gameOver) resetBall();
                } else if (ballX > WIDTH && !scored) {
                    leftScore++;
                    leftStreak++;
                    rightLoseStreak++;
                    rightStreak = 0;
                    leftLoseStreak = 0;
                    playStreakSound(leftStreak, true);
                    if (!HUMAN_VS_COMPUTER) {
                        playLoseStreakSound(rightLoseStreak, false);
                    }
                    scored = true;
                    totalPoints++;
                    updateScore();
                    checkLevelUp();
                    checkGameOver();
                    if ((gameMode === 'challenge' || gameMode === 'accept') && !gameOver) {
                        submitScores();
                    }
                    if (!gameOver) resetBall();
                }
            }
        }

        if (!isPaddleAnimating || paddleAnimationProgress > 0) {
            ctx.fillStyle = "white";
            ctx.fillRect(leftPaddleX, leftPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
            ctx.fillRect(rightPaddleX, rightPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
        }

        if (ballLaunched) {
            drawStar(ballX, ballY, BALL_RADIUS, rotation);
        }

        ballOpacity += 0.005 * opacityDirection;
        if (ballOpacity >= 0.9 || ballOpacity <= 0.7) opacityDirection *= -1;

        ballBlur += 0.1 * blurDirection;
        if (ballBlur >= 15 || ballBlur <= 2) blurDirection *= -1;

        rotation += 0.02;

        requestAnimationFrame(gameLoop);
    }

    const keys = {};
    window.addEventListener("keydown", e => keys[e.code] = true);
    window.addEventListener("keyup", e => keys[e.code] = false);

    if (exitBtn) {
        exitBtn.onclick = () => {
            if (challengeId) {
                fetch(window.location.href, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: `action=end_challenge&challenge_id=${challengeId}`
                });
            }
            submitScores();
            if (challengeInterval) clearInterval(challengeInterval);
            backgroundSound.pause();
            backgroundSound.currentTime = 0;
            showMenu();
        };
    }

    if (fullscreenBtn) {
        fullscreenBtn.onclick = () => {
            if (!document.fullscreenElement) {
                gameDiv.requestFullscreen().catch(err => console.error(err));
            } else {
                document.exitFullscreen();
            }
        };
    }

    window.playSolo = function() {
        gameMode = 'solo';
        HUMAN_VS_COMPUTER = true;
        showGame();
    };

    window.startChallenge = function() {
        createChallenge();
    };

    window.acceptChallenge = function() {
        showChallengeList();
    };

    window.showRules = function() {
        showRules();
    };

    window.closeRules = function() {
        showMenu();
    };

    window.showMenu = showMenu;

    showMenu();
})();