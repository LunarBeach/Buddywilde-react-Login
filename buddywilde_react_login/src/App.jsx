// App.jsx
import { useState, useEffect } from 'react'
import BuddyForm from './components/buddyForm'
import BuddyHeader from './components/buddyHeader'
import { userService } from './services/userService'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true) // Prevent flash

  // Auto-login on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('buddy_user')
      const token = localStorage.getItem('buddy_auth_token')

      if (savedUser && token) {
        try {
          const user = JSON.parse(savedUser)
          setCurrentUser(user)
          setIsLoggedIn(true)
        } catch {
          // Invalid JSON
        }
      } else {
        // Try to fetch from backend
        const user = await userService.getCurrentUser()
        if (user) {
          setCurrentUser(user)
          setIsLoggedIn(true)
          localStorage.setItem('buddy_user', JSON.stringify(user))
        }
      }
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true)
    setCurrentUser(userData)
    localStorage.setItem('buddy_user', JSON.stringify(userData))
    // Optional: save token if your backend uses it
    // localStorage.setItem('buddy_auth_token', userData.token)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentUser(null)
    localStorage.removeItem('buddy_user')
    localStorage.removeItem('buddy_auth_token')
  }

  const isFrontPage = window.location.pathname === '/'

  if (isLoading) {
    return <div>Loading...</div> // Or skeleton
  }

  return (
    <div className="app-container">
      <BuddyHeader 
        isLoggedIn={isLoggedIn}
        user={currentUser}
        onLogout={handleLogout}
        isFrontPage={isFrontPage}
      />
      <div style={{ marginTop: '10vh' }}>
        <BuddyForm onLoginSuccess={handleLoginSuccess} />
      </div>
    </div>
  )
}

export default App