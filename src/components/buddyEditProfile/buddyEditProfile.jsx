import React, { useState, useEffect, useRef } from 'react';
import { userService } from '../../services/userService';
import './buddyEditProfile.css';

const BuddyEditProfile = ({ user, onProfileUpdate }) => {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [availableAvatars, setAvailableAvatars] = useState([]);
  const [ownedAvatars, setOwnedAvatars] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [scrollPosition, setScrollPosition] = useState(0);
  const avatarsRowRef = useRef(null);

  const MAX_BIO_LENGTH = 500;
  const AVATAR_ITEM_WIDTH = 166; // 150px + 16px gap

  // Load user data and avatars on component mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!user || !user.email) {
        setErrorMessage('No user data available');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Fetch current user data
        const userData = await userService.getUserData({ email: user.email });

        if (userData && userData.user) {
          setUsername(userData.user.display_name || '');
          setBio(userData.user.user_bio || '');

          // Normalize avatar format - extract filename from URL if needed
          let avatarValue = userData.user.avatar || '';
          if (avatarValue && avatarValue.includes('/')) {
            // Extract just the filename from any URL format
            const parts = avatarValue.split('/');
            avatarValue = parts[parts.length - 1];
          }

          console.log('User avatar from database:', userData.user.avatar, '-> normalized to:', avatarValue);
          setSelectedAvatar(avatarValue);
          setUserPoints(userData.user.total_score || 0);

          // Parse owned avatars
          try {
            const owned = userData.user.available_avatars
              ? JSON.parse(userData.user.available_avatars)
              : [];
            setOwnedAvatars(Array.isArray(owned) ? owned : []);
          } catch (e) {
            setOwnedAvatars([]);
          }
        }

        // Fetch available avatars from WordPress media library
        const avatarsData = await userService.getAvailableAvatars();

        if (avatarsData && avatarsData.avatars) {
          // Debug: log available avatar filenames
          console.log('Available avatar filenames:', avatarsData.avatars.map(a => a.filename));
          setAvailableAvatars(avatarsData.avatars);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading user data:', error);
        setErrorMessage('Failed to load user data. Please try again.');
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user]);

  // Validate username - no URLs
  const validateUsername = (value) => {
    const urlPattern = /(https?:\/\/|www\.|\.[a-z]{2,})/i;
    return !urlPattern.test(value);
  };

  // Validate bio - no URLs
  const validateBio = (value) => {
    const urlPattern = /(https?:\/\/|www\.|\.[a-z]{2,})/i;
    return !urlPattern.test(value);
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    if (validateUsername(value)) {
      setUsername(value);
      setErrorMessage('');
    } else {
      setErrorMessage('Username cannot contain URLs or links');
    }
  };

  const handleBioChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_BIO_LENGTH) {
      if (validateBio(value)) {
        setBio(value);
        setErrorMessage('');
      } else {
        setErrorMessage('Bio cannot contain URLs or links');
      }
    }
  };

  const getRemainingChars = () => {
    return MAX_BIO_LENGTH - bio.length;
  };

  const getCharCounterClass = () => {
    const remaining = getRemainingChars();
    if (remaining <= 0) return 'char-counter limit';
    if (remaining <= 50) return 'char-counter warning';
    return 'char-counter';
  };

  const handleAvatarSelect = (avatar) => {
    // Check if user can afford this avatar
    const isOwned = ownedAvatars.includes(avatar.filename) || avatar.cost === 0;
    const canAfford = userPoints >= avatar.cost || isOwned;

    if (!canAfford) {
      setErrorMessage(`You need ${avatar.cost - userPoints} more points to purchase this avatar.`);
      return;
    }

    setSelectedAvatar(avatar.filename);
    setErrorMessage('');
  };

  const isAvatarOwned = (avatar) => {
    return ownedAvatars.includes(avatar.filename) || avatar.cost === 0;
  };

  const canAffordAvatar = (avatar) => {
    return isAvatarOwned(avatar) || userPoints >= avatar.cost;
  };

  const handleScrollLeft = () => {
    if (avatarsRowRef.current) {
      const newPosition = Math.max(0, scrollPosition - AVATAR_ITEM_WIDTH * 3);
      setScrollPosition(newPosition);
      avatarsRowRef.current.style.transform = `translateX(-${newPosition}px)`;
    }
  };

  const handleScrollRight = () => {
    if (avatarsRowRef.current) {
      const maxScroll = (availableAvatars.length * AVATAR_ITEM_WIDTH) - avatarsRowRef.current.parentElement.offsetWidth;
      const newPosition = Math.min(maxScroll, scrollPosition + AVATAR_ITEM_WIDTH * 3);
      setScrollPosition(newPosition);
      avatarsRowRef.current.style.transform = `translateX(-${newPosition}px)`;
    }
  };

  const canScrollLeft = () => scrollPosition > 0;
  const canScrollRight = () => {
    if (!avatarsRowRef.current) return false;
    const maxScroll = (availableAvatars.length * AVATAR_ITEM_WIDTH) - avatarsRowRef.current.parentElement.offsetWidth;
    return scrollPosition < maxScroll;
  };

  const handleSaveChanges = async () => {
    // Validate inputs
    if (!username.trim()) {
      setErrorMessage('Username cannot be empty');
      return;
    }

    if (!validateUsername(username)) {
      setErrorMessage('Username cannot contain URLs or links');
      return;
    }

    if (!validateBio(bio)) {
      setErrorMessage('Bio cannot contain URLs or links');
      return;
    }

    if (!selectedAvatar) {
      setErrorMessage('Please select an avatar');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      // Find the selected avatar details
      const avatarDetails = availableAvatars.find(a => a.filename === selectedAvatar);

      // Debug logging to help identify the mismatch
      if (!avatarDetails) {
        console.error('Avatar mismatch - selectedAvatar:', selectedAvatar);
        console.error('Available avatar filenames:', availableAvatars.map(a => a.filename));
        setErrorMessage('Selected avatar not found. Please select a valid avatar.');
        setIsSaving(false);
        return;
      }

      const isOwned = isAvatarOwned(avatarDetails);
      const pointsToDeduct = isOwned ? 0 : avatarDetails.cost;

      // Check if user has enough points
      if (pointsToDeduct > userPoints) {
        setErrorMessage('Insufficient points to purchase this avatar');
        setIsSaving(false);
        return;
      }

      // Prepare update data
      const updateData = {
        email: user.email,
        display_name: username,
        user_bio: bio,
        avatar: selectedAvatar,
        points_to_deduct: pointsToDeduct
      };

      // If purchasing a new avatar, add it to owned avatars
      if (pointsToDeduct > 0) {
        const updatedOwnedAvatars = [...ownedAvatars, selectedAvatar];
        updateData.available_avatars = JSON.stringify(updatedOwnedAvatars);
      }

      // Call API to update profile
      const result = await userService.updateUserProfile(updateData);

      if (result.success) {
        setSuccessMessage('Profile updated successfully!');

        // Update local state
        if (pointsToDeduct > 0) {
          setUserPoints(userPoints - pointsToDeduct);
          setOwnedAvatars([...ownedAvatars, selectedAvatar]);
        }

        // Call parent callback to update user data in App
        if (onProfileUpdate && result.user) {
          onProfileUpdate(result.user);
        }

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        setErrorMessage(result.message || 'Failed to update profile');
      }

      setIsSaving(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      setErrorMessage('An error occurred while saving your profile. Please try again.');
      setIsSaving(false);
    }
  };

  const resolveAvatarUrl = (filename) => {
    // Default to buddy-default.png if no filename
    if (!filename) {
      filename = 'buddy-default.png';
    }

    // If already a full URL, return as-is
    if (typeof filename === 'string' && /^https?:\/\//i.test(filename)) {
      return filename;
    }

    // Handle legacy 'buddy' value
    if (filename === 'buddy') {
      filename = 'buddy-default.png';
    }

    // Extract just the filename if it includes a path
    if (filename.includes('/')) {
      const parts = filename.split('/');
      filename = parts[parts.length - 1];
    }

    // Use relative path - Nginx will serve from /var/www/buddywilde.com/public_html/assets/
    return `/assets/avatars/${filename}`;
  };

  if (isLoading) {
    return (
      <div className="edit-profile-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-container">
      <div className="edit-profile-form">
        <h1 className="edit-profile-heading">Edit Profile</h1>

        {errorMessage && <div className="error-message">{errorMessage}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        {/* Username Field */}
        <div className="form-section">
          <div className="form-field">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              className="form-input"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Enter your username"
              maxLength="50"
            />
          </div>
        </div>

        {/* Avatar Selection */}
        <div className="form-section">
          <h2 className="section-heading">Choose your avatar</h2>
          <div className="avatar-selection">
            <div className="avatars-container">
              <button
                className="scroll-button left"
                onClick={handleScrollLeft}
                disabled={!canScrollLeft()}
                aria-label="Scroll left"
              >
                ‹
              </button>

              <div className="avatars-scroll-wrapper">
                <div className="avatars-row" ref={avatarsRowRef}>
                  {availableAvatars.map((avatar, index) => {
                    const isOwned = isAvatarOwned(avatar);
                    const canAfford = canAffordAvatar(avatar);
                    const isSelected = selectedAvatar === avatar.filename;

                    return (
                      <div
                        key={index}
                        className={`avatar-option ${isSelected ? 'selected' : ''} ${!canAfford ? 'insufficient-points' : ''}`}
                        onClick={() => handleAvatarSelect(avatar)}
                      >
                        {!canAfford && <div className="avatar-status">DECLINED</div>}

                        <input
                          type="checkbox"
                          className="avatar-checkbox"
                          checked={isSelected}
                          onChange={() => handleAvatarSelect(avatar)}
                          disabled={!canAfford}
                        />

                        <div className="avatar-image-wrapper">
                          <img
                            src={resolveAvatarUrl(avatar.filename)}
                            alt={avatar.alt || 'Avatar'}
                            className={`avatar-image ${!canAfford ? 'grayscale' : ''}`}
                            onError={(e) => {
                              e.target.src = '/assets/avatars/buddy-default.png';
                            }}
                          />
                        </div>

                        {isOwned ? (
                          <div className="avatar-owned">OWNED</div>
                        ) : (
                          <div className="avatar-cost">{avatar.cost} Points</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                className="scroll-button right"
                onClick={handleScrollRight}
                disabled={!canScrollRight()}
                aria-label="Scroll right"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Bio Field */}
        <div className="form-section">
          <div className="form-field">
            <label className="form-label" htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              className="form-textarea"
              value={bio}
              onChange={handleBioChange}
              placeholder="Tell us about yourself..."
              maxLength={MAX_BIO_LENGTH}
            />
            <div className={getCharCounterClass()}>
              {getRemainingChars()} characters remaining
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          className="save-button"
          onClick={handleSaveChanges}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default BuddyEditProfile;
