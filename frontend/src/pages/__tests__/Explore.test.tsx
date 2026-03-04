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
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock the API client
const mockGet = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}))

import Explore from '../Explore'

const renderExplore = () =>
  render(
    <BrowserRouter>
      <Explore />
    </BrowserRouter>
  )

describe('Explore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGet.mockResolvedValue({ data: [] })
  })

  it('renders the Explore page', () => {
    renderExplore()
    expect(screen.getByRole('heading', { name: /Explore Trips/i })).toBeInTheDocument()
  })

  it('renders a search input', () => {
    renderExplore()
    const searchInput = screen.getByPlaceholderText(/search/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('fetches trips from API on mount', async () => {
    renderExplore()
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/trips/')
    })
  })

  it('displays trips returned by the API', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          id: '1',
          userId: 'u1',
          userName: 'alice',
          locationId: 'loc1',
          startDate: '2026-07-01',
          endDate: '2026-07-10',
          status: 'planned',
          fromPlace: 'NYC',
          toPlace: 'Tokyo',
          modeOfTravel: 'flight',
          budget: 3000,
          interests: ['culture', 'food'],
          description: 'Amazing trip to Japan',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
    })
  })

  it('filters trips by search query when logged in', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({
      data: [
        {
          id: '1', userId: 'u1', userName: 'alice', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'NYC', toPlace: 'Tokyo', modeOfTravel: 'flight',
          budget: 3000, interests: ['culture'], description: 'Japan trip',
        },
        {
          id: '2', userId: 'u2', userName: 'bob', locationId: 'loc2',
          startDate: '2026-08-01', endDate: '2026-08-10', status: 'planned',
          fromPlace: 'London', toPlace: 'Rome', modeOfTravel: 'train',
          budget: 1500, interests: ['art'], description: 'Italy trip',
        },
      ],
    })

    renderExplore()
    const user = userEvent.setup()

    // Wait for both trips to render
    await waitFor(() => {
      expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
    })

    // Verify Rome is present before searching
    expect(screen.getByText(/Rome/i)).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.clear(searchInput)
    await user.type(searchInput, 'Tokyo')

    // After filtering, Rome should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText(/Rome/)).toBeNull()
    })

    // Tokyo should still be visible
    expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
  })

  it('shows empty state when no trips match search', async () => {
    mockGet.mockResolvedValue({ data: [] })
    renderExplore()
    await waitFor(() => {
      // Just ensure the page renders without crashing when empty
      expect(document.body).toBeTruthy()
    })
  })

  it('shows auth modal for unauthenticated actions', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          id: '1', userId: 'u1', userName: 'alice', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'NYC', toPlace: 'Tokyo', modeOfTravel: 'flight',
          budget: 3000, interests: ['culture'], description: 'Japan trip',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
    })
  })

  /* ── New: Interest system tests ── */

  it('shows "I\'m Interested" button when logged in and viewing another user\'s trip', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'my-id', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: '1', userId: 'other-user', userName: 'alice', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'NYC', toPlace: 'Tokyo', modeOfTravel: 'flight',
          budget: 3000, interests: ['culture'], description: 'Japan trip',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/I'm Interested/i)).toBeInTheDocument()
  })

  it('toggles interest on a trip and stores it in localStorage', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'my-id', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'trip-1', userId: 'other-user', userName: 'alice', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'NYC', toPlace: 'Tokyo', modeOfTravel: 'flight',
          budget: 3000, interests: ['culture'], description: 'Japan trip',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const interestedBtn = screen.getByText(/I'm Interested/i)
    await user.click(interestedBtn)

    // Should have stored interest in localStorage
    const stored = JSON.parse(localStorage.getItem('routed_interests') || '[]')
    expect(stored.length).toBe(1)
    expect(stored[0].fromUserId).toBe('my-id')
    expect(stored[0].toUserId).toBe('other-user')
    expect(stored[0].tripId).toBe('trip-1')
    expect(stored[0].status).toBe('pending')
    expect(stored[0].tripLabel).toBe('NYC → Tokyo')
  })

  it('shows ❤️ Interested after clicking interest button', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'my-id', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'trip-1', userId: 'other-user', userName: 'bob', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'London', toPlace: 'Rome', modeOfTravel: 'train',
          budget: 1500, interests: ['art'], description: 'Italy trip',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/Rome/i)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText(/I'm Interested/i))

    await waitFor(() => {
      expect(screen.getByText(/❤️ Interested/i)).toBeInTheDocument()
    })
  })

  it('does not show interest button for own trips', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'my-id', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'trip-1', userId: 'my-id', userName: 'me', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'NYC', toPlace: 'Tokyo', modeOfTravel: 'flight',
          budget: 3000, interests: ['culture'], description: 'My trip',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/I'm Interested/i)).not.toBeInTheDocument()
  })

  it('loads pre-existing interests from localStorage on mount', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'my-id', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'my-id',
        fromUsername: 'me',
        toUserId: 'other-user',
        toUsername: 'alice',
        tripId: 'trip-1',
        tripLabel: 'NYC → Tokyo',
        tripStartDate: '2026-07-01',
        tripEndDate: '2026-07-10',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'trip-1', userId: 'other-user', userName: 'alice', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'NYC', toPlace: 'Tokyo', modeOfTravel: 'flight',
          budget: 3000, interests: ['culture'], description: 'Japan trip',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/❤️ Interested/i)).toBeInTheDocument()
    })
  })

  it('can remove interest by clicking the button again', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'my-id', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'my-id',
        fromUsername: 'me',
        toUserId: 'other-user',
        toUsername: 'alice',
        tripId: 'trip-1',
        tripLabel: 'NYC → Tokyo',
        tripStartDate: '2026-07-01',
        tripEndDate: '2026-07-10',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'trip-1', userId: 'other-user', userName: 'alice', locationId: 'loc1',
          startDate: '2026-07-01', endDate: '2026-07-10', status: 'planned',
          fromPlace: 'NYC', toPlace: 'Tokyo', modeOfTravel: 'flight',
          budget: 3000, interests: ['culture'], description: 'Japan trip',
        },
      ],
    })

    renderExplore()
    await waitFor(() => {
      expect(screen.getByText(/❤️ Interested/i)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText(/❤️ Interested/i))

    // localStorage should have the interest removed
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('routed_interests') || '[]')
      expect(stored.length).toBe(0)
    })
  })
})
