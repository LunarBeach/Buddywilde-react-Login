import React, { useState, useEffect, useRef } from 'react';
import './ContactForm.css';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    subject: '',
    message: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  
  const hoverSoundRef = useRef(null);

  // Initialize audio
  useEffect(() => {
    hoverSoundRef.current = new Audio('https://buddywilde.com/wp-content/uploads/2025/10/Highlighter_stroke.wav');
  }, []);

  // Email validation
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Check form validity
  const isFormValid = () => {
    return (
      formData.email &&
      isValidEmail(formData.email) &&
      formData.subject.trim() &&
      formData.message.trim()
    );
  };

  // Handle hover sound
  const handleHover = () => {
    if (isFormValid() && hoverSoundRef.current) {
      hoverSoundRef.current.currentTime = 0;
      hoverSoundRef.current.play().catch(e => console.log('Audio play prevented:', e));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors and messages
    setErrors({});
    setSubmitMessage('');
    
    // Validate form
    const newErrors = {};
    let hasErrors = false;
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
      hasErrors = true;
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      hasErrors = true;
    }
    
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
      hasErrors = true;
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
      hasErrors = true;
    }
    
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }
    
    // Submit form
    setIsSubmitting(true);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('action', 'buddywilde_send_contact');
      formDataToSend.append('contact_email', formData.email);
      formDataToSend.append('contact_subject', formData.subject);
      formDataToSend.append('contact_message', formData.message);
      
      // Get nonce from WordPress (you'll need to pass this as a prop or fetch it)
      const nonce = document.querySelector('input[name="contact_nonce"]')?.value || 
                   document.querySelector('meta[name="contact-nonce"]')?.getAttribute('content');
      
      if (nonce) {
        formDataToSend.append('contact_nonce', nonce);
      }
      
      const response = await fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        body: formDataToSend,
        credentials: 'same-origin'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubmitMessage('Message sent successfully!');
        setMessageType('success');
        setFormData({ email: '', subject: '', message: '' });
      } else {
        setSubmitMessage(data.data || 'Error sending message. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      setSubmitMessage('Error sending message. Please try again.');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="buddywilde-contact-container">
      <div className="contact-content-wrapper">
        <h1 className="contact-page-title">You are not a failure just because you're struggling.</h1>
        
        <div className="contact-form-section">
          <form id="buddywilde-contact-form" className="contact-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="contact-email">Your Email *</label>
              <input
                type="email"
                id="contact-email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                required
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="contact-subject">Subject *</label>
              <input
                type="text"
                id="contact-subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className={errors.subject ? 'error' : ''}
                required
              />
              {errors.subject && <span className="error-message">{errors.subject}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="contact-message">Message *</label>
              <textarea
                id="contact-message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="6"
                className={errors.message ? 'error' : ''}
                required
              />
              {errors.message && <span className="error-message">{errors.message}</span>}
            </div>
            
            <button
              type="submit"
              id="contact-submit"
              className={`submit-button ${isFormValid() && !isSubmitting ? '' : 'disabled'}`}
              disabled={!isFormValid() || isSubmitting}
              onMouseEnter={handleHover}
            >
              {isSubmitting ? 'Sending...' : 'Send'}
            </button>
            
            {submitMessage && (
              <div className={`form-message ${messageType}`}>
                {submitMessage}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;
