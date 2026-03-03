import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock the API client
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}))

import Login from '../Login'
import api from '../../api/client'

const renderLogin = () =>
  render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  )

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the login form heading', () => {
    renderLogin()
    expect(screen.getByText('Ready to Explore?')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your Routed account')).toBeInTheDocument()
  })

  it('renders username and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders the sign in button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
  })

  it('shows error when submitting empty form', async () => {
    renderLogin()
    const submitBtn = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()
    })
  })

  it('allows typing in username and password fields', async () => {
    renderLogin()
    const user = userEvent.setup()
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')

    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'secret123')

    expect(usernameInput).toHaveValue('testuser')
    expect(passwordInput).toHaveValue('secret123')
  })

  it('toggles password visibility', async () => {
    renderLogin()
    const user = userEvent.setup()
    const passwordInput = screen.getByLabelText('Password')

    // Initially password is hidden
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Click the toggle button (the eye icon button)
    const toggleBtn = passwordInput.parentElement?.querySelector('button')
    if (toggleBtn) {
      await user.click(toggleBtn)
      expect(passwordInput).toHaveAttribute('type', 'text')
    }
  })

  it('calls API on valid submission', async () => {
    const mockPost = vi.mocked(api.post)
    mockPost.mockResolvedValue({
      data: { access_token: 'test-token', user: { username: 'testuser' } },
    })

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/users/login', {
        usernameOrEmail: 'testuser',
        password: 'password123',
      })
    })
  })

  it('stores token in localStorage on successful login', async () => {
    const mockPost = vi.mocked(api.post)
    mockPost.mockResolvedValue({
      data: { access_token: 'abc123', user: { username: 'testuser' } },
    })

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(localStorage.getItem('routed_token')).toBe('abc123')
    })
  })

  it('shows error message on API failure', async () => {
    const mockPost = vi.mocked(api.post)
    mockPost.mockRejectedValue({
      response: { data: { detail: 'Invalid credentials' } },
    })

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Username'), 'wrong')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('renders link to sign up page', () => {
    renderLogin()
    const signupLink = screen.getByText(/Sign up/i).closest('a')
    expect(signupLink).toHaveAttribute('href', '/signup')
  })
})
