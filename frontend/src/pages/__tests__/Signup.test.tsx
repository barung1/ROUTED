import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
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

import Signup from '../Signup'
import api from '../../api/client'

const renderSignup = () =>
  render(
    <BrowserRouter>
      <Signup />
    </BrowserRouter>
  )

describe('Signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the signup form heading', () => {
    renderSignup()
    expect(screen.getByText('Join the Adventure')).toBeInTheDocument()
    expect(screen.getByText('Create your Routed account')).toBeInTheDocument()
  })

  it('renders all required form fields', () => {
    renderSignup()
    expect(screen.getByLabelText(/^First Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Last Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Address/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Username/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Confirm Password/)).toBeInTheDocument()
  })

  it('renders optional fields', () => {
    renderSignup()
    expect(screen.getByLabelText(/Preferred First Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument()
  })

  it('shows error when submitting empty form', async () => {
    renderSignup()
    const submitBtn = screen.getByRole('button', { name: /Create Account/i })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()
    })
  })

  it('shows error when passwords do not match', async () => {
    renderSignup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^First Name/), 'John')
    await user.type(screen.getByLabelText(/Last Name/), 'Doe')
    await user.type(screen.getByLabelText(/Email Address/), 'john@example.com')
    await user.type(screen.getByLabelText(/^Username/), 'johndoe')
    await user.type(screen.getByLabelText(/^Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm Password/), 'different')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  it('shows error when password is too short', async () => {
    renderSignup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^First Name/), 'John')
    await user.type(screen.getByLabelText(/Last Name/), 'Doe')
    await user.type(screen.getByLabelText(/Email Address/), 'john@example.com')
    await user.type(screen.getByLabelText(/^Username/), 'johndoe')
    await user.type(screen.getByLabelText(/^Password/), 'abc')
    await user.type(screen.getByLabelText(/Confirm Password/), 'abc')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
    })
  })

  it('calls API on valid submission', async () => {
    const mockPost = vi.mocked(api.post)
    mockPost.mockResolvedValue({ data: {} })

    renderSignup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^First Name/), 'John')
    await user.type(screen.getByLabelText(/Last Name/), 'Doe')
    await user.type(screen.getByLabelText(/Email Address/), 'john@example.com')
    await user.type(screen.getByLabelText(/^Username/), 'johndoe')
    await user.type(screen.getByLabelText(/^Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm Password/), 'password123')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/users/register', expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
      }))
    })
  })

  it('shows API error on failure', async () => {
    const mockPost = vi.mocked(api.post)
    mockPost.mockRejectedValue({
      response: { data: { detail: 'Username already taken' } },
    })

    renderSignup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^First Name/), 'John')
    await user.type(screen.getByLabelText(/Last Name/), 'Doe')
    await user.type(screen.getByLabelText(/Email Address/), 'john@example.com')
    await user.type(screen.getByLabelText(/^Username/), 'johndoe')
    await user.type(screen.getByLabelText(/^Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm Password/), 'password123')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(screen.getByText('Username already taken')).toBeInTheDocument()
    })
  })

  it('has a link to login page', () => {
    renderSignup()
    const loginLink = screen.getByText(/Sign in/i).closest('a')
    expect(loginLink).toHaveAttribute('href', '/login')
  })
})
