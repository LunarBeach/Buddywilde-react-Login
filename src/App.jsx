import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import BuddyForm from './components/buddyForm/buddyForm'
import './App.css'
import BuddyHeader from './components/buddyHeader/buddyHeader'
import ContactForm from './components/buddyContact/buddyContact'
import BuddyWiki from './components/buddyWiki/buddyWiki'
import BuddyEditProfile from './components/buddyEditProfile/buddyEditProfile'
import BuddyVideoBackground from './components/buddyVideoBackground/buddyVideoBackground'
import BuddyStarBonk from './components/buddyStarBonk/buddyStarBonk'
import { api } from './services/api'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const location = useLocation()

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

  // Handle profile update
  const handleProfileUpdate = (updatedUser) => {
    setCurrentUser(updatedUser)
    localStorage.setItem('currentUser', JSON.stringify(updatedUser))
    console.log('Profile updated:', updatedUser)
  }

  // Refresh user data from database
  const refreshUserData = async () => {
    if (!currentUser?.email) return;

    try {
      console.log('Refreshing user data from database...');
      const data = await api.get(`/user/profile?email=${encodeURIComponent(currentUser.email)}`);
      console.log('User data refresh response:', data);

      if (data.success && data.user) {
        // Normalize avatar URL
        const normalizedUser = {
          ...data.user,
          avatar_url: data.user.avatar ? `/assets/avatars/${data.user.avatar}` : null
        };
        setCurrentUser(normalizedUser);
        localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
        console.log('User data refreshed successfully:', normalizedUser);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }

  // Check if we're on the front page
  const isFrontPage = location.pathname === '/'
  const isGamePage = location.pathname === '/star-bonk'

  // Debug logging
  useEffect(() => {
    console.log('=== APP.JSX DEBUG ===');
    console.log('Current pathname:', JSON.stringify(location.pathname));
    console.log('Pathname length:', location.pathname.length);
    console.log('isFrontPage:', isFrontPage);
    console.log('isGamePage:', isGamePage);
    console.log('Pathname === "/star-bonk":', location.pathname === '/star-bonk');
    console.log('Should render BuddyVideoBackground:', isFrontPage);
    console.log('Should render BuddyHeader:', !isGamePage);
  }, [location.pathname, isFrontPage, isGamePage]);

  // Refresh user data when returning from game page
  useEffect(() => {
    // If we just left the game page (pathname changed from /star-bonk to something else)
    if (!isGamePage && location.pathname !== '/star-bonk') {
      // Small delay to ensure any pending API calls complete
      const timer = setTimeout(() => {
        refreshUserData();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, isGamePage]);

  // If on game page, render ONLY the game, nothing else
  if (isGamePage) {
    console.log('!!! GAME PAGE DETECTED - RENDERING ONLY GAME !!!');
    console.log('!!! NO VIDEO BACKGROUND, NO HEADER !!!');
    return (
      <div className="app-container">
        <BuddyStarBonk
          user={currentUser}
          isLoggedIn={isLoggedIn}
          onScoreSubmitted={refreshUserData}
        />
      </div>
    );
  }

  console.log('!!! NORMAL PAGE BRANCH - NOT GAME PAGE !!!');

  // Otherwise render normal pages with header and optional video background
  return (
    <div className="app-container">
      {/* Show video background only on front page */}
      {isFrontPage && <BuddyVideoBackground />}

      {/* Show header for all pages except game pages */}
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
          <Route path="/contact" element={<ContactForm />} />
          <Route path="/wiki" element={
            <>
              {!isLoggedIn && <BuddyForm onLoginSuccess={handleLoginSuccess} onRegistrationSuccess={handleRegistrationSuccess} />}
              <BuddyWiki />
            </>
          } />
          <Route path="/profile" element={
            <>
              {!isLoggedIn ? (
                <BuddyForm onLoginSuccess={handleLoginSuccess} onRegistrationSuccess={handleRegistrationSuccess} />
              ) : (
                <BuddyEditProfile user={currentUser} onProfileUpdate={handleProfileUpdate} />
              )}
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
