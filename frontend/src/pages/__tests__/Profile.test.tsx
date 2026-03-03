import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

import Profile from '../Profile'

const renderProfile = () =>
  render(
    <BrowserRouter>
      <Profile />
    </BrowserRouter>
  )

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  /* ─── Core rendering ─── */

  it('renders the profile page with default username', () => {
    renderProfile()
    expect(screen.getByText('JohnDoe')).toBeInTheDocument()
  })

  it('displays the user email', () => {
    renderProfile()
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
  })

  it('renders all profile field labels', () => {
    renderProfile()
    expect(screen.getByText('Username')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Date of Birth')).toBeInTheDocument()
    expect(screen.getByText('Interests')).toBeInTheDocument()
    expect(screen.getByText('Bio')).toBeInTheDocument()
  })

  it('shows placeholder text for empty fields', () => {
    renderProfile()
    expect(screen.getByText(/Where in the world are you from/i)).toBeInTheDocument()
    expect(screen.getByText(/What's your birthday/i)).toBeInTheDocument()
    expect(screen.getByText(/What makes your heart race/i)).toBeInTheDocument()
    expect(screen.getByText(/Share your travel story/i)).toBeInTheDocument()
  })

  it('displays travel stats in the banner', () => {
    renderProfile()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Trips')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Destinations')).toBeInTheDocument()
    expect(screen.getByText('Member Since')).toBeInTheDocument()
  })

  /* ─── Username editing ─── */

  it('enters edit mode for username and saves', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit username'))
    // Input appears with current value
    const input = screen.getByDisplayValue('JohnDoe')
    expect(input).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'JaneDoe')
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    // Back to view mode with new name
    await waitFor(() => {
      expect(screen.getByText('JaneDoe')).toBeInTheDocument()
    })
  })

  it('cancels username editing', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit username'))
    const input = screen.getByDisplayValue('JohnDoe')
    await user.clear(input)
    await user.type(input, 'TempName')
    await user.click(screen.getAllByRole('button', { name: /Cancel/i })[0])
    // Original name is back (the component doesn't revert state, but edit mode closes)
    await waitFor(() => {
      expect(screen.queryByDisplayValue('TempName')).not.toBeInTheDocument()
    })
  })

  /* ─── Email editing ─── */

  it('enters edit mode for email and shows input with current value', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit email'))
    const input = screen.getByDisplayValue('john.doe@example.com')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'email')
    // Save and Cancel buttons visible
    expect(screen.getAllByRole('button', { name: /Save/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Cancel/i }).length).toBeGreaterThan(0)
  })

  it('saves email editing and returns to view mode', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit email'))
    // Click save to close edit mode
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    // Should be back in view mode — no email input visible
    await waitFor(() => {
      expect(screen.queryByDisplayValue('john.doe@example.com')).not.toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    })
  })

  /* ─── Location editing ─── */

  it('enters edit mode for location and saves', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit location'))
    const input = screen.getByPlaceholderText('Enter your location')
    await user.type(input, 'Waterloo, Canada')
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    await waitFor(() => {
      expect(screen.getByText('Waterloo, Canada')).toBeInTheDocument()
    })
  })

  /* ─── Date of Birth editing ─── */

  it('enters edit mode for date of birth', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit date of birth'))
    // Date inputs are special — find it by type
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBeGreaterThan(0)
  })

  /* ─── Bio editing ─── */

  it('enters edit mode for bio and saves', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit bio'))
    const textarea = screen.getByPlaceholderText('Tell us about yourself...')
    expect(textarea).toBeInTheDocument()
    // Click Save to close the edit mode
    await user.click(screen.getAllByRole('button', { name: /Save/i })[0])
    // Textarea should be gone (back to view mode)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Tell us about yourself...')).not.toBeInTheDocument()
    })
  })

  it('cancels bio editing', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit bio'))
    expect(screen.getByPlaceholderText('Tell us about yourself...')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Cancel/i })[0])
    // Placeholder text returns
    await waitFor(() => {
      expect(screen.getByText(/Share your travel story/i)).toBeInTheDocument()
    })
  })

  /* ─── Interests editing ─── */

  it('enters interest editing mode', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    expect(screen.getByPlaceholderText(/Search interests or type your own/i)).toBeInTheDocument()
    expect(screen.getByText('No interests selected yet.')).toBeInTheDocument()
  })

  it('adds a custom interest via typing', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    await user.type(input, 'Scuba Diving')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))
    expect(screen.getByText('Scuba Diving')).toBeInTheDocument()
  })

  it('adds an interest from the dropdown list', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    await user.type(input, 'Hiking')
    // Dropdown should show 'Hiking & Trekking' option
    await waitFor(() => {
      expect(screen.getByText('Hiking & Trekking')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Hiking & Trekking'))
    expect(screen.getByText('Hiking & Trekking')).toBeInTheDocument()
  })

  it('removes an interest', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    // Add a custom interest that won't appear in dropdown
    await user.type(input, 'Skydiving Adventures')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))
    expect(screen.getByText('Skydiving Adventures')).toBeInTheDocument()
    // Click the × remove button
    await user.click(screen.getByLabelText('Remove Skydiving Adventures'))
    await waitFor(() => {
      expect(screen.queryByText('Skydiving Adventures')).not.toBeInTheDocument()
    })
  })

  it('saves interests and returns to view mode', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit interests'))
    const input = screen.getByPlaceholderText(/Search interests or type your own/i)
    await user.type(input, 'Nightlife')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))
    // Click the Save button in the interests section
    const saveButtons = screen.getAllByRole('button', { name: /Save/i })
    await user.click(saveButtons[0])
    // Should now be in view mode showing the interest pill
    await waitFor(() => {
      expect(screen.getByText('Nightlife')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText(/Search interests/i)).not.toBeInTheDocument()
    })
  })

  /* ─── Profile picture menu ─── */

  it('opens profile picture menu on click', async () => {
    renderProfile()
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
    renderProfile()
    const user = userEvent.setup()
    // Open settings dropdown first
    await user.click(screen.getByLabelText('Settings'))
    await user.click(screen.getByText('Logout'))
    expect(localStorage.getItem('routed_token')).toBeNull()
    expect(localStorage.getItem('routed_shortlisted')).toBeNull()
    expect(localStorage.getItem('routed_my_trips')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  /* ─── Settings dropdown navigation ─── */

  it('settings dropdown has Dashboard, My Trips, and Explore links', async () => {
    renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Settings'))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('My Trips')).toBeInTheDocument()
    expect(screen.getByText('Explore')).toBeInTheDocument()
  })

  it('renders Back to Dashboard link', () => {
    renderProfile()
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
  })
})
