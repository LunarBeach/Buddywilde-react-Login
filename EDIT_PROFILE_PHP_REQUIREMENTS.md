# Edit Profile - PHP Backend Requirements

This document outlines the PHP backend changes needed to support the Edit Profile functionality in the BuddyEditProfile component.

## New Database Columns (Already Created)

The following columns should already exist in your users table:
- `available_avatars` (LONGTEXT) - JSON array of avatar filenames the user has purchased/unlocked
- `user_bio` (VARCHAR(500)) - User's biography text

## Required PHP Actions

You need to add the following actions to your `bw-db-credentials.php` file:

---

### 1. `get_available_avatars`

**Purpose**: Fetch all available avatar images from the WordPress media library

**Request Format**:
```json
{
  "action": "get_available_avatars"
}
```

**Logic**:
1. Query WordPress media library for images with "avatar" in the filename (case-insensitive)
2. For each avatar image:
   - Get the filename
   - Parse the alt text to extract the cost (format: "This avatar costs 50 points")
   - Extract the numeric cost from the alt text
   - Include the default avatar with 0 cost
3. Return the list of avatars

**Response Format**:
```json
{
  "success": true,
  "avatars": [
    {
      "filename": "avatar-warrior.png",
      "alt": "This avatar costs 50 points",
      "cost": 50
    },
    {
      "filename": "avatar-mage.png",
      "alt": "This avatar costs 100 points",
      "cost": 100
    },
    {
      "filename": "buddy-default.png",
      "alt": "Default avatar",
      "cost": 0
    }
  ]
}
```

**WordPress Media Library Query Example**:
```php
// Query to get images with 'avatar' in filename
$args = array(
    'post_type' => 'attachment',
    'post_mime_type' => 'image',
    'posts_per_page' => -1,
    'post_status' => 'any',
    's' => 'avatar' // Search for 'avatar' in filename
);

$query = new WP_Query($args);
$avatars = array();

// Add default avatar
$avatars[] = array(
    'filename' => 'buddy-default.png',
    'alt' => 'Default avatar',
    'cost' => 0
);

foreach ($query->posts as $image) {
    $filename = basename(get_attached_file($image->ID));
    $alt_text = get_post_meta($image->ID, '_wp_attachment_image_alt', true);

    // Parse cost from alt text: "This avatar costs 50 points"
    $cost = 0;
    if (preg_match('/(\d+)\s*points?/i', $alt_text, $matches)) {
        $cost = intval($matches[1]);
    }

    $avatars[] = array(
        'filename' => $filename,
        'alt' => $alt_text,
        'cost' => $cost
    );
}

echo json_encode(array(
    'success' => true,
    'avatars' => $avatars
));
```

---

### 2. `update_user_profile`

**Purpose**: Update user's profile information including username, bio, avatar, and handle avatar purchases

**Request Format**:
```json
{
  "action": "update_user_profile",
  "email": "user@example.com",
  "display_name": "NewUsername",
  "user_bio": "This is my bio...",
  "avatar": "avatar-warrior.png",
  "points_to_deduct": 50,
  "available_avatars": "[\"avatar-warrior.png\",\"buddy-default.png\"]"
}
```

**Request Parameters**:
- `email` (required): User's email to identify them
- `display_name` (required): New username
- `user_bio` (required): New bio text (max 500 chars)
- `avatar` (required): Selected avatar filename
- `points_to_deduct` (required): Points to deduct (0 if avatar already owned)
- `available_avatars` (optional): Updated JSON array of owned avatars (only sent if purchasing new avatar)

**Logic**:
1. Validate the user exists by email
2. Validate username doesn't contain URLs (regex check)
3. Validate bio doesn't contain URLs (regex check)
4. Check if `points_to_deduct` > 0:
   - Verify user has enough points
   - Deduct points from `total_score`
   - Update `available_avatars` field with the new JSON array
5. Update the following fields:
   - `display_name`
   - `user_bio`
   - `avatar`
   - `total_score` (if points were deducted)
   - `available_avatars` (if purchasing new avatar)
6. Return updated user data

**Response Format** (Success):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "email": "user@example.com",
    "display_name": "NewUsername",
    "user_bio": "This is my bio...",
    "avatar": "avatar-warrior.png",
    "total_score": 450,
    "available_avatars": "[\"avatar-warrior.png\",\"buddy-default.png\"]"
  }
}
```

**Response Format** (Error):
```json
{
  "success": false,
  "message": "Insufficient points to purchase this avatar"
}
```

**PHP Implementation Example**:
```php
case 'update_user_profile':
    $email = $data['email'];
    $display_name = $data['display_name'];
    $user_bio = $data['user_bio'];
    $avatar = $data['avatar'];
    $points_to_deduct = intval($data['points_to_deduct']);
    $available_avatars = isset($data['available_avatars']) ? $data['available_avatars'] : null;

    // Validate no URLs in username or bio
    $url_pattern = '/(https?:\/\/|www\.|\.[a-z]{2,})/i';
    if (preg_match($url_pattern, $display_name) || preg_match($url_pattern, $user_bio)) {
        echo json_encode(array(
            'success' => false,
            'message' => 'Username and bio cannot contain URLs or links'
        ));
        exit;
    }

    // Get user by email
    $user = get_user_by('email', $email);

    if (!$user) {
        echo json_encode(array(
            'success' => false,
            'message' => 'User not found'
        ));
        exit;
    }

    // Check if user has enough points
    $current_points = get_user_meta($user->ID, 'total_score', true);
    if ($points_to_deduct > $current_points) {
        echo json_encode(array(
            'success' => false,
            'message' => 'Insufficient points to purchase this avatar'
        ));
        exit;
    }

    // Update user data
    wp_update_user(array(
        'ID' => $user->ID,
        'display_name' => $display_name
    ));

    update_user_meta($user->ID, 'user_bio', $user_bio);
    update_user_meta($user->ID, 'avatar', $avatar);

    // Deduct points if purchasing
    if ($points_to_deduct > 0) {
        $new_points = $current_points - $points_to_deduct;
        update_user_meta($user->ID, 'total_score', $new_points);

        // Update available avatars
        if ($available_avatars !== null) {
            update_user_meta($user->ID, 'available_avatars', $available_avatars);
        }
    } else {
        $new_points = $current_points;
    }

    // Return updated user data
    $updated_available_avatars = get_user_meta($user->ID, 'available_avatars', true);

    echo json_encode(array(
        'success' => true,
        'message' => 'Profile updated successfully',
        'user' => array(
            'email' => $user->user_email,
            'display_name' => $user->display_name,
            'user_bio' => get_user_meta($user->ID, 'user_bio', true),
            'avatar' => get_user_meta($user->ID, 'avatar', true),
            'total_score' => $new_points,
            'available_avatars' => $updated_available_avatars
        )
    ));
    break;
```

---

### 3. Update `get_user_data` Action

The existing `get_user_data` action needs to be updated to include the new fields:

**Updated Response Format**:
```json
{
  "success": true,
  "user": {
    "email": "user@example.com",
    "display_name": "Username",
    "avatar": "avatar-warrior.png",
    "total_score": 500,
    "user_bio": "This is my bio...",
    "available_avatars": "[\"avatar-warrior.png\",\"buddy-default.png\"]"
  }
}
```

**Add these fields to the existing response**:
```php
'user_bio' => get_user_meta($user->ID, 'user_bio', true),
'available_avatars' => get_user_meta($user->ID, 'available_avatars', true)
```

---

## Security Considerations

1. **URL Validation**: Always validate that `display_name` and `user_bio` don't contain URLs using regex
2. **Points Validation**: Always verify user has enough points before deducting
3. **SQL Injection**: Use prepared statements or WordPress functions (wp_update_user, update_user_meta)
4. **Input Sanitization**: Sanitize all user inputs before storing in database
5. **Authentication**: Verify user is authenticated before allowing profile updates

---

## Testing Checklist

- [ ] Avatars are correctly fetched from WordPress media library
- [ ] Alt text parsing correctly extracts point costs
- [ ] Default avatar appears with 0 cost
- [ ] Username updates correctly
- [ ] Bio updates correctly
- [ ] Avatar purchase deducts correct points
- [ ] available_avatars JSON is correctly updated
- [ ] URL validation prevents links in username
- [ ] URL validation prevents links in bio
- [ ] Error handling for insufficient points works
- [ ] User can switch back to previously purchased avatars without cost
- [ ] Points display updates in header after profile update

---

## Frontend-Backend Flow

1. User logs in → `get_user_data` returns current profile including `user_bio` and `available_avatars`
2. User navigates to Edit Profile → `get_available_avatars` fetches all available avatars
3. Frontend compares user's `available_avatars` with fetched avatars to show owned status
4. User selects new avatar and clicks Save → `update_user_profile` is called
5. Backend validates, deducts points if needed, updates database
6. Backend returns updated user data
7. Frontend updates local state and localStorage with new user data
8. Header component displays updated username, avatar, and points

---

## Notes

- The `available_avatars` field stores a JSON array of avatar filenames as a string
- Free/default avatars (cost = 0) should never be added to `available_avatars`
- When user purchases an avatar, append its filename to the `available_avatars` array
- Parse the array with `JSON.parse()` in JavaScript and `json_decode()` in PHP
