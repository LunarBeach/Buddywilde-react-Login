<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// CORS headers - allow localhost:5173 for React development
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Load environment variables from .env file
function loadEnv($path) {
    if (!file_exists($path)) {
        throw new Exception(".env file not found at: " . $path);
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments and empty lines
        if (strpos($line, '#') === 0 || empty(trim($line))) {
            continue;
        }
        
        // Parse key=value pairs
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        
        // Remove quotes if present
        $value = trim($value, '"\'');
        
        // Set as environment variable
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}

// Email sending function
function send_email($to, $subject, $message, $from = 'noreply@buddywilde.com') {
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: Buddy Wilde <" . $from . ">" . "\r\n";
    
    return mail($to, $subject, $message, $headers);
}

// Email template functions
function get_verification_email_template($verification_code, $user_name = '') {
    return "
    <html>
    <head>
        <title>Verify Your Email</title>
    </head>
    <body>
        <h2>Email Verification</h2>
        <p>Hello " . (!empty($user_name) ? htmlspecialchars($user_name) : 'User') . ",</p>
        <p>Thank you for registering with Buddy Wilde. Please use the following 6-digit verification code to verify your email address:</p>
        <h3 style='font-size: 24px; letter-spacing: 5px; background: #f5f5f5; padding: 10px; text-align: center;'>" . $verification_code . "</h3>
        <p>This code will expire in 24 hours.</p>
        <p>If you didn't register for an account, please ignore this email.</p>
        <br>
        <p>Best regards,<br>The Buddy Wilde Team</p>
    </body>
    </html>
    ";
}

function get_password_reset_email_template($reset_code) {
    return "
    <html>
    <head>
        <title>Password Reset</title>
    </head>
    <body>
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>You have requested to reset your password. Please use the following 6-digit code to reset your password:</p>
        <h3 style='font-size: 24px; letter-spacing: 5px; background: #f5f5f5; padding: 10px; text-align: center;'>" . $reset_code . "</h3>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <br>
        <p>Best regards,<br>The Buddy Wilde Team</p>
    </body>
    </html>
    ";
}

try {
    // Load environment variables
    loadEnv(__DIR__ . '/.env');
    
    // Get input data
    $raw_input = file_get_contents('php://input');
    error_log("Raw input: " . $raw_input);
    
    $input = json_decode($raw_input, true);
    if (!$input) {
        $input = $_POST;
        error_log("Using POST data: " . print_r($_POST, true));
    }
    
    $action = $input['action'] ?? 'test';
    error_log("Action: " . $action);
    
    // Test action
    if ($action === 'test') {
        try {
            $host = $_ENV['DB_HOST'] ?? 'localhost';
            $dbname = $_ENV['DB_NAME'] ?? '';
            $username = $_ENV['DB_USER'] ?? '';
            $password = $_ENV['DB_PASS'] ?? '';
            
            $test_pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
            $test_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $db_connected = true;
            $db_error = null;
        } catch (PDOException $e) {
            $db_connected = false;
            $db_error = $e->getMessage();
            error_log("Database connection error: " . $db_error);
        }
        
        echo json_encode([
            'php_working' => true,
            'db_connected' => $db_connected,
            'db_error' => $db_connected ? null : $db_error,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        exit;
    }
    
    // Database connection for other actions
    try {
        $host = $_ENV['DB_HOST'] ?? 'localhost';
        $dbname = $_ENV['DB_NAME'] ?? '';
        $username = $_ENV['DB_USER'] ?? '';
        $password = $_ENV['DB_PASS'] ?? '';
        
        $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $e) {
        $error_msg = "Database connection failed: " . $e->getMessage();
        error_log($error_msg);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $error_msg]);
        exit;
    }
    
    // Handle actions
    switch ($action) {
        case 'check_user_exists':
            error_log("Processing check_user_exists");
            $email = $input['email'] ?? '';
            $display_name = $input['display_name'] ?? '';
            
            $response = [
                'email_exists' => false,
                'display_name_exists' => false
            ];
            
            try {
                if (!empty($email)) {
                    error_log("Checking email: " . $email);
                    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                    $stmt->execute([$email]);
                    $response['email_exists'] = $stmt->rowCount() > 0;
                    error_log("Email exists: " . ($response['email_exists'] ? 'true' : 'false'));
                }
                
                if (!empty($display_name)) {
                    error_log("Checking display_name: " . $display_name);
                    $stmt = $pdo->prepare("SELECT id FROM users WHERE display_name = ?");
                    $stmt->execute([$display_name]);
                    $response['display_name_exists'] = $stmt->rowCount() > 0;
                    error_log("Display name exists: " . ($response['display_name_exists'] ? 'true' : 'false'));
                }
            } catch (Exception $e) {
                error_log("Error in check_user_exists: " . $e->getMessage());
            }
            
            echo json_encode($response);
            error_log("Response sent: " . json_encode($response));
            break;
            
        case 'register_user':
            error_log("Processing register_user");
            $display_name = trim($input['display_name'] ?? '');
            $email = trim($input['email'] ?? '');
            $password = $input['password'] ?? '';
            
            error_log("Registration data - Email: $email, Display Name: $display_name");
            
            // Basic validation
            if (empty($display_name) || empty($email) || empty($password)) {
                error_log("Registration validation failed - missing fields");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'All fields are required']);
                break;
            }
            
            if (strlen($password) < 6) {
                error_log("Registration validation failed - password too short");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters']);
                break;
            }
            
            // Check if user already exists
            try {
                error_log("Checking if user already exists");
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? OR display_name = ?");
                $stmt->execute([$email, $display_name]);
                
                if ($stmt->rowCount() > 0) {
                    error_log("User already exists");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'User already exists']);
                    break;
                }
                
                // Generate verification code
                $verification_code = rand(100000, 999999);
                
                // Hash password
                error_log("Hashing password");
                $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                
                // Insert user - adjust column names to match your table
                error_log("Inserting user into database");
                $stmt = $pdo->prepare("
                    INSERT INTO users 
                    (display_name, email, password_hash, verification_code, email_verified, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, 0, NOW(), NOW())
                ");
                
                $result = $stmt->execute([
                    $display_name,
                    $email,
                    $hashed_password,
                    $verification_code
                ]);
                
                if ($result) {
                    $user_id = $pdo->lastInsertId();
                    error_log("Registration successful - User ID: " . $user_id);
                    
                    // Send verification email
                    $email_sent = false;
                    $email_error = '';
                    
                    try {
                        $email_subject = 'Verify Your Email - Buddy Wilde';
                        $email_message = get_verification_email_template($verification_code, $display_name);
                        $email_sent = send_email($email, $email_subject, $email_message);
                        
                        if ($email_sent) {
                            error_log("Verification email sent successfully to: " . $email);
                        } else {
                            error_log("Failed to send verification email to: " . $email);
                            $email_error = 'Failed to send verification email';
                        }
                    } catch (Exception $e) {
                        error_log("Email sending error: " . $e->getMessage());
                        $email_error = 'Email sending failed: ' . $e->getMessage();
                    }
                    
                    echo json_encode([
                        'success' => true, 
                        'user_id' => $user_id,
                        'email_sent' => $email_sent,
                        'email_error' => $email_error
                        // Remove verification_code in production!
                    ]);
                } else {
                    error_log("Registration failed - database insert failed");
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Registration failed']);
                }
            } catch (Exception $e) {
                error_log("Registration error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Registration failed: ' . $e->getMessage()]);
            }
            break;
            
        case 'login_user':
            error_log("Processing login_user");
            $email = trim($input['email'] ?? '');
            $password = $input['password'] ?? '';
            
            error_log("Login attempt - Email: $email");
            
            if (empty($email) || empty($password)) {
                error_log("Login validation failed - missing fields");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email and password are required']);
                break;
            }
            
            try {
                $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                
                if (!$user) {
                    error_log("Login failed - User not found");
                    http_response_code(401);
                    echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
                    break;
                }
                
                // Check if email is verified
                if (!$user['email_verified']) {
                    error_log("Login failed - Email not verified");
                    http_response_code(401);
                    echo json_encode([
                        'success' => false, 
                        'error' => 'Email not verified. Please verify your email first.',
                        'email_not_verified' => true
                    ]);
                    break;
                }
                
                error_log("User found, checking password");
                
                if (password_verify($password, $user['password_hash'])) {
                    error_log("Login successful for user ID: " . $user['id']);
                    echo json_encode([
                        'success' => true,
                        'user' => [
                            'id' => $user['id'],
                            'display_name' => $user['display_name'],
                            'email' => $user['email'],
                            'avatar' => $user['avatar'] ?? null,
                            'total_score' => $user['total_score'] ?? 0
                        ]
                    ]);
                } else {
                    error_log("Login failed - Invalid password");
                    http_response_code(401);
                    echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
                }
            } catch (Exception $e) {
                error_log("Login error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Login failed: ' . $e->getMessage()]);
            }
            break;
            
        case 'verify_email':
            error_log("Processing verify_email");
            $email = trim($input['email'] ?? '');
            $verification_code = $input['verification_code'] ?? '';
            
            if (empty($email) || empty($verification_code)) {
                error_log("Verification failed - missing fields");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email and verification code are required']);
                break;
            }
            
            try {
                $stmt = $pdo->prepare("SELECT id, verification_code, email_verified FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                
                if (!$user) {
                    error_log("Verification failed - User not found");
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }
                
                if ($user['email_verified']) {
                    error_log("Verification failed - Email already verified");
                    echo json_encode(['success' => true, 'message' => 'Email already verified']);
                    break;
                }
                
                if ($verification_code == $user['verification_code']) {
                    // Update email_verified status
                    $update_stmt = $pdo->prepare("UPDATE users SET email_verified = 1, updated_at = NOW() WHERE email = ?");
                    $update_stmt->execute([$email]);
                    
                    error_log("Email verification successful for user: " . $email);
                    echo json_encode(['success' => true, 'message' => 'Email verified successfully']);
                } else {
                    error_log("Verification failed - Invalid code");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Invalid verification code']);
                }
            } catch (Exception $e) {
                error_log("Verification error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Verification failed: ' . $e->getMessage()]);
            }
            break;
            
        case 'resend_verification':
            error_log("Processing resend_verification");
            $email = trim($input['email'] ?? '');
            
            if (empty($email)) {
                error_log("Resend verification failed - missing email");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email is required']);
                break;
            }
            
            try {
                $stmt = $pdo->prepare("SELECT id, email_verified, display_name FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                
                if (!$user) {
                    error_log("Resend verification failed - User not found");
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }
                
                if ($user['email_verified']) {
                    error_log("Resend verification failed - Email already verified");
                    echo json_encode(['success' => true, 'message' => 'Email already verified']);
                    break;
                }
                
                // Generate new verification code
                $new_verification_code = rand(100000, 999999);
                
                // Update verification code in database
                $update_stmt = $pdo->prepare("UPDATE users SET verification_code = ?, updated_at = NOW() WHERE email = ?");
                $update_stmt->execute([$new_verification_code, $email]);
                
                // Send verification email
                $email_sent = false;
                $email_error = '';
                
                try {
                    $email_subject = 'Verify Your Email - Buddy Wilde (Resent)';
                    $email_message = get_verification_email_template($new_verification_code, $user['display_name']);
                    $email_sent = send_email($email, $email_subject, $email_message);
                    
                    if ($email_sent) {
                        error_log("Resend verification email sent successfully to: " . $email);
                    } else {
                        error_log("Failed to send resend verification email to: " . $email);
                        $email_error = 'Failed to send verification email';
                    }
                } catch (Exception $e) {
                    error_log("Email sending error: " . $e->getMessage());
                    $email_error = 'Email sending failed: ' . $e->getMessage();
                }
                
                echo json_encode([
                    'success' => true, 
                    'message' => 'Verification code resent successfully',
                    'email_sent' => $email_sent,
                    'email_error' => $email_error
                ]);
                
            } catch (Exception $e) {
                error_log("Resend verification error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to resend verification: ' . $e->getMessage()]);
            }
            break;
            
        case 'forgot_password':
            error_log("Processing forgot_password");
            $email = trim($input['email'] ?? '');
            
            if (empty($email)) {
                error_log("Forgot password failed - missing email");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email is required']);
                break;
            }
            
            try {
                $stmt = $pdo->prepare("SELECT id, email_verified, display_name FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                
                if (!$user) {
                    error_log("Forgot password failed - User not found");
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }
                
                // Generate password reset code
                $reset_code = rand(100000, 999999);
                
                // Store reset code
                $update_stmt = $pdo->prepare("UPDATE users SET verification_code = ?, updated_at = NOW() WHERE email = ?");
                $update_stmt->execute([$reset_code, $email]);
                
                // Send password reset email
                $email_sent = false;
                $email_error = '';
                
                try {
                    $email_subject = 'Password Reset - Buddy Wilde';
                    $email_message = get_password_reset_email_template($reset_code);
                    $email_sent = send_email($email, $email_subject, $email_message);
                    
                    if ($email_sent) {
                        error_log("Password reset email sent successfully to: " . $email);
                    } else {
                        error_log("Failed to send password reset email to: " . $email);
                        $email_error = 'Failed to send password reset email';
                    }
                } catch (Exception $e) {
                    error_log("Email sending error: " . $e->getMessage());
                    $email_error = 'Email sending failed: ' . $e->getMessage();
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Password reset code sent',
                    'email_verified' => (bool)$user['email_verified'],
                    'email_sent' => $email_sent,
                    'email_error' => $email_error
                ]);
                
            } catch (Exception $e) {
                error_log("Forgot password error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to process password reset: ' . $e->getMessage()]);
            }
            break;
            
        case 'reset_password':
            error_log("Processing reset_password");
            $email = trim($input['email'] ?? '');
            $reset_code = $input['reset_code'] ?? '';
            $new_password = $input['new_password'] ?? '';
            
            if (empty($email) || empty($reset_code) || empty($new_password)) {
                error_log("Reset password failed - missing fields");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'All fields are required']);
                break;
            }
            
            if (strlen($new_password) < 6) {
                error_log("Reset password failed - password too short");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters']);
                break;
            }
            
            try {
                $stmt = $pdo->prepare("SELECT id, verification_code, email_verified FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                
                if (!$user) {
                    error_log("Reset password failed - User not found");
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }
                
                if ($reset_code != $user['verification_code']) {
                    error_log("Reset password failed - Invalid code");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Invalid reset code']);
                    break;
                }
                
                // Hash new password
                $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
                
                // Update password and verify email if it wasn't verified
                $email_verified_update = $user['email_verified'] ? '' : ', email_verified = 1';
                $update_stmt = $pdo->prepare("UPDATE users SET password_hash = ?, verification_code = NULL, updated_at = NOW(){$email_verified_update} WHERE email = ?");
                $params = [$hashed_password, $email];
                $update_stmt->execute($params);
                
                $message = 'Password reset successfully';
                if (!$user['email_verified']) {
                    $message .= ' and email verified';
                }
                
                error_log("Password reset successful for user: " . $email);
                echo json_encode(['success' => true, 'message' => $message]);
                
            } catch (Exception $e) {
                error_log("Reset password error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to reset password: ' . $e->getMessage()]);
            }
            break;
            
        // Get user data action
        case 'get_user_data':
            error_log("Processing get_user_data");
            $email = trim($input['email'] ?? '');

            if (empty($email)) {
                error_log("Get user data failed - missing email");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email is required']);
                break;
            }

            try {
                $stmt = $pdo->prepare("SELECT id, display_name, email, avatar, total_score, user_bio, available_avatars FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();

                if (!$user) {
                    error_log("Get user data failed - User not found");
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }

                error_log("User data retrieved successfully for: " . $email);
                echo json_encode([
                    'success' => true,
                    'user' => [
                        'id' => $user['id'],
                        'display_name' => $user['display_name'],
                        'email' => $user['email'],
                        'avatar' => $user['avatar'] ?? null,
                        'total_score' => (int)($user['total_score'] ?? 0),
                        'user_bio' => $user['user_bio'] ?? '',
                        'available_avatars' => $user['available_avatars'] ?? '[]'
                    ]
                ]);

            } catch (Exception $e) {
                error_log("Get user data error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to retrieve user data: ' . $e->getMessage()]);
            }
            break;

        // Get available avatars from theme assets folder
        case 'get_available_avatars':
            error_log("Processing get_available_avatars");

            try {
                $avatars = [];

                // Add default avatar (always free)
                $avatars[] = [
                    'filename' => 'buddy-default.png',
                    'alt' => 'Default avatar',
                    'cost' => 0
                ];

                // Path to theme avatars directory
                $avatars_folder_path = $_SERVER['DOCUMENT_ROOT'] . '/wp-content/themes/buddy_wilde_theme/assets/avatars/';

                // Check if avatars directory exists
                if (is_dir($avatars_folder_path)) {
                    $files = scandir($avatars_folder_path);

                    foreach ($files as $file) {
                        // Skip . and ..
                        if ($file === '.' || $file === '..') {
                            continue;
                        }

                        // Only process PNG files
                        if (pathinfo($file, PATHINFO_EXTENSION) === 'png') {
                            $file_path = $avatars_folder_path . $file;
                            $cost = 0;

                            // Check for companion .txt file with cost
                            $txt_file = $avatars_folder_path . pathinfo($file, PATHINFO_FILENAME) . '.txt';
                            if (file_exists($txt_file)) {
                                $cost_value = trim(file_get_contents($txt_file));
                                // The txt file should contain just the number
                                if (is_numeric($cost_value)) {
                                    $cost = intval($cost_value);
                                }
                            }

                            $avatars[] = [
                                'filename' => $file,
                                'alt' => pathinfo($file, PATHINFO_FILENAME),
                                'cost' => $cost
                            ];
                        }
                    }
                }

                error_log("Avatars retrieved successfully: " . count($avatars) . " avatars");
                echo json_encode([
                    'success' => true,
                    'avatars' => $avatars
                ]);

            } catch (Exception $e) {
                error_log("Get avatars error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to retrieve avatars: ' . $e->getMessage()]);
            }
            break;

        // Get loop videos for background
        case 'get_loop_videos':
            error_log("Processing get_loop_videos");

            try {
                $videos = [];

                // Path to loop videos directory
                $videos_folder_path = $_SERVER['DOCUMENT_ROOT'] . '/wp-content/themes/buddy_wilde_theme/assets/loop_videos/';

                // Check if videos directory exists
                if (is_dir($videos_folder_path)) {
                    $files = scandir($videos_folder_path);

                    foreach ($files as $file) {
                        // Skip . and ..
                        if ($file === '.' || $file === '..') {
                            continue;
                        }

                        // Only process video files (mp4, webm, mov)
                        $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                        if (in_array($extension, ['mp4', 'webm', 'mov'])) {
                            $videos[] = $file;
                        }
                    }
                }

                error_log("Loop videos retrieved successfully: " . count($videos) . " videos");
                echo json_encode([
                    'success' => true,
                    'videos' => $videos
                ]);

            } catch (Exception $e) {
                error_log("Get loop videos error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to retrieve videos: ' . $e->getMessage()]);
            }
            break;

        // Update user profile
        case 'update_user_profile':
            error_log("Processing update_user_profile");
            $email = trim($input['email'] ?? '');
            $display_name = trim($input['display_name'] ?? '');
            $user_bio = trim($input['user_bio'] ?? '');
            $avatar = trim($input['avatar'] ?? '');
            $points_to_deduct = (int)($input['points_to_deduct'] ?? 0);
            $available_avatars = $input['available_avatars'] ?? null;

            if (empty($email) || empty($display_name)) {
                error_log("Update profile failed - missing required fields");
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Email and username are required']);
                break;
            }

            // Validate no URLs in username or bio
            $url_pattern = '/(https?:\/\/|www\.|\.[a-z]{2,})/i';
            if (preg_match($url_pattern, $display_name)) {
                error_log("Update profile failed - URL in username");
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Username cannot contain URLs or links']);
                break;
            }

            if (preg_match($url_pattern, $user_bio)) {
                error_log("Update profile failed - URL in bio");
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Bio cannot contain URLs or links']);
                break;
            }

            try {
                // Get current user data
                $stmt = $pdo->prepare("SELECT id, total_score, display_name FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();

                if (!$user) {
                    error_log("Update profile failed - User not found");
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'User not found']);
                    break;
                }

                $current_points = (int)($user['total_score'] ?? 0);

                // Check if user has enough points
                if ($points_to_deduct > $current_points) {
                    error_log("Update profile failed - Insufficient points");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Insufficient points to purchase this avatar']);
                    break;
                }

                // Calculate new points
                $new_points = $current_points - $points_to_deduct;

                // Update user profile
                $update_query = "UPDATE users SET
                    display_name = ?,
                    user_bio = ?,
                    avatar = ?,
                    total_score = ?";

                $params = [$display_name, $user_bio, $avatar, $new_points];

                // If purchasing a new avatar, update available_avatars
                if ($available_avatars !== null) {
                    $update_query .= ", available_avatars = ?";
                    $params[] = $available_avatars;
                }

                $update_query .= " WHERE email = ?";
                $params[] = $email;

                $update_stmt = $pdo->prepare($update_query);
                $update_stmt->execute($params);

                // Get updated user data
                $stmt = $pdo->prepare("SELECT id, display_name, email, avatar, total_score, user_bio, available_avatars FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $updated_user = $stmt->fetch();

                error_log("Profile updated successfully for: " . $email);
                echo json_encode([
                    'success' => true,
                    'message' => 'Profile updated successfully',
                    'user' => [
                        'id' => $updated_user['id'],
                        'display_name' => $updated_user['display_name'],
                        'email' => $updated_user['email'],
                        'avatar' => $updated_user['avatar'] ?? null,
                        'total_score' => (int)($updated_user['total_score'] ?? 0),
                        'user_bio' => $updated_user['user_bio'] ?? '',
                        'available_avatars' => $updated_user['available_avatars'] ?? '[]'
                    ]
                ]);

            } catch (Exception $e) {
                error_log("Update profile error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update profile: ' . $e->getMessage()]);
            }
            break;

        // Star Bonk game endpoints
        case 'get_star_bonk_challenges':
            error_log("Processing get_star_bonk_challenges");
            $email = trim($input['email'] ?? '');

            if (empty($email)) {
                error_log("Get challenges failed - missing email");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email is required']);
                break;
            }

            try {
                // Get user ID
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();

                if (!$user) {
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }

                // Get active challenges (not created by this user)
                $stmt = $pdo->prepare("
                    SELECT c.id, c.creator_id, u.display_name as creator_name, u.avatar as creator_avatar, c.created_at
                    FROM challenges c
                    JOIN users u ON c.creator_id = u.id
                    WHERE c.status = 'waiting'
                    AND c.creator_id != ?
                    AND c.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    ORDER BY c.created_at DESC
                ");
                $stmt->execute([$user['id']]);
                $challenges = $stmt->fetchAll(PDO::FETCH_ASSOC);

                echo json_encode([
                    'success' => true,
                    'challenges' => $challenges
                ]);

            } catch (Exception $e) {
                error_log("Get challenges error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to get challenges: ' . $e->getMessage()]);
            }
            break;

        case 'create_star_bonk_challenge':
            error_log("Processing create_star_bonk_challenge");
            $email = trim($input['email'] ?? '');

            if (empty($email)) {
                error_log("Create challenge failed - missing email");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email is required']);
                break;
            }

            try {
                // Get user ID
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();

                if (!$user) {
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }

                // Create challenge
                $stmt = $pdo->prepare("
                    INSERT INTO challenges
                    (creator_id, status, created_at)
                    VALUES (?, 'waiting', NOW())
                ");
                $stmt->execute([$user['id']]);
                $challenge_id = $pdo->lastInsertId();

                error_log("Challenge created successfully: " . $challenge_id);
                echo json_encode([
                    'success' => true,
                    'challenge_id' => $challenge_id
                ]);

            } catch (Exception $e) {
                error_log("Create challenge error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to create challenge: ' . $e->getMessage()]);
            }
            break;

        case 'join_star_bonk_challenge':
            error_log("Processing join_star_bonk_challenge");
            $email = trim($input['email'] ?? '');
            $challenge_id = (int)($input['challenge_id'] ?? 0);

            if (empty($email) || !$challenge_id) {
                error_log("Join challenge failed - missing parameters");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email and challenge ID are required']);
                break;
            }

            try {
                // Get user ID
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();

                if (!$user) {
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }

                // Update challenge
                $stmt = $pdo->prepare("
                    UPDATE challenges
                    SET opponent_id = ?, status = 'active', started_at = NOW()
                    WHERE id = ? AND status = 'waiting'
                ");
                $result = $stmt->execute([$user['id'], $challenge_id]);

                if ($result && $stmt->rowCount() > 0) {
                    error_log("Joined challenge successfully: " . $challenge_id);
                    echo json_encode(['success' => true]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Challenge not available']);
                }

            } catch (Exception $e) {
                error_log("Join challenge error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to join challenge: ' . $e->getMessage()]);
            }
            break;

        case 'submit_star_bonk_score':
            error_log("Processing submit_star_bonk_score");
            $email = trim($input['email'] ?? '');
            $score = (int)($input['score'] ?? 0);
            $challenge_id = $input['challenge_id'] ?? null;

            if (empty($email)) {
                error_log("Submit score failed - missing email");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email is required']);
                break;
            }

            try {
                // Get user
                $stmt = $pdo->prepare("SELECT id, total_score FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();

                if (!$user) {
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }

                // Update user's total score
                $new_total = $user['total_score'] + $score;
                $stmt = $pdo->prepare("UPDATE users SET total_score = ? WHERE id = ?");
                $stmt->execute([$new_total, $user['id']]);

                // Save score to star_bonk_scores table
                $stmt = $pdo->prepare("
                    INSERT INTO star_bonk_scores
                    (user_id, score, challenge_id, created_at)
                    VALUES (?, ?, ?, NOW())
                ");
                $stmt->execute([$user['id'], $score, $challenge_id]);

                // If challenge game, update challenge score
                if ($challenge_id) {
                    $stmt = $pdo->prepare("
                        UPDATE challenges
                        SET creator_score = CASE WHEN creator_id = ? THEN ? ELSE creator_score END,
                            opponent_score = CASE WHEN opponent_id = ? THEN ? ELSE opponent_score END
                        WHERE id = ?
                    ");
                    $stmt->execute([$user['id'], $score, $user['id'], $score, $challenge_id]);
                }

                error_log("Score submitted successfully for user: " . $email);
                echo json_encode([
                    'success' => true,
                    'new_total_score' => $new_total
                ]);

            } catch (Exception $e) {
                error_log("Submit score error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to submit score: ' . $e->getMessage()]);
            }
            break;

        case 'end_star_bonk_challenge':
            error_log("Processing end_star_bonk_challenge");
            $email = trim($input['email'] ?? '');
            $challenge_id = (int)($input['challenge_id'] ?? 0);

            if (empty($email) || !$challenge_id) {
                error_log("End challenge failed - missing parameters");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email and challenge ID are required']);
                break;
            }

            try {
                // Get user ID
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();

                if (!$user) {
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }

                // Get current challenge status to determine if it should be cancelled or finished
                $status_stmt = $pdo->prepare("SELECT status FROM challenges WHERE id = ?");
                $status_stmt->execute([$challenge_id]);
                $challenge = $status_stmt->fetch();

                // If challenge is still waiting, mark as cancelled. Otherwise, mark as finished.
                $new_status = ($challenge && $challenge['status'] === 'waiting') ? 'cancelled' : 'finished';

                // Update challenge status
                $stmt = $pdo->prepare("
                    UPDATE challenges
                    SET status = ?, ended_at = NOW()
                    WHERE id = ? AND (creator_id = ? OR opponent_id = ?)
                ");
                $stmt->execute([$new_status, $challenge_id, $user['id'], $user['id']]);

                error_log("Challenge ended successfully: " . $challenge_id);
                echo json_encode(['success' => true]);

            } catch (Exception $e) {
                error_log("End challenge error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to end challenge: ' . $e->getMessage()]);
            }
            break;

        case 'check_challenge_status':
            error_log("Processing check_challenge_status");
            $challenge_id = (int)($input['challenge_id'] ?? 0);

            if (!$challenge_id) {
                error_log("Check challenge status failed - missing challenge ID");
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Challenge ID required']);
                break;
            }

            try {
                $stmt = $pdo->prepare("
                    SELECT c.status, u.display_name as opponent_name, u.avatar as opponent_avatar
                    FROM challenges c
                    LEFT JOIN users u ON c.opponent_id = u.id
                    WHERE c.id = ?
                ");
                $stmt->execute([$challenge_id]);
                $challenge = $stmt->fetch();

                if ($challenge) {
                    error_log("Challenge status retrieved: " . $challenge['status']);
                    echo json_encode([
                        'success' => true,
                        'status' => $challenge['status'],
                        'opponent_name' => $challenge['opponent_name'],
                        'opponent_avatar' => $challenge['opponent_avatar']
                    ]);
                } else {
                    error_log("Challenge not found: " . $challenge_id);
                    echo json_encode(['success' => false, 'error' => 'Challenge not found']);
                }
            } catch (Exception $e) {
                error_log("Check challenge status error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to check challenge status']);
            }
            break;

        default:
            error_log("Invalid action: " . $action);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action: ' . $action]);
    }
    
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>
