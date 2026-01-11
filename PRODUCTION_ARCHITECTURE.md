# BuddyWilde Production Architecture

## Overview

This document outlines the architecture for migrating from WordPress to a standalone React application with Node.js backend services.

## Current State (Development)
- React frontend (Vite)
- PHP backend (WordPress-dependent)
- MySQL database
- Local development on port 5173

## Target State (Production)
- React SPA (Static Build)
- Node.js WebSocket Server (Multi-game support)
- Node.js REST API Server (Replaces PHP endpoints)
- MySQL database (Direct access, no WordPress)
- Nginx reverse proxy
- SSL/TLS encryption

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Cloudflare CDN                        │
│                    (SSL Termination & DDoS)                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                      │
│                    (buddywilde.com:443)                      │
├─────────────────────────────────────────────────────────────┤
│  Routes:                                                     │
│  - / → React Static Files (/)                               │
│  - /api/* → Node.js REST API (:3000)                        │
│  - /ws → WebSocket Server (:8080)                           │
└───────────┬─────────────────────┬──────────────┬───────────┘
            │                     │              │
            ▼                     ▼              ▼
┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐
│  React SPA      │   │  Node.js REST    │   │  WebSocket   │
│  (Static Files) │   │  API Server      │   │  Game Server │
│                 │   │  Port: 3000      │   │  Port: 8080  │
│  - Vite Build   │   │                  │   │              │
│  - /dist folder │   │  Endpoints:      │   │  Games:      │
│                 │   │  - /auth         │   │  - Pong      │
│                 │   │  - /user         │   │  - Card Game │
│                 │   │  - /game         │   │  - Future... │
│                 │   │  - /leaderboard  │   │              │
└─────────────────┘   └──────────┬───────┘   └──────┬───────┘
                                 │                  │
                                 ▼                  ▼
                    ┌────────────────────────────────────┐
                    │         MySQL Database              │
                    │                                     │
                    │  Tables:                            │
                    │  - users                            │
                    │  - challenges (pong)                │
                    │  - card_games                       │
                    │  - star_bonk_scores                 │
                    │  - sessions                         │
                    │  - leaderboard                      │
                    └─────────────────────────────────────┘
```

## Services Breakdown

### 1. React Frontend (Static SPA)

**Location**: `/var/www/buddywilde.com/public_html/`

**Build Process**:
```bash
npm run build
# Outputs to /dist
```

**Nginx Config**:
```nginx
location / {
    root /var/www/buddywilde.com/public_html;
    try_files $uri $uri/ /index.html;
}
```

**Features**:
- Single Page Application
- Client-side routing (React Router)
- Game components (Pong, Card Game)
- User authentication (JWT tokens)
- WebSocket connections for real-time games

### 2. Node.js REST API Server

**Location**: `/var/www/buddywilde.com/api-server/`

**Purpose**: Replace all PHP endpoints with Node.js

**Endpoints to Migrate**:

| Current PHP Endpoint | New Node.js Endpoint | Function |
|---------------------|---------------------|----------|
| `action=login_user` | `POST /api/auth/login` | User login |
| `action=register_user` | `POST /api/auth/register` | User registration |
| `action=verify_email` | `POST /api/auth/verify` | Email verification |
| `action=get_user_data` | `GET /api/user/profile` | Get user data |
| `action=update_user_profile` | `PUT /api/user/profile` | Update profile |
| `action=get_star_bonk_challenges` | `GET /api/games/pong/challenges` | Get pong challenges |
| `action=create_star_bonk_challenge` | `POST /api/games/pong/challenges` | Create challenge |
| `action=submit_star_bonk_score` | `POST /api/games/pong/scores` | Submit score |

**Tech Stack**:
- Express.js
- JWT authentication
- mysql2 for database
- bcrypt for password hashing
- Express-validator for input validation

**PM2 Configuration**:
```json
{
  "apps": [{
    "name": "buddywilde-api",
    "script": "server.js",
    "cwd": "/var/www/buddywilde.com/api-server/",
    "instances": 2,
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 3000
    }
  }]
}
```

### 3. WebSocket Game Server

**Location**: `/var/www/buddywilde.com/websocket-server/`

**Purpose**: Real-time multiplayer game coordination

**Supported Games**:
- **Pong** (2 players)
  - Server-authoritative physics
  - 60 FPS tick rate
  - Score tracking

- **Card Game** (2-4 players)
  - Turn-based
  - Shared deck
  - Player hands (private state)

**PM2 Configuration**:
```json
{
  "apps": [{
    "name": "buddywilde-games",
    "script": "server-refactored.js",
    "cwd": "/var/www/buddywilde.com/websocket-server/",
    "instances": 1,
    "env": {
      "NODE_ENV": "production",
      "WS_PORT": 8080
    }
  }]
}
```

### 4. Database Schema

**Migration from WordPress**:

Current tables to keep:
- `users` (modified for standalone use)
- `challenges` (pong games)
- `star_bonk_scores`

New tables to create:
- `sessions` (JWT session management)
- `card_games` (card game instances)
- `card_game_players` (player participation)
- `game_stats` (cross-game statistics)
- `leaderboard` (unified leaderboard)

**Schema Updates**:
```sql
-- Remove WordPress dependencies
ALTER TABLE users DROP COLUMN IF EXISTS user_url;
ALTER TABLE users DROP COLUMN IF EXISTS user_activation_key;
ALTER TABLE users DROP COLUMN IF EXISTS user_status;

-- Add session management
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_token (token(255)),
  INDEX idx_user_id (user_id)
);

-- Add card game tables
CREATE TABLE IF NOT EXISTS card_games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_code VARCHAR(20) UNIQUE NOT NULL,
  status ENUM('waiting', 'active', 'finished', 'cancelled') DEFAULT 'waiting',
  max_players INT DEFAULT 4,
  min_players INT DEFAULT 2,
  game_state LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS card_game_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  user_id INT NOT NULL,
  position INT NOT NULL,
  score INT DEFAULT 0,
  status ENUM('waiting', 'ready', 'playing', 'finished') DEFAULT 'waiting',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES card_games(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name buddywilde.com www.buddywilde.com;

    ssl_certificate /etc/letsencrypt/live/buddywilde.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/buddywilde.com/privkey.pem;

    # React SPA
    location / {
        root /var/www/buddywilde.com/public_html;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # REST API
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name buddywilde.com www.buddywilde.com;
    return 301 https://$server_name$request_uri;
}
```

## Deployment Steps

### Phase 1: Setup Infrastructure (Week 1)

1. **Create Node.js REST API Server**
   - Migrate PHP endpoints to Express.js
   - Implement JWT authentication
   - Add input validation
   - Write unit tests

2. **Update Database Schema**
   - Run migration scripts
   - Remove WordPress dependencies
   - Create new tables

3. **Setup WebSocket Server**
   - Deploy game server
   - Configure PM2
   - Test multiplayer games

### Phase 2: Frontend Migration (Week 2)

1. **Update React App**
   - Replace PHP API calls with new REST endpoints
   - Implement JWT token storage
   - Update WebSocket URLs
   - Add error handling

2. **Build & Deploy Static Assets**
   - Run production build
   - Upload to server
   - Configure Nginx

### Phase 3: Testing (Week 3)

1. **Staging Environment**
   - Deploy to staging subdomain
   - Test all features
   - Performance testing
   - Security audit

2. **Load Testing**
   - Test concurrent users
   - WebSocket stress test
   - Database query optimization

### Phase 4: Production Cutover (Week 4)

1. **Backup Current Site**
   - Full database backup
   - WordPress files backup

2. **Deploy New Architecture**
   - Update DNS (if needed)
   - Deploy all services
   - Configure monitoring

3. **Monitoring & Optimization**
   - Setup error logging
   - Performance monitoring
   - User analytics

## File Structure

```
/var/www/buddywilde.com/
├── public_html/              # React build output
│   ├── index.html
│   ├── assets/
│   └── ...
├── api-server/               # Node.js REST API
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   └── package.json
├── websocket-server/         # WebSocket game server
│   ├── server-refactored.js
│   ├── gameTypes/
│   │   ├── PongGame.js
│   │   └── CardGame.js
│   └── package.json
└── backups/                  # WordPress backups
    └── wordpress/
```

## Security Considerations

1. **Authentication**
   - JWT tokens with refresh mechanism
   - HTTP-only cookies for refresh tokens
   - CSRF protection

2. **Rate Limiting**
   - API endpoint rate limits
   - WebSocket connection limits
   - Brute force protection

3. **Input Validation**
   - Express-validator on all inputs
   - SQL injection prevention (parameterized queries)
   - XSS protection

4. **SSL/TLS**
   - Force HTTPS
   - HSTS headers
   - Secure WebSocket (WSS)

## Monitoring & Maintenance

1. **PM2 Monitoring**
   ```bash
   pm2 logs
   pm2 monit
   pm2 status
   ```

2. **Database Monitoring**
   - Slow query log
   - Connection pool monitoring
   - Regular backups

3. **Error Tracking**
   - Consider Sentry.io for error tracking
   - Log aggregation
   - Alert system

## Future Enhancements

- [ ] Redis for session storage
- [ ] Websocket horizontal scaling (Redis pub/sub)
- [ ] CDN for static assets
- [ ] GraphQL API option
- [ ] Mobile app (React Native)
- [ ] Admin dashboard
- [ ] Analytics dashboard
- [ ] Automated backups
- [ ] CI/CD pipeline
