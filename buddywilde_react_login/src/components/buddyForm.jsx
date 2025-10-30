import React, { useState } from 'react';

const BuddyForm = () => {
  // State to track which form view we're showing
  const [currentView, setCurrentView] = useState('register'); // 'register' or 'login'
  
  // State for form data
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  // State for login view data
  const [loginData, setLoginData] = useState({
    usernameOrEmail: '',
    password: ''
  });
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle input changes for registration
  const handleRegisterInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle input changes for login
  const handleLoginInputChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle registration form submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Here you would add your registration logic
      console.log('Registering:', formData);
      // await registerUser(formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset form after successful registration
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      
    } catch (err) {
      setError('Registration failed. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login form submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Here you would add your login logic
      console.log('Logging in:', loginData);
      // await loginUser(loginData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      setError('Login failed. Please check your credentials.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to login view
  const switchToLogin = () => {
    setCurrentView('login');
  };

  // Switch back to registration view
  const switchToRegister = () => {
    setCurrentView('register');
  };

  return (
    <div className="buddy-form">
      <h2>{currentView === 'register' ? 'Create Account' : 'Welcome Back'}</h2>
      
      {currentView === 'register' ? (
        <form onSubmit={handleRegisterSubmit}>
          <div className="form-group">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleRegisterInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleRegisterInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleRegisterInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleRegisterInputChange}
              required
            />
          </div>
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <input
              type="text"
              name="usernameOrEmail"
              placeholder="Username or Email"
              value={loginData.usernameOrEmail}
              onChange={handleLoginInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={loginData.password}
              onChange={handleLoginInputChange}
              required
            />
          </div>
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          
          <div className="login-options">
            <button 
              type="button" 
              onClick={switchToRegister}
              className="secondary-button"
            >
              Back to Register
            </button>
            
            <button 
              type="button" 
              className="secondary-button"
            >
              Forgot Password
            </button>
          </div>
        </form>
      )}
      
      {currentView === 'register' && (
        <div className="login-link">
          <p>Already Registered? 
            <button 
              type="button" 
              onClick={switchToLogin}
              className="link-button"
            >
              Log In
            </button>
          </p>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default BuddyForm;
