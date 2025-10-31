import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import BuddyForm from './components/buddyForm/buddyForm'
import './App.css'
import BuddyHeader from './components/buddyHeader/buddyHeader'
import ContactForm from './components/buddyContact/buddyContact'
import BuddyWiki from './components/buddyWiki/buddyWiki'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = () => {
      const storedIsLoggedIn = localStorage.getItem('isLoggedIn')
      const storedUser = localStorage.getItem('currentUser')
      
      if (storedIsLoggedIn === 'true' && storedUser) {
        try {
          const user = JSON.parse(storedUser)
          setIsLoggedIn(true)
          setCurrentUser(user)
        } catch (error) {
          console.error('Error parsing stored user data:', error)
          // Clear invalid data
          localStorage.removeItem('isLoggedIn')
          localStorage.removeItem('currentUser')
        }
      }
    }

    checkAuthStatus()
  }, [])

  // Handle login success
  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true)
    setCurrentUser(userData)
    console.log('Login successful:', userData)
  }

  // Handle registration success
  const handleRegistrationSuccess = (userData) => {
    setIsLoggedIn(true)
    setCurrentUser(userData)
    console.log('Registration successful:', userData)
  }

  // Handle logout
  const handleLogout = () => {
    // Clear authentication state
    setIsLoggedIn(false)
    setCurrentUser(null)
    // Clear localStorage
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('currentUser')
    console.log('User logged out')
  }

  // Check if we're on the front page
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
        <Routes>
          <Route path="/" element={
            <>
              {!isLoggedIn && <BuddyForm onLoginSuccess={handleLoginSuccess} onRegistrationSuccess={handleRegistrationSuccess} />}
            </>
          } />
          <Route path="/contact" element={
            <>
              {!isLoggedIn && <BuddyForm onLoginSuccess={handleLoginSuccess} onRegistrationSuccess={handleRegistrationSuccess} />}
              <ContactForm />
            </>
          } />
          <Route path="/wiki" element={
            <>
              {!isLoggedIn && <BuddyForm onLoginSuccess={handleLoginSuccess} onRegistrationSuccess={handleRegistrationSuccess} />}
              <BuddyWiki />
            </>
          } />
        </Routes>
      </div>
    </div>
  )
}

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  )
}

export default AppWrapper
