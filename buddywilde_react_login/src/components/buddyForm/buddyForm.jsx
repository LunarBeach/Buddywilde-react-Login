import React, { useState, useEffect, useRef } from 'react'
import { userService } from '../../services/userService'
import './buddyForm.css'
const BuddyForm = ({ onLoginSuccess, onRegistrationSuccess }) => {
  const [formState, setFormState] = useState('register') // 'register', 'login', 'verify', 'forgot', 'reset'
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    password: '',
    confirm_password: '',
    new_password: '',
    confirm_new_password: ''
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationDebounce, setValidationDebounce] = useState(null)
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
  const [resetCode, setResetCode] = useState(['', '', '', '', '', ''])
  const [showSuccessMessage, setShowSuccessMessage] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  
  // Refs for verification code inputs
  const verificationRefs = useRef([])
  const resetRefs = useRef([])

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

  const validateForgotPasswordForm = () => {
    const newErrors = {}
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }
    
    return newErrors
  }

  const validateResetPasswordForm = () => {
    const newErrors = {}
    
    if (!formData.new_password) {
      newErrors.new_password = 'New password is required'
    } else if (formData.new_password.length < 6) {
      newErrors.new_password = 'Password must be at least 6 characters'
    }
    
    if (formData.new_password !== formData.confirm_new_password) {
      newErrors.confirm_new_password = 'Passwords do not match'
    }
    
    return newErrors
  }

  // Real-time validation for email and username (register only)
  useEffect(() => {
    if (formState !== 'register') return;

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
  }, [formData.email, formData.display_name, errors, formState])

  // Handle verification code input
  const handleVerificationCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newCode = [...verificationCode]
    newCode[index] = value.slice(-1) // Only take the last character
    
    setVerificationCode(newCode)
    
    // Move to next field if a digit was entered
    if (value && index < 5) {
      verificationRefs.current[index + 1]?.focus()
    }
    
    // Clear any existing errors
    if (errors.verification_code) {
      setErrors(prev => ({
        ...prev,
        verification_code: ''
      }))
    }
  }

  // Handle paste in verification code
  const handleVerificationCodePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setVerificationCode(newCode)
      
      // Focus on last input
      verificationRefs.current[5]?.focus()
    }
  }

  // Handle reset code input
  const handleResetCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newCode = [...resetCode]
    newCode[index] = value.slice(-1) // Only take the last character
    
    setResetCode(newCode)
    
    // Move to next field if a digit was entered
    if (value && index < 5) {
      resetRefs.current[index + 1]?.focus()
    }
    
    // Clear any existing errors
    if (errors.reset_code) {
      setErrors(prev => ({
        ...prev,
        reset_code: ''
      }))
    }
  }

  // Handle paste in reset code
  const handleResetCodePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setResetCode(newCode)
      
      // Focus on last input
      resetRefs.current[5]?.focus()
    }
  }

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
        // Set verification email and switch to verification state
        setVerificationEmail(formData.email)
        setFormState('verify')
        setFormData({
          display_name: '',
          email: '',
          password: '',
          confirm_password: '',
          new_password: '',
          confirm_new_password: ''
        })
        setErrors({})
        
        // For testing - show the verification code (remove in production)
        if (registrationResult.verification_code) {
          console.log('Verification code (for testing):', registrationResult.verification_code)
        }
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
    setErrors({})
    
    try {
      const loginResult = await userService.loginUser({
        email: formData.email,
        password: formData.password
      })
      
      if (loginResult.success && loginResult.user) {
        // Store user data in localStorage for persistence
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('currentUser', JSON.stringify(loginResult.user))
        
        // Call the success callback to update parent state
        if (onLoginSuccess) {
          onLoginSuccess(loginResult.user)
        }
        
        // Optional: Show success message instead
        setShowSuccessMessage('Login successful!')
        setTimeout(() => {
          setShowSuccessMessage('')
        }, 3000)
      } else if (loginResult.email_not_verified) {
        // Email not verified - show verification state
        setVerificationEmail(formData.email)
        setFormState('verify')
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

  const handleVerifySubmit = async (e) => {
    e.preventDefault()
    
    const code = verificationCode.join('')
    if (code.length !== 6) {
      setErrors({ verification_code: 'Please enter a 6-digit code' })
      return
    }
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      const verifyResult = await userService.verifyEmail({
        email: verificationEmail,
        verification_code: code
      })
      
      if (verifyResult.success) {
        setShowSuccessMessage('Email verified successfully!')
        setTimeout(() => {
          // REDIRECT COMMENTED OUT
          // window.location.href = 'https://buddywilde.com/profile'
          
          // Stay on current page or switch to login
          setFormState('login')
          setVerificationCode(['', '', '', '', '', ''])
          setShowSuccessMessage('')
        }, 2000)
      } else {
        setErrors({ verification_code: verifyResult.error || 'Verification failed' })
      }
      
    } catch (error) {
      console.error('Verification error:', error)
      setErrors({ verification_code: 'An error occurred during verification: ' + error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    setIsSubmitting(true)
    
    try {
      const resendResult = await userService.resendVerification({
        email: verificationEmail
      })
      
      if (resendResult.success) {
        alert('Verification code resent to your email!')
        // For testing - show the new verification code (remove in production)
        if (resendResult.verification_code) {
          console.log('New verification code (for testing):', resendResult.verification_code)
        }
      } else {
        alert('Failed to resend verification: ' + (resendResult.error || 'Unknown error'))
      }
      
    } catch (error) {
      console.error('Resend verification error:', error)
      alert('An error occurred while resending verification: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    
    const formErrors = validateForgotPasswordForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      const forgotResult = await userService.forgotPassword({
        email: formData.email
      })
      
      if (forgotResult.success) {
        setVerificationEmail(formData.email)
        setFormState('reset')
        setFormData(prev => ({
          ...prev,
          email: '',
          new_password: '',
          confirm_new_password: ''
        }))
        alert('Password reset code sent to your email!')
        // For testing - show the reset code (remove in production)
        if (forgotResult.reset_code) {
          console.log('Reset code (for testing):', forgotResult.reset_code)
        }
      } else {
        setErrors({ general: forgotResult.error || 'Failed to process request' })
      }
      
    } catch (error) {
      console.error('Forgot password error:', error)
      setErrors({ general: 'An error occurred: ' + error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    
    const formErrors = validateResetPasswordForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }
    
    const code = resetCode.join('')
    if (code.length !== 6) {
      setErrors({ reset_code: 'Please enter a 6-digit code' })
      return
    }
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      const resetResult = await userService.resetPassword({
        email: verificationEmail,
        reset_code: code,
        new_password: formData.new_password
      })
      
      if (resetResult.success) {
        setShowSuccessMessage(resetResult.message || 'Password reset successfully!')
        setTimeout(() => {
          setFormState('login')
          setShowSuccessMessage('')
          setResetCode(['', '', '', '', '', ''])
          setFormData(prev => ({
            ...prev,
            new_password: '',
            confirm_new_password: ''
          }))
        }, 3000)
      } else {
        setErrors({ reset_code: resetResult.error || 'Password reset failed' })
      }
      
    } catch (error) {
      console.error('Reset password error:', error)
      setErrors({ reset_code: 'An error occurred: ' + error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchToRegister = () => {
    setFormState('register')
    setErrors({})
    setFormData({
      display_name: '',
      email: '',
      password: '',
      confirm_password: '',
      new_password: '',
      confirm_new_password: ''
    })
  }

  const switchToLogin = () => {
    setFormState('login')
    setErrors({})
    setFormData({
      display_name: '',
      email: '',
      password: '',
      confirm_password: '',
      new_password: '',
      confirm_new_password: ''
    })
  }

  const switchToForgotPassword = () => {
    setFormState('forgot')
    setErrors({})
    setFormData({
      display_name: '',
      email: '',
      password: '',
      confirm_password: '',
      new_password: '',
      confirm_new_password: ''
    })
  }

  const switchToBackToLogin = () => {
    setFormState('login')
    setErrors({})
    setFormData({
      display_name: '',
      email: '',
      password: '',
      confirm_password: '',
      new_password: '',
      confirm_new_password: ''
    })
  }

  // Render different form states
  const renderRegisterForm = () => (
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
        
        <div className="form-footer">
          <span>Already Registered? </span>
          <button type="button" onClick={switchToLogin} className="link-btn">
            Login
          </button>
        </div>
      </form>
    </div>
  )

  const renderLoginForm = () => (
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
        
        <div className="form-footer">
          <button type="button" onClick={switchToForgotPassword} className="link-btn">
            Forgot Password
          </button>
          <button type="button" onClick={switchToRegister} className="link-btn">
            Back to Registration
          </button>
        </div>
      </form>
    </div>
  )

  const renderVerificationForm = () => (
    <div className="form-content">
      <h2>Verify Your Email</h2>
      <p className="verification-instructions">
        A 6-digit verification code has been sent to {verificationEmail}
      </p>
      
      {errors.general && <div className="error-message general">{errors.general}</div>}
      
      <form onSubmit={handleVerifySubmit} className="auth-form">
        <div className="verification-code-container">
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              ref={(el) => verificationRefs.current[index] = el}
              type="text"
              maxLength="1"
              value={digit}
              onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
              onPaste={handleVerificationCodePaste}
              className={`verification-digit ${errors.verification_code ? 'error' : ''}`}
            />
          ))}
        </div>
        
        {errors.verification_code && <span className="error-message">{errors.verification_code}</span>}
        
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Verifying...' : 'Verify Email'}
        </button>
        
        <div className="form-footer">
          <button 
            type="button" 
            onClick={handleResendVerification} 
            disabled={isSubmitting}
            className="link-btn"
          >
            Resend Verification Code
          </button>
        </div>
      </form>
    </div>
  )

  const renderForgotPasswordForm = () => (
    <div className="form-content">
      <h2>Forgot Password</h2>
      <p className="verification-instructions">
        Enter your email address and we'll send you a code to reset your password.
      </p>
      
      {errors.general && <div className="error-message general">{errors.general}</div>}
      
      <form onSubmit={handleForgotPassword} className="auth-form">
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
        
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Sending...' : 'Send Reset Code'}
        </button>
        
        <div className="form-footer">
          <button type="button" onClick={switchToBackToLogin} className="link-btn">
            Back to Login
          </button>
        </div>
      </form>
    </div>
  )

  const renderResetPasswordForm = () => (
    <div className="form-content">
      <h2>Reset Password</h2>
      <p className="verification-instructions">
        Enter the 6-digit code sent to {verificationEmail} and your new password.
      </p>
      
      {errors.general && <div className="error-message general">{errors.general}</div>}
      
      <form onSubmit={handleResetPassword} className="auth-form">
        <div className="verification-code-container">
          {resetCode.map((digit, index) => (
            <input
              key={index}
              ref={(el) => resetRefs.current[index] = el}
              type="text"
              maxLength="1"
              value={digit}
              onChange={(e) => handleResetCodeChange(index, e.target.value)}
              onPaste={handleResetCodePaste}
              className={`verification-digit ${errors.reset_code ? 'error' : ''}`}
            />
          ))}
        </div>
        
        {errors.reset_code && <span className="error-message">{errors.reset_code}</span>}
        
        <div className="form-group">
          <input
            type="password"
            name="new_password"
            placeholder="New Password"
            value={formData.new_password}
            onChange={handleChange}
            className={errors.new_password ? 'error' : ''}
          />
          {errors.new_password && <span className="error-message">{errors.new_password}</span>}
        </div>
        
        <div className="form-group">
          <input
            type="password"
            name="confirm_new_password"
            placeholder="Confirm New Password"
            value={formData.confirm_new_password}
            onChange={handleChange}
            className={errors.confirm_new_password ? 'error' : ''}
          />
          {errors.confirm_new_password && <span className="error-message">{errors.confirm_new_password}</span>}
        </div>
        
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  )

  return (
    <div className="form-container">
      {showSuccessMessage && (
        <div className="success-message">
          {showSuccessMessage}
        </div>
      )}
      
      {formState === 'register' && renderRegisterForm()}
      {formState === 'login' && renderLoginForm()}
      {formState === 'verify' && renderVerificationForm()}
      {formState === 'forgot' && renderForgotPasswordForm()}
      {formState === 'reset' && renderResetPasswordForm()}
    </div>
  )
}

export default BuddyForm
