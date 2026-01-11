<?php
// Test script to verify score submission works
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Load environment variables from .env file
function loadEnv($path) {
    if (!file_exists($path)) {
        throw new Exception(".env file not found at: " . $path);
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0 || empty(trim($line))) {
            continue;
        }
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        $value = trim($value, '"\'');
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}

try {
    loadEnv(__DIR__ . '/.env');

    $host = $_ENV['DB_HOST'] ?? 'localhost';
    $dbname = $_ENV['DB_NAME'] ?? '';
    $username = $_ENV['DB_USER'] ?? '';
    $password = $_ENV['DB_PASS'] ?? '';

    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Database connection successful!\n\n";

    // Get a test user (use your email)
    $test_email = 'your-email@example.com'; // REPLACE WITH YOUR ACTUAL EMAIL

    $stmt = $pdo->prepare("SELECT id, email, display_name, total_score FROM users WHERE email = ?");
    $stmt->execute([$test_email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo "User not found with email: $test_email\n";
        echo "Please update the \$test_email variable with your actual email address.\n";
        exit;
    }

    echo "Current user data:\n";
    echo "ID: " . $user['id'] . "\n";
    echo "Email: " . $user['email'] . "\n";
    echo "Display Name: " . $user['display_name'] . "\n";
    echo "Current total_score: " . ($user['total_score'] ?? 0) . "\n\n";

    // Test score to add
    $test_score = 6;
    $new_total = ($user['total_score'] ?? 0) + $test_score;

    echo "Attempting to add $test_score points...\n";
    echo "New total should be: $new_total\n\n";

    // Update the score
    $stmt = $pdo->prepare("UPDATE users SET total_score = ? WHERE id = ?");
    $result = $stmt->execute([$new_total, $user['id']]);

    if ($result) {
        echo "✓ Update successful!\n\n";

        // Verify the update
        $stmt = $pdo->prepare("SELECT total_score FROM users WHERE id = ?");
        $stmt->execute([$user['id']]);
        $updated_user = $stmt->fetch(PDO::FETCH_ASSOC);

        echo "Verified total_score in database: " . $updated_user['total_score'] . "\n";

        if ($updated_user['total_score'] == $new_total) {
            echo "✓ Verification successful - score was updated correctly!\n";
        } else {
            echo "✗ Verification failed - score mismatch!\n";
        }
    } else {
        echo "✗ Update failed!\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
