// services/userService.jsx
import { api } from './api'

// Types (optional but recommended)
export const User = {
  display_name: '',
  avatar: '',
  total_score: 0,
  // Add other fields as needed
}

const TOKEN_KEY = 'buddy_auth_token'
const USER_KEY = 'buddy_user'
const TOKEN_EXPIRY_KEY = 'buddy_token_expiry'

export const userService = {
  // === EXISTING METHODS (Enhanced) ===
  async checkUserExists(userData) {
    try {
      const { data } = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'check_user_exists'
      })
      return data
    } catch (error) {
      console.error('checkUserExists error:', error)
      return { email_exists: false, display_name_exists: false }
    }
  },

  async registerUser(userData) {
    const { data } = await api.post('/bw-db-credentials.php', {
      ...userData,
      action: 'register_user'
    })

    if (!data.success) {
      throw new Error(data.error || 'Registration failed')
    }
    return data
  },

  async loginUser(userData) {
    const { data } = await api.post('/bw-db-credentials.php', {
      ...userData,
      action: 'login_user'
    })

    if (!data.success) {
      return {
        success: false,
        error: data.error,
        email_not_verified: data.email_not_verified || false
      }
    }

    // Critical: Save token and user for persistence
    this.setAuthData(data.token, data.user)
    return { success: true, user: data.user }
  },

  async verifyEmail(userData) {
    const { data } = await api.post('/bw-db-credentials.php', {
      ...userData,
      action: 'verify_email'
    })

    if (data.success && data.token) {
      this.setAuthData(data.token, data.user)
    }
    return data
  },

  async resendVerification(userData) {
    const { data } = await api.post('/bw-db-credentials.php', {
      ...userData,
      action: 'resend_verification'
    })
    return data
  },

  async forgotPassword(userData) {
    const { data } = await api.post('/bw-db-credentials.php', {
      ...userData,
      action: 'forgot_password'
    })
    return data
  },

  async resetPassword(userData) {
    const { data } = await api.post('/bw-db-credentials.php', {
      ...userData,
      action: 'reset_password'
    })
    return data
  },

  // === NEW PRODUCTION METHODS ===
  async getCurrentUser() {
    // Return cached user if valid
    const cachedUser = localStorage.getItem(USER_KEY)
    if (cachedUser) {
      try {
        const user = JSON.parse(cachedUser)
        // Check if token is still valid
        if (this.isTokenValid()) {
          return user
        }
      } catch {
        // Invalid cache
      }
    }

    // Fetch fresh from server
    try {
      const { data } = await api.get('/bw-db-credentials.php?action=get_current_user')
      if (data.success) {
        this.setAuthData(data.token, data.user)
        return data.user
      }
      return null
    } catch (error) {
      if (error.response?.status === 401) {
        this.logout()
      }
      return null
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    // Clear any axios auth headers if your api.js sets them
    api.defaults.headers.common['Authorization'] = null
    console.log('User logged out')
  },

  isAuthenticated() {
    return this.isTokenValid()
  },

  // === INTERNAL HELPERS ===
  setAuthData(token, user) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    
    // Set expiry (30 days from now)
    const expiry = Date.now() + (30 * 24 * 60 * 60 * 1000)
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString())
    
    // Auto-refresh 1 hour before expiry
    setTimeout(() => {
      this.refreshToken()
    }, (expiry - Date.now()) - (60 * 60 * 1000))
  },

  isTokenValid() {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    return expiry && Date.now() < parseInt(expiry)
  },

  async refreshToken() {
    try {
      const { data } = await api.post('/bw-db-credentials.php', {
        action: 'refresh_token'
      })
      if (data.success) {
        this.setAuthData(data.token, data.user)
      } else {
        this.logout()
      }
    } catch {
      this.logout()
    }
  }
}

// Auto-refresh on app load if token near expiry
if (userService.isAuthenticated()) {
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0')
  const timeLeft = expiry - Date.now()
  if (timeLeft < (2 * 60 * 60 * 1000)) { // Less than 2 hours
    setTimeout(() => userService.refreshToken(), 1000)
  }
}

export default userService