import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import '../pages/login.css'
import api from '../api/client'

const Login: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!username || !password) {
        setError('Please fill in all fields')
        return
      }

      const resp = await api.post('/users/login', { usernameOrEmail: username, password })
      localStorage.setItem('routed_token', resp.data.access_token)
      // navigate to dashboard on success
      navigate('/dashboard')
    } catch (err) {
      // try to surface backend message
      const message = (err as any)?.response?.data?.detail || 'Invalid username or password'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMessage('')
    setForgotLoading(true)

    try {
      if (!forgotEmail) {
        setForgotMessage('Please enter your email')
        return
      }

      // TODO: Replace with actual API call
      console.log('Forgot password request for:', forgotEmail)
      
      setForgotMessage('If an account exists with this email, you will receive password reset instructions.')
      setForgotEmail('')
      setTimeout(() => setShowForgotPassword(false), 2000)
    } catch (err) {
      setForgotMessage('Unable to process request. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="login-box"
        >
          {!showForgotPassword ? (
            <>
              <div className="login-header">
                <h1 className="login-title">Ready to Explore?</h1>
                <p className="login-subtitle">Sign in to your Routed account</p>
              </div>

              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label htmlFor="username" className="form-label">Username</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <div className="password-field">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="divider-or">
                <span>or</span>
              </div>

              <button
                type="button"
                className="google-button"
                disabled={loading}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="login-footer">
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </button>
              </div>

              <div className="signup-link">
                Don't have an account? <Link to="/signup" className="link">Sign up</Link>
              </div>
            </>
          ) : (
            <>
              <div className="login-header">
                <h1 className="login-title">Reset Password</h1>
                <p className="login-subtitle">Enter your email to receive reset instructions</p>
              </div>

              <form onSubmit={handleForgotPassword} className="login-form">
                <div className="form-group">
                  <label htmlFor="forgot-email" className="form-label">Email Address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="form-input"
                    disabled={forgotLoading}
                  />
                </div>

                {forgotMessage && (
                  <div className={`message ${forgotMessage.includes('will receive') ? 'success-message' : 'error-message'}`}>
                    {forgotMessage}
                  </div>
                )}

                <button
                  type="submit"
                  className="login-button"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="login-footer">
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Back to Login
                </button>
              </div>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="login-side-content"
        >
          <h2 className="side-title"><span className="title-primary">The next</span> <span className="title-accent">adventure awaits.</span></h2>
          <p className="side-subtitle">Connect with like-minded travelers and turn shared routes into lasting memories..</p>
          
          <div className="benefits-list">
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <span>Match with compatible travelers</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <span>Plan trips together seamlessly</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <span>Travel with verified, trusted profiles</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
