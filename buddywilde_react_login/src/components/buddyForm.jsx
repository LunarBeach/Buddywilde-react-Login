import React, { useState, useEffect } from 'react'
import { userService } from '../services/userService'

const BuddyForm = () => {
  const [formType, setFormType] = useState('register') // 'register' or 'login'
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    password: '',
    confirm_password: ''
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationDebounce, setValidationDebounce] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateRegisterForm = () => {
    const newErrors = {}
    
    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Display name is required'
    } else if (formData.display_name.length < 3) {
      newErrors.display_name = 'Username must be at least 3 characters'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match'
    }
    
    return newErrors
  }

  const validateLoginForm = () => {
    const newErrors = {}
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    }
    
    return newErrors
  }

  // Real-time validation for email and username (register only)
  useEffect(() => {
    if (formType !== 'register') return;

    // Clear previous debounce
    if (validationDebounce) {
      clearTimeout(validationDebounce)
    }

    const validateFields = async () => {
      try {
        // Validate email
        if (formData.email.trim() && /\S+@\S+\.\S+/.test(formData.email)) {
          const result = await userService.checkUserExists({
            email: formData.email
          })
          
          if (result.email_exists) {
            setErrors(prev => ({
              ...prev,
              email: 'Email already exists'
            }))
          } else if (errors.email === 'Email already exists') {
            setErrors(prev => ({
              ...prev,
              email: ''
            }))
          }
        }

        // Validate display_name
        if (formData.display_name.trim().length >= 3) {
          const result = await userService.checkUserExists({
            display_name: formData.display_name
          })
          
          if (result.display_name_exists) {
            setErrors(prev => ({
              ...prev,
              display_name: 'Username already exists'
            }))
          } else if (errors.display_name === 'Username already exists') {
            setErrors(prev => ({
              ...prev,
              display_name: ''
            }))
          }
        }
      } catch (error) {
        console.error('Validation error:', error)
      }
    }

    // Set new debounce
    const newDebounce = setTimeout(validateFields, 500)
    setValidationDebounce(newDebounce)

    // Cleanup function
    return () => {
      if (validationDebounce) {
        clearTimeout(validationDebounce)
      }
    }
  }, [formData.email, formData.display_name, errors, formType])

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    
    const formErrors = validateRegisterForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Final validation
      const userExists = await userService.checkUserExists({
        email: formData.email,
        display_name: formData.display_name
      })
      
      if (userExists.email_exists) {
        setErrors({ email: 'Email already exists' })
        setIsSubmitting(false)
        return
      }
      
      if (userExists.display_name_exists) {
        setErrors({ display_name: 'Username already exists' })
        setIsSubmitting(false)
        return
      }
      
      // Register user
      const registrationResult = await userService.registerUser({
        display_name: formData.display_name,
        email: formData.email,
        password: formData.password
      })
      
      if (registrationResult.success) {
        alert('Registration successful!')
        // Reset form
        setFormData({
          display_name: '',
          email: '',
          password: '',
          confirm_password: ''
        })
        setErrors({})
      } else {
        alert('Registration failed: ' + (registrationResult.error || 'Unknown error'))
      }
      
    } catch (error) {
      console.error('Registration error:', error)
      alert('An error occurred during registration: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    
    const formErrors = validateLoginForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }
    
    setIsSubmitting(true)
    setErrors({}) // Clear any previous errors
    
    try {
      const loginResult = await userService.loginUser({
        email: formData.email,
        password: formData.password
      })
      
      if (loginResult.success) {
        alert('Login successful!')
        console.log('Logged in user:', loginResult.user)
        // Here you would typically redirect or update app state
      } else {
        setErrors({ general: loginResult.error || 'Login failed' })
      }
      
    } catch (error) {
      console.error('Login error:', error)
      setErrors({ general: 'An error occurred during login: ' + error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchToRegister = () => {
    setFormType('register')
    setErrors({})
    setFormData({
      display_name: '',
      email: '',
      password: '',
      confirm_password: ''
    })
  }

  const switchToLogin = () => {
    setFormType('login')
    setErrors({})
    setFormData({
      display_name: '',
      email: '',
      password: '',
      confirm_password: ''
    })
  }

  return (
    <div className="form-container">
      <div className="auth-toggle">
        <button 
          className={formType === 'register' ? 'active' : ''}
          onClick={switchToRegister}
        >
          Register
        </button>
        <button 
          className={formType === 'login' ? 'active' : ''}
          onClick={switchToLogin}
        >
          Login
        </button>
      </div>
      
      {formType === 'register' ? (
        <div className="form-content">
          <h2>Create Account</h2>
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="form-group">
              <input
                type="text"
                name="display_name"
                placeholder="Username"
                value={formData.display_name}
                onChange={handleChange}
                className={errors.display_name ? 'error' : ''}
              />
              {errors.display_name && <span className="error-message">{errors.display_name}</span>}
            </div>
            
            <div className="form-group">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
            
            <div className="form-group">
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>
            
            <div className="form-group">
              <input
                type="password"
                name="confirm_password"
                placeholder="Confirm Password"
                value={formData.confirm_password}
                onChange={handleChange}
                className={errors.confirm_password ? 'error' : ''}
              />
              {errors.confirm_password && <span className="error-message">{errors.confirm_password}</span>}
            </div>
            
            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Registering...' : 'Register'}
            </button>
          </form>
        </div>
      ) : (
        <div className="form-content">
          <h2>Login</h2>
          <form onSubmit={handleLoginSubmit} className="auth-form">
            {errors.general && <div className="error-message general">{errors.general}</div>}
            
            <div className="form-group">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
            
            <div className="form-group">
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>
            
            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default BuddyForm
