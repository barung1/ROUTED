import { vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

// Mock framer-motion with a Proxy so any motion.* returns a simple wrapper
vi.mock('framer-motion', () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...rest }: any) => {
          const {
            initial, animate, exit, transition, whileHover, whileTap, whileInView,
            variants, layout, layoutId, onAnimationComplete, ...htmlProps
          } = rest
          return <div data-testid={`motion-${String(prop)}`} {...htmlProps}>{children}</div>
        }
      },
    },
  )
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock the API client
const mockGet = vi.fn()
const mockPut = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: (...args: any[]) => mockPut(...args),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() } },
  },
}))

import Profile from '../Profile'

/* ── Default profile data returned by GET /users/me ── */
const MOCK_PROFILE = {
  username: 'JohnDoe',
  email: 'john.doe@example.com',
  location: 'Toronto',
  dateOfBirth: '1998-05-20',
  bio: 'Love to travel!',
  interests: ['Hiking & Trekking'],
  memberSince: '2024-01-15',
  tripsCount: 5,
}

const renderProfile = async () => {
  render(
    <BrowserRouter>
      <Profile />
    </BrowserRouter>
  )
  // Wait for the loading state to finish (component fetches /users/me)
  await waitFor(() => {
    expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument()
  })
}

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Default: GET /users/me returns profile data
    mockGet.mockResolvedValue({ data: { ...MOCK_PROFILE } })
    // Default: PUT /users/me echoes back the payload merged with existing profile
    mockPut.mockImplementation((_url: string, payload: any) =>
      Promise.resolve({ data: { ...MOCK_PROFILE, ...payload } })
    )
  })

  /* ─── Loading & fetch ─── */

  it('shows loading state then renders profile after fetch', async () => {
    let resolveFetch!: (v: any) => void
    mockGet.mockReturnValue(new Promise((r) => { resolveFetch = r }))
    render(<BrowserRouter><Profile /></BrowserRouter>)
    expect(screen.getByText('Loading profile...')).toBeInTheDocument()
    resolveFetch({ data: MOCK_PROFILE })
    await waitFor(() => {
      expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument()
      expect(screen.getByText('JohnDoe')).toBeInTheDocument()
    })
  })

  it('fetches profile from GET /users/me on mount', async () => {
    await renderProfile()
    expect(mockGet).toHaveBeenCalledWith('/users/me')
  })

  /* ─── Core rendering ─── */

  it('renders the profile page with username from API', async () => {
    await renderProfile()
    expect(screen.getByText('JohnDoe')).toBeInTheDocument()
  })

  it('displays the user email from API', async () => {
    await renderProfile()
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
  })

  it('renders all profile field labels', async () => {
    await renderProfile()
    expect(screen.getByText('Username')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Date of Birth')).toBeInTheDocument()
    expect(screen.getByText('Interests')).toBeInTheDocument()
    expect(screen.getByText('Bio')).toBeInTheDocument()
  })

  it('displays travel stats in the banner', async () => {
    await renderProfile()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Trips')).toBeInTheDocument()
    expect(screen.getByText('Member Since')).toBeInTheDocument()
  })

  it('displays bio from API', async () => {
    await renderProfile()
    expect(screen.getByText('Love to travel!')).toBeInTheDocument()
  })

  it('displays location from API', async () => {
    await renderProfile()
    expect(screen.getByText('Toronto')).toBeInTheDocument()
  })

  it('displays interests from API', async () => {
    await renderProfile()
    expect(screen.getByText('Hiking & Trekking')).toBeInTheDocument()
  })

  /* ─── Empty profile fields show placeholders ─── */

  it('shows placeholder text for empty fields', async () => {
    mockGet.mockResolvedValue({
      data: { username: 'JohnDoe', email: 'john@example.com', tripsCount: 0 },
    })
    await renderProfile()
    expect(screen.getByText(/Where in the world are you from/i)).toBeInTheDocument()
    expect(screen.getByText(/What makes your heart race/i)).toBeInTheDocument()
    expect(screen.getByText(/Share your travel story/i)).toBeInTheDocument()
  })

  /* ─── Username editing ─── */

  it('enters edit mode for username and saves via API', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit username'))
    const input = screen.getByDisplayValue('JohnDoe')
    expect(input).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'JaneDoe')
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/users/me', { username: 'JaneDoe' })
    })
  })

  it('cancels username editing', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit username'))
    expect(screen.getByDisplayValue('JohnDoe')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Cancel/i })[0])
    await waitFor(() => {
      expect(screen.queryByDisplayValue('JohnDoe')).not.toBeInTheDocument()
      expect(screen.getByText('JohnDoe')).toBeInTheDocument()
    })
  })

  /* ─── Email editing ─── */

  it('enters edit mode for email and shows input with current value', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit email'))
    const input = screen.getByDisplayValue('john.doe@example.com')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'email')
  })

  it('saves email via PUT /users/me', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit email'))
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/users/me', { email: 'john.doe@example.com' })
    })
  })

  /* ─── Location editing ─── */

  it('enters edit mode for location and saves via API', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit location'))
    const input = screen.getByDisplayValue('Toronto')
    await user.clear(input)
    await user.type(input, 'Waterloo')
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/users/me', { location: 'Waterloo' })
    })
  })

  /* ─── Date of Birth editing ─── */

  it('enters edit mode for date of birth', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit date of birth'))
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBeGreaterThan(0)
  })

  /* ─── Bio editing ─── */

  it('enters edit mode for bio and saves via API', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit bio'))
    const textarea = screen.getByPlaceholderText('Tell us about yourself...')
    expect(textarea).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/users/me', { bio: 'Love to travel!' })
    })
  })

  it('cancels bio editing', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit bio'))
    expect(screen.getByPlaceholderText('Tell us about yourself...')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Cancel/i })[0])
    await waitFor(() => {
      expect(screen.getByText('Love to travel!')).toBeInTheDocument()
    })
  })

  /* ─── Interests editing ─── */

  it('enters interest editing mode', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, interests: [] },
    })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    expect(screen.getByPlaceholderText(/Search interests or type your own/i)).toBeInTheDocument()
    expect(screen.getByText('No interests selected yet.')).toBeInTheDocument()
  })

  it('adds a custom interest via typing', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    await user.type(input, 'Scuba Diving')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))
    expect(screen.getByText('Scuba Diving')).toBeInTheDocument()
  })

  it('adds an interest from the dropdown list', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, interests: [] },
    })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    await user.type(input, 'Hiking')
    await waitFor(() => {
      expect(screen.getByText('Hiking & Trekking')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Hiking & Trekking'))
    expect(screen.getByText('Hiking & Trekking')).toBeInTheDocument()
  })

  it('removes an interest', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    await user.type(input, 'Skydiving Adventures')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))
    // Wait for the chip to appear and DOM to stabilise after onBlur timeout
    await waitFor(() => {
      expect(screen.getByLabelText('Remove Skydiving Adventures')).toBeInTheDocument()
    })
    // Flush the 120ms onBlur setTimeout so the dropdown closes before we click Remove
    await act(async () => { await new Promise((r) => setTimeout(r, 150)) })
    await user.click(screen.getByLabelText('Remove Skydiving Adventures'))
    await waitFor(() => {
      expect(screen.queryByText('Skydiving Adventures')).not.toBeInTheDocument()
    })
  })

  it('saves interests via PUT /users/me', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    await user.type(input, 'Nightlife')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))
    // Wait for the chip to appear and DOM to stabilise after onBlur timeout
    await waitFor(() => {
      expect(screen.getByText('Nightlife')).toBeInTheDocument()
    })
    // Flush the 120ms onBlur setTimeout so the dropdown closes before we click Save
    await act(async () => { await new Promise((r) => setTimeout(r, 150)) })
    const saveButtons = screen.getAllByRole('button', { name: /Save/i })
    await user.click(saveButtons[0])
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/users/me', {
        interests: ['Hiking & Trekking', 'Nightlife'],
      })
    })
  })

  /* ─── Profile picture menu ─── */

  it('opens profile picture menu on click', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    expect(screen.getByText('Choose from Gallery')).toBeInTheDocument()
    expect(screen.getByText('Take a Photo')).toBeInTheDocument()
  })

  /* ─── Logout ─── */

  it('logs out, clears localStorage, and navigates to home', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_shortlisted', '[]')
    localStorage.setItem('routed_my_trips', '[]')
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Settings'))
    await user.click(screen.getByText('Logout'))
    expect(localStorage.getItem('routed_token')).toBeNull()
    expect(localStorage.getItem('routed_shortlisted')).toBeNull()
    expect(localStorage.getItem('routed_my_trips')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  /* ─── Settings dropdown navigation ─── */

  it('settings dropdown has Dashboard, My Trips, and Explore links', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Settings'))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('My Trips')).toBeInTheDocument()
    expect(screen.getByText('Explore')).toBeInTheDocument()
  })

  it('renders Back to Dashboard link', async () => {
    await renderProfile()
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
  })

  /* ─── API error handling ─── */

  it('redirects to login on 401 error', async () => {
    mockGet.mockRejectedValue({ response: { status: 401 } })
    render(<BrowserRouter><Profile /></BrowserRouter>)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
    expect(localStorage.getItem('routed_token')).toBeNull()
  })

  it('shows error message on API failure', async () => {
    mockGet.mockRejectedValue({ response: { status: 500, data: { detail: 'Server error' } } })
    render(<BrowserRouter><Profile /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })
})
