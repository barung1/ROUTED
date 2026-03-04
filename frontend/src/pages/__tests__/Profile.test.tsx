import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    // Wait for the chip to appear and the 120ms onBlur timeout to close the dropdown
    await waitFor(() => {
      expect(screen.getByLabelText('Remove Skydiving Adventures')).toBeInTheDocument()
    })
    await new Promise((r) => setTimeout(r, 200))
    await waitFor(() => {
      expect(screen.getByLabelText('Remove Skydiving Adventures')).toBeInTheDocument()
    })
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
    // Wait for the chip to appear and the 120ms onBlur timeout to close the dropdown
    await waitFor(() => {
      expect(screen.getByText('Nightlife')).toBeInTheDocument()
    })
    await new Promise((r) => setTimeout(r, 200))
    await waitFor(() => {
      expect(screen.getByText('Nightlife')).toBeInTheDocument()
    })
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

  /* ─── Profile picture display ─── */

  it('displays profile picture from API when available', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/photo.jpg' },
    })
    await renderProfile()
    const img = screen.getByAltText('Profile')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('shows default avatar icon when no profile picture', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, profilePicture: '' },
    })
    await renderProfile()
    expect(screen.queryByAltText('Profile')).not.toBeInTheDocument()
  })

  /* ─── Remove profile picture ─── */

  it('shows Remove Picture option when profile picture exists', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/photo.jpg' },
    })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    expect(screen.getByText('Remove Picture')).toBeInTheDocument()
  })

  it('does not show Remove Picture option when no profile picture', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, profilePicture: '' },
    })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    expect(screen.queryByText('Remove Picture')).not.toBeInTheDocument()
  })

  it('removes profile picture via PUT /users/me with null', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/photo.jpg' },
    })
    mockPut.mockResolvedValue({ data: { ...MOCK_PROFILE, profilePicture: null } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Remove Picture'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/users/me', { profilePicture: null })
    })
    // Profile picture should be removed from the DOM
    await waitFor(() => {
      expect(screen.queryByAltText('Profile')).not.toBeInTheDocument()
    })
  })

  it('updates localStorage when profile picture is removed', async () => {
    localStorage.setItem('routed_user', JSON.stringify({ username: 'JohnDoe', profilePicture: 'old.jpg' }))
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/photo.jpg' },
    })
    mockPut.mockResolvedValue({ data: { ...MOCK_PROFILE, profilePicture: null } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Remove Picture'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/users/me', { profilePicture: null })
    })
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('routed_user') || '{}')
      expect(stored.profilePicture).toBeNull()
    })
  })

  it('shows error when remove profile picture API fails', async () => {
    mockGet.mockResolvedValue({
      data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/photo.jpg' },
    })
    mockPut.mockRejectedValue({ response: { data: { detail: 'Failed to remove picture' } } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Remove Picture'))
    await waitFor(() => {
      expect(screen.getByText('Failed to remove picture')).toBeInTheDocument()
    })
  })

  /* ─── Profile picture upload ─── */

  it('uploads a JPEG file via PUT /users/me/profile-picture', async () => {
    mockPut.mockResolvedValue({ data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/new.jpg' } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Choose from Gallery'))

    const file = new File(['dummy-jpeg-data'], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    expect(fileInput).not.toBeNull()

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/users/me/profile-picture',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
    })
  })

  it('updates profile picture in state after successful upload', async () => {
    mockPut.mockResolvedValue({ data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/uploaded.jpg' } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Choose from Gallery'))

    const file = new File(['dummy-jpeg-data'], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    await user.upload(fileInput, file)

    await waitFor(() => {
      const img = screen.getByAltText('Profile')
      expect(img).toHaveAttribute('src', 'https://example.com/uploaded.jpg')
    })
  })

  it('updates localStorage after successful profile picture upload', async () => {
    localStorage.setItem('routed_user', JSON.stringify({ username: 'JohnDoe' }))
    mockPut.mockResolvedValue({ data: { ...MOCK_PROFILE, profilePicture: 'https://example.com/uploaded.jpg' } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Choose from Gallery'))

    const file = new File(['dummy-jpeg-data'], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    await user.upload(fileInput, file)

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('routed_user') || '{}')
      expect(stored.profilePicture).toBe('https://example.com/uploaded.jpg')
    })
  })

  /* ─── Profile picture upload validation ─── */

  it('rejects non-JPEG file type', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Choose from Gallery'))

    const file = new File(['png-data'], 'photo.png', { type: 'image/png' })
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    // Use fireEvent to bypass the HTML accept attribute filter
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Please select a JPEG/JPG image file')).toBeInTheDocument()
    })
    expect(mockPut).not.toHaveBeenCalledWith('/users/me/profile-picture', expect.anything(), expect.anything())
  })

  it('rejects file larger than 2MB', async () => {
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Choose from Gallery'))

    // Create a file just over 2MB
    const largeContent = new ArrayBuffer(2 * 1024 * 1024 + 1)
    const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    // Use fireEvent to bypass the browser file size check
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Profile picture must be 2MB or smaller')).toBeInTheDocument()
    })
    expect(mockPut).not.toHaveBeenCalledWith('/users/me/profile-picture', expect.anything(), expect.anything())
  })

  /* ─── Profile picture upload error handling ─── */

  it('shows error message when upload API fails', async () => {
    mockPut.mockRejectedValue({ response: { data: { detail: 'Upload failed' } } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Choose from Gallery'))

    const file = new File(['dummy-jpeg-data'], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  it('shows default error message when upload fails without detail', async () => {
    mockPut.mockRejectedValue({ response: { status: 500 } })
    await renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Edit profile picture'))
    await user.click(screen.getByText('Choose from Gallery'))

    const file = new File(['dummy-jpeg-data'], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText('Failed to upload profile picture. Please try again.')).toBeInTheDocument()
    })
  })

  /* ─── File input attributes ─── */

  it('gallery file input only accepts JPEG files', async () => {
    await renderProfile()
    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
    expect(fileInput).not.toBeNull()
    expect(fileInput.getAttribute('accept')).toBe('image/jpeg,image/jpg,.jpg,.jpeg')
  })

  it('camera file input only accepts JPEG files and has capture attribute', async () => {
    await renderProfile()
    const cameraInput = document.querySelector('input[type="file"][capture]') as HTMLInputElement
    expect(cameraInput).not.toBeNull()
    expect(cameraInput.getAttribute('accept')).toBe('image/jpeg,image/jpg,.jpg,.jpeg')
    expect(cameraInput.getAttribute('capture')).toBe('environment')
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
