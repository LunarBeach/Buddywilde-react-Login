import React, { useState, useEffect, useRef } from 'react'
import { userService } from '../services/userService'

const BuddyForm = ({ onLoginSuccess }) => {
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
  const [tempPassword, setTempPassword] = useState('') // For auto-login after verify

  // Refs for code inputs
  const verificationRefs = useRef([])
  const resetRefs = useRef([])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // === VALIDATION FUNCTIONS ===
  const validateRegisterForm = () => {
    const newErrors = {}
    if (!formData.display_name.trim()) newErrors.display_name = 'Display name is required'
    else if (formData.display_name.length < 3) newErrors.display_name = 'Username must be at least 3 characters'
    
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    
    if (formData.password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match'
    
    return newErrors
  }

  const validateLoginForm = () => {
    const newErrors = {}
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    if (!formData.password) newErrors.password = 'Password is required'
    return newErrors
  }

  const validateForgotPasswordForm = () => {
    const newErrors = {}
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    return newErrors
  }

  const validateResetPasswordForm = () => {
    const newErrors = {}
    if (!formData.new_password) newErrors.new_password = 'New password is required'
    else if (formData.new_password.length < 6) newErrors.new_password = 'Password must be at least 6 characters'
    if (formData.new_password !== formData.confirm_new_password) newErrors.confirm_new_password = 'Passwords do not match'
    return newErrors
  }

  // === REAL-TIME VALIDATION (REGISTER ONLY) ===
  useEffect(() => {
    if (formState !== 'register') return
    if (validationDebounce) clearTimeout(validationDebounce)

    const validateFields = async () => {
      try {
        if (formData.email.trim() && /\S+@\S+\.\S+/.test(formData.email)) {
          const result = await userService.checkUserExists({ email: formData.email })
          setErrors(prev => ({
            ...prev,
            email: result.email_exists ? 'Email already exists' : (prev.email === 'Email already exists' ? '' : prev.email)
          }))
        }

        if (formData.display_name.trim().length >= 3) {
          const result = await userService.checkUserExists({ display_name: formData.display_name })
          setErrors(prev => ({
            ...prev,
            display_name: result.display_name_exists ? 'Username already exists' : (prev.display_name === 'Username already exists' ? '' : prev.display_name)
          }))
        }
      } catch (error) {
        console.error('Validation error:', error)
      }
    }

    const debounce = setTimeout(validateFields, 500)
    setValidationDebounce(debounce)

    return () => clearTimeout(debounce)
  }, [formData.email, formData.display_name, formState])

  // === CODE INPUT HANDLERS ===
  const handleVerificationCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...verificationCode]
    newCode[index] = value.slice(-1)
    setVerificationCode(newCode)
    if (value && index < 5) verificationRefs.current[index + 1]?.focus()
    if (errors.verification_code) setErrors(prev => ({ ...prev, verification_code: '' }))
  }

  const handleVerificationCodePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setVerificationCode(pasted.split(''))
      verificationRefs.current[5]?.focus()
    }
  }

  const handleResetCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...resetCode]
    newCode[index] = value.slice(-1)
    setResetCode(newCode)
    if (value && index < 5) resetRefs.current[index + 1]?.focus()
    if (errors.reset_code) setErrors(prev => ({ ...prev, reset_code: '' }))
  }

  const handleResetCodePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setResetCode(pasted.split(''))
      resetRefs.current[5]?.focus()
    }
  }

  // === FORM SUBMISSIONS ===
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validateRegisterForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const userExists = await userService.checkUserExists({
        email: formData.email,
        display_name: formData.display_name
      })

      if (userExists.email_exists || userExists.display_name_exists) {
        setErrors({
          email: userExists.email_exists ? 'Email already exists' : '',
          display_name: userExists.display_name_exists ? 'Username already exists' : ''
        })
        setIsSubmitting(false)
        return
      }

      const result = await userService.registerUser({
        display_name: formData.display_name,
        email: formData.email,
        password: formData.password
      })

      if (result.success) {
        setVerificationEmail(formData.email)
        setTempPassword(formData.password) // For auto-login after verify
        setFormState('verify')
        resetForm()
        if (result.verification_code) console.log('Verification code:', result.verification_code)
      } else {
        alert('Registration failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error: ' + error.message)
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
      const result = await userService.loginUser({
        email: formData.email,
        password: formData.password
      })

      if (result.success) {
        onLoginSuccess?.(result.user) // THIS UPDATES HEADER
        setShowSuccessMessage('Login successful!')
        setTimeout(() => setShowSuccessMessage(''), 3000)
      } else if (result.email_not_verified) {
        setVerificationEmail(formData.email)
        setTempPassword(formData.password)
        setFormState('verify')
      } else {
        setErrors({ general: result.error || 'Login failed' })
      }
    } catch (error) {
      setErrors({ general: 'Error: ' + error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifySubmit = async (e) => {
    e.preventDefault()
    const code = verificationCode.join('')
    if (code.length !== 6) {
      setErrors({ verification_code: 'Enter 6-digit code' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await userService.verifyEmail({
        email: verificationEmail,
        verification_code: code
      })

      if (result.success) {
        // Auto-login after verification
        const loginResult = await userService.loginUser({
          email: verificationEmail,
          password: tempPassword
        })

        if (loginResult.success) {
          onLoginSuccess?.(loginResult.user) // HEADER UPDATES
          setShowSuccessMessage('Verified & logged in!')
          setTimeout(() => {
            setFormState('login')
            setShowSuccessMessage('')
          }, 2000)
        }
      } else {
        setErrors({ verification_code: result.error || 'Verification failed' })
      }
    } catch (error) {
      setErrors({ verification_code: 'Error: ' + error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    setIsSubmitting(true)
    try {
      const result = await userService.resendVerification({ email: verificationEmail })
      if (result.success) {
        alert('Code resent!')
        if (result.verification_code) console.log('New code:', result.verification_code)
      } else {
        alert('Failed: ' + (result.error || 'Unknown'))
      }
    } catch (error) {
      alert('Error: ' + error.message)
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
    try {
      const result = await userService.forgotPassword({ email: formData.email })
      if (result.success) {
        setVerificationEmail(formData.email)
        setFormState('reset')
        resetForm()
        alert('Reset code sent!')
        if (result.reset_code) console.log('Reset code:', result.reset_code)
      } else {
        setErrors({ general: result.error || 'Failed' })
      }
    } catch (error) {
      setErrors({ general: 'Error: ' + error.message })
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
      setErrors({ reset_code: 'Enter 6-digit code' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await userService.resetPassword({
        email: verificationEmail,
        reset_code: code,
        new_password: formData.new_password
      })

      if (result.success) {
        setShowSuccessMessage('Password reset! Please log in.')
        setTimeout(() => {
          setFormState('login')
          setShowSuccessMessage('')
          resetForm()
        }, 3000)
      } else {
        setErrors({ reset_code: result.error || 'Reset failed' })
      }
    } catch (error) {
      setErrors({ reset_code: 'Error: ' + error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // === FORM SWITCHERS ===
  const switchToRegister = () => { setFormState('register'); resetForm() }
  const switchToLogin = () => { setFormState('login'); resetForm() }
  const switchToForgotPassword = () => { setFormState('forgot'); resetForm() }
  const switchToBackToLogin = () => { setFormState('login'); resetForm() }

  const resetForm = () => {
    setFormData({
      display_name: '', email: '', password: '', confirm_password: '',
      new_password: '', confirm_new_password: ''
    })
    setErrors({})
    setVerificationCode(['', '', '', '', '', ''])
    setResetCode(['', '', '', '', '', ''])
  }

  // === RENDER FORMS ===
  const renderRegisterForm = () => (
    <div className="form-content">
      <h2>Create Account</h2>
      <form onSubmit={handleRegisterSubmit} className="auth-form">
        <div className="form-group">
          <input type="text" name="display_name" placeholder="Username" value={formData.display_name} onChange={handleChange} className={errors.display_name ? 'error' : ''} />
          {errors.display_name && <span className="error-message">{errors.display_name}</span>}
        </div>
        <div className="form-group">
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className={errors.email ? 'error' : ''} />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>
        <div className="form-group">
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} className={errors.password ? 'error' : ''} />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>
        <div className="form-group">
          <input type="password" name="confirm_password" placeholder="Confirm Password" value={formData.confirm_password} onChange={handleChange} className={errors.confirm_password ? 'error' : ''} />
          {errors.confirm_password && <span className="error-message">{errors.confirm_password}</span>}
        </div>
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Registering...' : 'Register'}
        </button>
        <div className="form-footer">
          <span>Already Registered? </span>
          <button type="button" onClick={switchToLogin} className="link-btn">Login</button>
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
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className={errors.email ? 'error' : ''} />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>
        <div className="form-group">
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} className={errors.password ? 'error' : ''} />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
        <div className="form-footer">
          <button type="button" onClick={switchToForgotPassword} className="link-btn">Forgot Password</button>
          <button type="button" onClick={switchToRegister} className="link-btn">Register</button>
        </div>
      </form>
    </div>
  )

  const renderVerificationForm = () => (
    <div className="form-content">
      <h2>Verify Email</h2>
      <p className="verification-instructions">Code sent to {verificationEmail}</p>
      <form onSubmit={handleVerifySubmit} className="auth-form">
        <div className="verification-code-container">
          {verificationCode.map((digit, i) => (
            <input
              key={i}
              ref={el => verificationRefs.current[i] = el}
              type="text" maxLength="1" value={digit}
              onChange={e => handleVerificationCodeChange(i, e.target.value)}
              onPaste={handleVerificationCodePaste}
              className={`verification-digit ${errors.verification_code ? 'error' : ''}`}
            />
          ))}
        </div>
        {errors.verification_code && <span className="error-message">{errors.verification_code}</span>}
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Verifying...' : 'Verify'}
        </button>
        <div className="form-footer">
          <button type="button" onClick={handleResendVerification} disabled={isSubmitting} className="link-btn">
            Resend Code
          </button>
        </div>
      </form>
    </div>
  )

  const renderForgotPasswordForm = () => (
    <div className="form-content">
      <h2>Forgot Password</h2>
      <p className="verification-instructions">Enter your email to reset password.</p>
      <form onSubmit={handleForgotPassword} className="auth-form">
        <div className="form-group">
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className={errors.email ? 'error' : ''} />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Sending...' : 'Send Code'}
        </button>
        <div className="form-footer">
          <button type="button" onClick={switchToBackToLogin} className="link-btn">Back to Login</button>
        </div>
      </form>
    </div>
  )

  const renderResetPasswordForm = () => (
    <div className="form-content">
      <h2>Reset Password</h2>
      <p className="verification-instructions">Enter code and new password.</p>
      <form onSubmit={handleResetPassword} className="auth-form">
        <div className="verification-code-container">
          {resetCode.map((digit, i) => (
            <input
              key={i}
              ref={el => resetRefs.current[i] = el}
              type="text" maxLength="1" value={digit}
              onChange={e => handleResetCodeChange(i, e.target.value)}
              onPaste={handleResetCodePaste}
              className={`verification-digit ${errors.reset_code ? 'error' : ''}`}
            />
          ))}
        </div>
        {errors.reset_code && <span className="error-message">{errors.reset_code}</span>}
        <div className="form-group">
          <input type="password" name="new_password" placeholder="New Password" value={formData.new_password} onChange={handleChange} className={errors.new_password ? 'error' : ''} />
          {errors.new_password && <span className="error-message">{errors.new_password}</span>}
        </div>
        <div className="form-group">
          <input type="password" name="confirm_new_password" placeholder="Confirm New Password" value={formData.confirm_new_password} onChange={handleChange} className={errors.confirm_new_password ? 'error' : ''} />
          {errors.confirm_new_password && <span className="error-message">{errors.confirm_new_password}</span>}
        </div>
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Resetting...' : 'Reset'}
        </button>
      </form>
    </div>
  )

  return (
    <div className="form-container">
      {showSuccessMessage && <div className="success-message">{showSuccessMessage}</div>}
      {formState === 'register' && renderRegisterForm()}
      {formState === 'login' && renderLoginForm()}
      {formState === 'verify' && renderVerificationForm()}
      {formState === 'forgot' && renderForgotPasswordForm()}
      {formState === 'reset' && renderResetPasswordForm()}
    </div>
  )
}

export default BuddyForm