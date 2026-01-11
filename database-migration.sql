-- Database Migration for Edit Profile Feature
-- Fix NULL defaults and update existing NULL values

-- Step 1: Update existing NULL values for user_bio
UPDATE users SET user_bio = '' WHERE user_bio IS NULL;

-- Step 2: Update existing NULL values for available_avatars
UPDATE users SET available_avatars = '[]' WHERE available_avatars IS NULL;

-- Step 3: Modify user_bio column to have proper default
ALTER TABLE users MODIFY COLUMN user_bio VARCHAR(500) NOT NULL DEFAULT '';

-- Step 4: Modify available_avatars column to have proper default
ALTER TABLE users MODIFY COLUMN available_avatars LONGTEXT NOT NULL DEFAULT '[]';

-- Step 5: Verify the changes
DESCRIBE users;
