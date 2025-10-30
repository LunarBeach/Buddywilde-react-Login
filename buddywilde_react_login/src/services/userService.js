import { api } from './api'

export const userService = {
  async checkUserExists(userData) {
    try {
      const result = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'check_user_exists'
      })
      return result
    } catch (error) {
      console.error('Failed to check user existence:', error)
      return { email_exists: false, display_name_exists: false }
    }
  },

  async registerUser(userData) {
    try {
      const result = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'register_user'
      })
      return result
    } catch (error) {
      console.error('Failed to register user:', error)
      throw error
    }
  },

  async loginUser(userData) {
    try {
      const result = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'login_user'
      })
      return result
    } catch (error) {
      console.error('Failed to login user:', error)
      throw error
    }
  },

  async verifyEmail(userData) {
    try {
      const result = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'verify_email'
      })
      return result
    } catch (error) {
      console.error('Failed to verify email:', error)
      throw error
    }
  },

  async resendVerification(userData) {
    try {
      const result = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'resend_verification'
      })
      return result
    } catch (error) {
      console.error('Failed to resend verification:', error)
      throw error
    }
  },

  async forgotPassword(userData) {
    try {
      const result = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'forgot_password'
      })
      return result
    } catch (error) {
      console.error('Failed to process forgot password:', error)
      throw error
    }
  },

  async resetPassword(userData) {
    try {
      const result = await api.post('/bw-db-credentials.php', {
        ...userData,
        action: 'reset_password'
      })
      return result
    } catch (error) {
      console.error('Failed to reset password:', error)
      throw error
    }
  }
}
