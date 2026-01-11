-- Multiplayer Game State Migration
-- Adds fields to challenges table for real-time game synchronization

-- Add game state fields to challenges table
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS game_state LONGTEXT DEFAULT NULL COMMENT 'JSON containing ball position, velocities, and paddle positions';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS host_paddle_y FLOAT DEFAULT 50 COMMENT 'Host (creator) paddle Y position percentage';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS client_paddle_y FLOAT DEFAULT 50 COMMENT 'Client (opponent) paddle Y position percentage';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last game state update timestamp';

-- Verify the changes
DESCRIBE challenges;
