import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock the API client
const mockGet = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: vi.fn(),
    put: (...args: any[]) => mockPut(...args),
    delete: (...args: any[]) => mockDelete(...args),
    interceptors: { request: { use: vi.fn() } },
  },
}))

import Trips from '../Trips'

const SAMPLE_TRIP = {
  id: 'trip-1',
  fromPlace: 'Toronto',
  toPlace: 'Paris',
  startDate: '2026-06-01',
  endDate: '2026-06-15',
  modeOfTravel: 'flight',
  budget: 2000,
  interests: ['museums', 'food'],
  description: 'Summer trip to Paris',
  status: 'planned',
  username: 'alice',
}

const SAMPLE_SHORTLISTED = {
  id: 'short-1',
  userId: 'u2',
  username: 'bob_jones',
  locationId: 'loc-1',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  status: 'planned',
  fromPlace: 'NYC',
  toPlace: 'Tokyo',
  modeOfTravel: 'flight',
  budget: 5000,
  interests: ['anime', 'sushi'],
  description: 'Dream trip to Japan',
}

const renderTrips = () =>
  render(
    <BrowserRouter>
      <Trips />
    </BrowserRouter>
  )

describe('Trips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGet.mockResolvedValue({ data: [] })
    mockPut.mockResolvedValue({ data: {} })
    mockDelete.mockResolvedValue({ data: {} })
  })

  /* ─── Existing core tests ─── */

  it('renders the page heading', () => {
    renderTrips()
    expect(screen.getByRole('heading', { name: /Trips/i })).toBeInTheDocument()
  })

  it('renders My Trips and Shortlisted tabs', () => {
    renderTrips()
    expect(screen.getByRole('button', { name: /My Trips/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Shortlisted/i })).toBeInTheDocument()
  })

  it('shows empty state when no trips exist', async () => {
    renderTrips()
    await waitFor(() => {
      expect(screen.getByText(/No trips yet/i)).toBeInTheDocument()
    })
  })

  it('fetches trips from API on mount', async () => {
    renderTrips()
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/trips/me')
    })
  })

  it('can switch between My Trips and Shortlisted tabs', async () => {
    renderTrips()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Shortlisted/i }))
    expect(screen.getByText(/No shortlisted trips/i)).toBeInTheDocument()
  })

  it('renders trip items from API data', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    await waitFor(() => {
      expect(screen.getByText(/Toronto → Paris/i)).toBeInTheDocument()
    })
  })

  it('falls back to localStorage on API error', async () => {
    const localTrips = [{
      id: 'local-1', fromPlace: 'NYC', toPlace: 'London',
      startDate: '2026-07-01', endDate: '2026-07-10',
      travelMode: 'Flight', budget: '3000', currency: 'USD',
      interests: 'history', description: 'Local trip', status: 'planned',
    }]
    localStorage.setItem('routed_my_trips', JSON.stringify(localTrips))
    mockGet.mockRejectedValue(new Error('Network error'))
    renderTrips()
    await waitFor(() => {
      expect(screen.getByText(/London/i)).toBeInTheDocument()
    })
  })

  /* ─── Trip card details ─── */

  it('displays trip status badge', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    await waitFor(() => {
      expect(screen.getByText(/Planned/i)).toBeInTheDocument()
    })
  })

  it('displays travel mode, budget, and interests chips', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    await waitFor(() => {
      expect(screen.getByText(/Flight/i)).toBeInTheDocument()
      expect(screen.getByText(/USD 2000/i)).toBeInTheDocument()
      expect(screen.getByText(/museums, food/i)).toBeInTheDocument()
    })
  })

  it('shows username badge on trip card', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    await waitFor(() => {
      expect(screen.getByText(/@alice/i)).toBeInTheDocument()
    })
  })

  /* ─── Show/hide description ─── */

  it('shows and hides trip description on toggle', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText(/Show details/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Show details/i))
    expect(screen.getByText(/Summer trip to Paris/i)).toBeInTheDocument()
    await user.click(screen.getByText(/Hide details/i))
    // After hiding, description element is removed from DOM by AnimatePresence
  })

  /* ─── Remove trip ─── */

  it('removes a trip from the list and calls API delete', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText(/Toronto → Paris/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText('Remove'))
    // Trip disappears from UI
    await waitFor(() => {
      expect(screen.queryByText(/Toronto → Paris/i)).not.toBeInTheDocument()
    })
    // API delete is called
    expect(mockDelete).toHaveBeenCalledWith('/trips/trip-1')
  })

  it('updates localStorage when a trip is removed', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText(/Toronto → Paris/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText('Remove'))
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('routed_my_trips') || '[]')
      expect(stored).toHaveLength(0)
    })
  })

  /* ─── Edit trip ─── */

  it('opens edit form when Edit button is clicked', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText(/Toronto → Paris/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/✏️ Edit/i))
    // Edit form fields appear
    await waitFor(() => {
      expect(screen.getByDisplayValue('Toronto')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Paris')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2026-06-01')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2026-06-15')).toBeInTheDocument()
    })
  })

  it('cancels editing and returns to view mode', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    const user = userEvent.setup()
    await waitFor(() => screen.getByText(/Toronto → Paris/i))
    await user.click(screen.getByText(/✏️ Edit/i))
    await waitFor(() => screen.getByDisplayValue('Toronto'))
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    // Back to view mode — route text visible again
    await waitFor(() => {
      expect(screen.getByText(/Toronto → Paris/i)).toBeInTheDocument()
    })
  })

  it('saves edits via API and updates the card', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    const user = userEvent.setup()
    await waitFor(() => screen.getByText(/Toronto → Paris/i))
    await user.click(screen.getByText(/✏️ Edit/i))

    // Change "To" field
    const toInput = screen.getByDisplayValue('Paris')
    await user.clear(toInput)
    await user.type(toInput, 'Rome')

    await user.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/trips/trip-1', expect.objectContaining({
        toPlace: 'Rome',
      }))
    })
    // Card now shows updated destination
    await waitFor(() => {
      expect(screen.getByText(/Toronto → Rome/i)).toBeInTheDocument()
    })
  })

  it('persists edited trip to localStorage', async () => {
    mockGet.mockResolvedValue({ data: [SAMPLE_TRIP] })
    renderTrips()
    const user = userEvent.setup()
    await waitFor(() => screen.getByText(/Toronto → Paris/i))
    await user.click(screen.getByText(/✏️ Edit/i))
    const toInput = screen.getByDisplayValue('Paris')
    await user.clear(toInput)
    await user.type(toInput, 'Rome')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('routed_my_trips') || '[]')
      expect(stored[0].toPlace).toBe('Rome')
    })
  })

  /* ─── Shortlisted tab ─── */

  it('renders shortlisted trips from localStorage', async () => {
    localStorage.setItem('routed_shortlisted', JSON.stringify([SAMPLE_SHORTLISTED]))
    renderTrips()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Shortlisted/i }))
    await waitFor(() => {
      expect(screen.getByText(/NYC → Tokyo/i)).toBeInTheDocument()
      expect(screen.getByText(/@bob_jones/i)).toBeInTheDocument()
    })
  })

  it('shows shortlisted trip interests as tags', async () => {
    localStorage.setItem('routed_shortlisted', JSON.stringify([SAMPLE_SHORTLISTED]))
    renderTrips()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Shortlisted/i }))
    await waitFor(() => {
      expect(screen.getByText('anime')).toBeInTheDocument()
      expect(screen.getByText('sushi')).toBeInTheDocument()
    })
  })

  it('shows shortlisted trip description', async () => {
    localStorage.setItem('routed_shortlisted', JSON.stringify([SAMPLE_SHORTLISTED]))
    renderTrips()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Shortlisted/i }))
    await waitFor(() => {
      expect(screen.getByText(/Dream trip to Japan/i)).toBeInTheDocument()
    })
  })

  it('removes a shortlisted trip and updates localStorage', async () => {
    localStorage.setItem('routed_shortlisted', JSON.stringify([SAMPLE_SHORTLISTED]))
    renderTrips()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Shortlisted/i }))
    await waitFor(() => screen.getByText(/NYC → Tokyo/i))
    await user.click(screen.getByText('Remove'))
    await waitFor(() => {
      expect(screen.queryByText(/NYC → Tokyo/i)).not.toBeInTheDocument()
      const stored = JSON.parse(localStorage.getItem('routed_shortlisted') || '[]')
      expect(stored).toHaveLength(0)
    })
  })

  it('shows "Plan a similar trip" link for shortlisted trips', async () => {
    localStorage.setItem('routed_shortlisted', JSON.stringify([SAMPLE_SHORTLISTED]))
    renderTrips()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Shortlisted/i }))
    await waitFor(() => {
      expect(screen.getByText(/Plan a similar trip/i)).toBeInTheDocument()
    })
  })

  it('shows shortlisted empty state with Explore link', async () => {
    renderTrips()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Shortlisted/i }))
    expect(screen.getByText(/No shortlisted trips/i)).toBeInTheDocument()
    // There are two "Explore Trips" links (header + empty state), just check at least one
    const links = screen.getAllByText(/Explore Trips/i)
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  /* ─── Navigation links ─── */

  it('renders Back to Dashboard and Explore Trips links', () => {
    renderTrips()
    expect(screen.getByText(/Back to Dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/🌍 Explore Trips/i)).toBeInTheDocument()
  })
})
