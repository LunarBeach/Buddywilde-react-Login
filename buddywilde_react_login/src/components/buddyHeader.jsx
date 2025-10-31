import React, { useState, useEffect, useRef } from 'react';
import { userService } from '../services/userService'; // Add this import

const BuddyHeader = ({ isLoggedIn, user, onLogout, isFrontPage = false }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState({});
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [currentUser, setCurrentUser] = useState(user); // Local state for current user data
  const menuRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // Click sound audio element
  const clickSoundRef = useRef(null);

  // Update local user state when prop changes
  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // Fetch fresh user data when component mounts and user is logged in
  useEffect(() => {
    const fetchUserData = async () => {
      if (isLoggedIn && user && user.email) {
        try {
          const userData = await userService.getUserData({ email: user.email });
          if (userData && userData.user) {
            setCurrentUser(userData.user);
            // Also update localStorage with fresh data
            localStorage.setItem('currentUser', JSON.stringify(userData.user));
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        }
      }
    };

    fetchUserData();
  }, [isLoggedIn, user]);

  // Log props for debugging
  useEffect(() => {
    console.log('Header props - isLoggedIn:', isLoggedIn, 'user:', user);
    console.log('Current user state:', currentUser);
  }, [isLoggedIn, user, currentUser]);

  // Initialize audio
  useEffect(() => {
    clickSoundRef.current = new Audio('https://buddywilde.com/wp-content/uploads/2025/10/gronk_bonk_paddle_strike.wav');
    
    // Handle window resize
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle clicks outside menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
        setOpenSubmenus({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Menu items based on login status
  const getMenuItems = () => {
    console.log('Getting menu items - isLoggedIn:', isLoggedIn);
    
    if (isLoggedIn) {
      console.log('Returning logged-in menu items');
      return [
        { label: 'EDIT PROFILE', url: '/profile' },
        { label: 'COUNSELOR CURTIS', url: '/counselor-curtis' },
        { 
          label: 'GAMES', 
          url: '#', 
          submenu: [
            { label: 'GRONK BONK', url: '/star-bonk' },
            { label: 'TRUMPS', url: '/trumps' }
          ]
        },
        { label: 'PRESS', url: '/press-kit' },
        { label: 'CAST', url: '/cast' },
        { label: 'CONTACT', url: '/contact' },
        { label: 'Log out', url: '#', action: 'logout' }
      ];
    } else {
      console.log('Returning guest menu items');
      return [
        { label: 'Press Kit', url: '/press-kit' },
        { label: 'Cast', url: '/cast' },
        { label: 'Contact', url: '/contact' }
      ];
    }
  };

  // Resolve avatar URL
  const resolveAvatarUrl = (avatarVal) => {
    if (typeof avatarVal === 'string' && /^https?:\/\//i.test(avatarVal)) {
      return avatarVal;
    }
    if (!avatarVal || avatarVal === 'buddy') {
      return 'https://buddywilde.com/wp-content/plugins/buddywilde-header/assets/buddy-default.png';
    }
    // Assuming WordPress uploads structure
    if (avatarVal && avatarVal.includes('/')) {
      return `https://buddywilde.com/wp-content/uploads/${avatarVal}`;
    } else if (avatarVal) {
      return `https://buddywilde.com/wp-content/uploads/avatars/${avatarVal}`;
    }
    return 'https://buddywilde.com/wp-content/plugins/buddywilde-header/assets/buddy-default.png';
  };

  // Play click sound
  const playClickSound = () => {
    try {
      if (clickSoundRef.current) {
        clickSoundRef.current.currentTime = 0;
        clickSoundRef.current.play().catch(e => console.log('Audio play error:', e));
      }
    } catch (e) {
      console.log('Audio play error:', e);
    }
  };

  // Handle menu item click
  const handleMenuItemClick = (item) => {
    playClickSound();
    
    if (item.action === 'logout' && onLogout) {
      onLogout();
    }
    
    if (item.submenu) {
      setOpenSubmenus(prev => ({
        ...prev,
        [item.label]: !prev[item.label]
      }));
    }
  };

  // Handle hamburger click
  const handleHamburgerClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Handle hamburger hover (desktop only)
  const handleHamburgerHover = () => {
    if (isDesktop) {
      setIsMenuOpen(true);
    }
  };

  // Handle menu leave (desktop only)
  const handleMenuLeave = () => {
    if (isDesktop) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsMenuOpen(false);
        setOpenSubmenus({});
      }, 300);
    }
  };

  // Handle menu enter (cancel close timeout)
  const handleMenuEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
  };

  // Get greeting name
  const greetingName = isLoggedIn && currentUser ? (currentUser.display_name || 'there') : '';
  const avatarUrl = isLoggedIn && currentUser ? resolveAvatarUrl(currentUser.avatar) : '';
  const points = isLoggedIn && currentUser ? (currentUser.total_score || 0) : 0;

  const menuItems = getMenuItems();

  return (
    <>
      {/* Front page "Coming 2026" overlay */}
      {isFrontPage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '10vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100000,
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img 
                src="https://buddywilde.com/wp-content/uploads/2025/10/buddy_wilde_swan_icon.png" 
                alt="Swan" 
                style={{ 
                  height: '6vh',
                  width: 'auto',
                  pointerEvents: 'none',
                  transform: 'scaleX(-1)'
                }}
              />
              <span style={{
                color: '#fff',
                fontFamily: '"Nodo", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: 'clamp(16px, 3vw, 32px)',
                margin: '0 15px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap'
              }}>Coming 2026</span>
              <img 
                src="https://buddywilde.com/wp-content/uploads/2025/10/buddy_wilde_swan_icon.png" 
                alt="Swan" 
                style={{ 
                  height: '6vh',
                  width: 'auto',
                  pointerEvents: 'none'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main header */}
      <div 
        id="bwh-header-wrapper" 
        ref={menuRef}
        style={{
          height: '10vh',
          width: '100vw',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 99999,
          backgroundColor: '#000'
        }}
      >
        <header 
          className="bwh-header" 
          role="banner"
          style={{
            height: '100%',
            width: '100%',
            backgroundColor: '#000',
            margin: 0,
            padding: 0,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            padding: 0,
            boxSizing: 'border-box'
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: '1.5rem'
            }}>
              {isLoggedIn && !isFrontPage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%'
                }}>
                  {avatarUrl && (
                    <img 
                      className="bwh-avatar" 
                      src={avatarUrl} 
                      alt="Avatar" 
                      style={{
                        height: '8vh',
                        width: 'auto',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginRight: '1rem'
                      }}
                      onError={(e) => {
                        // Fallback to default avatar on error
                        e.target.src = 'https://buddywilde.com/wp-content/plugins/buddywilde-header/assets/buddy-default.png';
                      }}
                    />
                  )}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '90%',
                    lineHeight: 1.2
                  }}>
                    <span style={{
                      color: 'white',
                      fontFamily: 'Nodo, Arial, sans-serif',
                      margin: '0 0.5rem 0 0',
                      padding: 0,
                      whiteSpace: 'nowrap',
                      fontSize: 'clamp(0.9rem, 2vw, 1.2rem)'
                    }}>Welcome, {greetingName}!</span>
                    <span style={{
                      color: 'white',
                      fontFamily: 'Nodo, Arial, sans-serif',
                      margin: 0,
                      padding: 0,
                      whiteSpace: 'nowrap',
                      fontSize: 'clamp(0.8rem, 1.8vw, 1rem)'
                    }}>You have {points} Points!</span>
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ flex: 2 }}></div>
            
            <div style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingRight: '1.5rem'
            }}>
              <div 
                className="bwh-hamburger"
                onClick={handleHamburgerClick}
                onMouseEnter={handleHamburgerHover}
                style={{
                  height: '8vh',
                  width: 'auto',
                  cursor: 'pointer'
                }}
              >
                <video autoPlay loop muted playsInline style={{
                  height: '100%',
                  width: 'auto'
                }}>
                  <source 
                    src="https://buddywilde.com/wp-content/uploads/2025/10/Buddy_Wilde_Hamburger_video.mp4" 
                    type="video/mp4"
                  />
                  <img 
                    src="https://buddywilde.com/wp-content/uploads/2025/10/buddy_wilde_hamburger_menu_icon.png" 
                    alt="Menu" 
                    style={{
                      height: '100%',
                      width: 'auto'
                    }}
                  />
                </video>
              </div>
            </div>
          </div>
          
          {/* Main menu */}
          <div 
            className={`bwh-menu ${isMenuOpen ? 'open' : ''}`}
            onMouseLeave={handleMenuLeave}
            onMouseEnter={handleMenuEnter}
            style={{
              display: isMenuOpen ? 'block' : 'none',
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              backgroundColor: 'black',
              zIndex: 99998,
              opacity: isMenuOpen ? 0.5 : 0,
              transition: 'opacity 0.3s ease'
            }}
          >
            <ul style={{
              listStyle: 'none',
              margin: 0,
              padding: 0
            }}>
              {menuItems.map((item, index) => (
                <li 
                  key={index} 
                  className={item.submenu ? 'bwh-has-submenu' : ''}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,1)',
                    margin: 0,
                    position: 'relative'
                  }}
                >
                  <a 
                    href={item.url === '#' ? '#' : item.url}
                    className="bwh-menu-item"
                    style={{
                      display: 'block',
                      padding: '1rem 1.5rem',
                      color: 'white',
                      textDecoration: 'none',
                      fontFamily: 'Nodo, Arial, sans-serif',
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      position: 'relative'
                    }}
                    onClick={(e) => {
                      if (item.url === '#' || item.action) {
                        e.preventDefault();
                      }
                      handleMenuItemClick(item);
                    }}
                  >
                    {item.label}
                  </a>
                  
                  {item.submenu && (
                    <ul className={`sub-menu ${openSubmenus[item.label] ? 'open' : ''}`} style={{
                      display: openSubmenus[item.label] ? 'block' : 'none',
                      backgroundColor: 'transparent',
                      listStyle: 'none',
                      margin: 0,
                      padding: 0
                    }}>
                      {item.submenu.map((subItem, subIndex) => (
                        <li key={subIndex} style={{
                          borderBottom: '1px solid rgba(255,255,255,1)'
                        }}>
                          <a 
                            href={subItem.url} 
                            className="bwh-menu-item"
                            style={{
                              display: 'block',
                              padding: '1rem 1.5rem',
                              color: 'white',
                              textDecoration: 'none',
                              fontFamily: 'Nodo, Arial, sans-serif',
                              backgroundColor: 'rgba(0, 0, 0, 0.5)',
                              position: 'relative',
                              fontSize: '0.9rem'
                            }}
                            onClick={playClickSound}
                          >
                            {subItem.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </header>
      </div>
    </>
  );
};

export default BuddyHeader;
