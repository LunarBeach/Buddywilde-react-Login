<?php
/**
 * Database Column Diagnostic Script
 * Upload this to your server and visit it in a browser to check database structure
 */

// Load database credentials
require_once __DIR__ . '/.env';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME,
        DB_USER,
        DB_PASSWORD,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Check if users table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    $table_exists = $stmt->fetch();

    if (!$table_exists) {
        echo json_encode([
            'success' => false,
            'error' => 'Users table does not exist'
        ]);
        exit;
    }

    // Get all columns from users table
    $stmt = $pdo->query("DESCRIBE users");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Check for specific columns we need
    $required_columns = ['id', 'email', 'display_name', 'avatar', 'total_score', 'user_bio', 'available_avatars'];
    $found_columns = array_column($columns, 'Field');
    $missing_columns = array_diff($required_columns, $found_columns);

    // Test a simple SELECT query
    $test_query = "SELECT id, email, display_name, avatar, total_score";

    // Add optional columns if they exist
    if (in_array('user_bio', $found_columns)) {
        $test_query .= ", user_bio";
    }
    if (in_array('available_avatars', $found_columns)) {
        $test_query .= ", available_avatars";
    }

    $test_query .= " FROM users LIMIT 1";

    try {
        $stmt = $pdo->query($test_query);
        $test_row = $stmt->fetch(PDO::FETCH_ASSOC);
        $query_works = true;
    } catch (Exception $e) {
        $query_works = false;
        $query_error = $e->getMessage();
    }

    echo json_encode([
        'success' => true,
        'database_connected' => true,
        'users_table_exists' => true,
        'all_columns' => $columns,
        'found_columns' => $found_columns,
        'missing_columns' => $missing_columns,
        'has_user_bio' => in_array('user_bio', $found_columns),
        'has_available_avatars' => in_array('available_avatars', $found_columns),
        'test_query_works' => $query_works,
        'test_query_error' => $query_error ?? null,
        'sample_data' => $test_row ?? null
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>
