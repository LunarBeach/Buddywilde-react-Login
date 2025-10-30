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
      throw new Error('Failed to check user existence')
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
      throw new Error('Failed to register user')
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
      throw new Error('Failed to login user')
    }
  }
}
