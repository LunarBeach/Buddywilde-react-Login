const API_BASE_URL = 'https://buddywilde.com/wp-content/themes/buddy_wilde_theme'

class ApiClient {
  async testConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/test-connection.php`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('Test connection result:', result)
      return result
    } catch (error) {
      console.error('Test connection failed:', error)
      throw error
    }
  }
  
  async post(endpoint, data = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    
    console.log('Making request to:', url)
    console.log('Request data:', data)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', [...response.headers.entries()])
      
      // Check if response is empty
      const responseText = await response.text()
      console.log('Raw response:', responseText)
      
      if (!responseText.trim()) {
        throw new Error('Empty response from server')
      }
      
      // Try to parse JSON
      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText}`)
      }
      
      console.log('Parsed response:', result)
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`)
      }
      
      return result
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }
}

export const api = new ApiClient()
