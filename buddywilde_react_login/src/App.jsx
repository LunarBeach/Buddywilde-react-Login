import { useState } from 'react'
import BuddyForm from './components/buddyForm'
import './App.css'
import BuddyHeader from './components/buddyHeader'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  // Handle logout
  const handleLogout = () => {
    // Clear authentication state
    setIsLoggedIn(false)
    setCurrentUser(null)
    // For local development, just reset the form
    console.log('User logged out')
  }

  // Check if we're on the front page (for local dev)
  const isFrontPage = window.location.pathname === '/' || window.location.pathname === '/'

  return (
    <div className="app-container">
      <BuddyHeader 
        isLoggedIn={isLoggedIn}
        user={currentUser}
        onLogout={handleLogout}
        isFrontPage={isFrontPage}
      />
      <div style={{ marginTop: '10vh' }}>
        <BuddyForm 
          onLoginSuccess={(userData) => {
            setIsLoggedIn(true)
            setCurrentUser(userData)
            console.log('Login successful:', userData)
          }}
          onRegistrationSuccess={(userData) => {
            setIsLoggedIn(true)
            setCurrentUser(userData)
            console.log('Registration successful:', userData)
          }}
        />
      </div>
    </div>
  )
}

export default App
