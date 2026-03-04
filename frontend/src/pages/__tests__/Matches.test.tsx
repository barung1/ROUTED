import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock the API client
const mockGet = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    put: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}))

import Matches from '../Matches'

const renderMatches = () =>
  render(
    <BrowserRouter>
      <Matches />
    </BrowserRouter>
  )

describe('Matches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGet.mockResolvedValue({ data: [] })
  })

  it('renders the page', () => {
    renderMatches()
    expect(screen.getByText(/Matches/i)).toBeInTheDocument()
  })

  it('fetches matches from API when logged in', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({ data: [] })

    renderMatches()
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/matches/me', expect.anything())
    })
  })

  it('displays matched travel partners', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm1',
          status: 'both_accepted',
          score: 85,
          matchStart: '2026-07-01',
          matchEnd: '2026-07-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't1', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'NYC', toPlace: 'Tokyo', budget: 2000 },
          otherUser: { id: 'u2', username: 'jane_doe', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
          otherTrip: { id: 't2', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'LA', toPlace: 'Tokyo', budget: 2500 },
          location: { id: 'l1', name: 'Tokyo' },
        },
      ],
    })

    renderMatches()
    await waitFor(() => {
      expect(screen.getByText(/jane_doe/i)).toBeInTheDocument()
    })
  })

  it('only shows both_accepted matches (not pending or partial)', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm1',
          status: 'pending',
          score: 70,
          matchStart: '2026-07-01',
          matchEnd: '2026-07-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't1', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'NYC', toPlace: 'Tokyo', budget: 2000 },
          otherUser: { id: 'u2', username: 'pending_user', firstName: null, lastName: null, email: null },
          otherTrip: { id: 't2', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'LA', toPlace: 'Tokyo', budget: 2500 },
          location: { id: 'l1', name: 'Tokyo' },
        },
        {
          id: 'm2',
          status: 'user_a_accepted',
          score: 60,
          matchStart: '2026-08-01',
          matchEnd: '2026-08-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't3', locationId: 'l2', startDate: '2026-08-01', endDate: '2026-08-10', fromPlace: 'NYC', toPlace: 'Paris', budget: 3000 },
          otherUser: { id: 'u3', username: 'partial_user', firstName: null, lastName: null, email: null },
          otherTrip: { id: 't4', locationId: 'l2', startDate: '2026-08-01', endDate: '2026-08-10', fromPlace: 'London', toPlace: 'Paris', budget: 2000 },
          location: { id: 'l2', name: 'Paris' },
        },
      ],
    })

    renderMatches()
    await waitFor(() => {
      // Neither pending nor user_a_accepted should show
      expect(screen.queryByText(/pending_user/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/partial_user/i)).not.toBeInTheDocument()
    })
  })

  it('shows empty state when no matches and no interests', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({ data: [] })

    renderMatches()
    await waitFor(() => {
      expect(screen.getByText(/No matched trips yet/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Accept recommendations from your Dashboard or show interest/i)).toBeInTheDocument()
  })

  /* ── New: Interest matches from localStorage ── */

  it('displays accepted interest matches from localStorage', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u2',
        fromUsername: 'alice',
        toUserId: 'u1',
        toUsername: 'me',
        tripId: 't1',
        tripLabel: 'NYC → Tokyo',
        tripStartDate: '2026-07-01',
        tripEndDate: '2026-07-10',
        timestamp: new Date().toISOString(),
        status: 'accepted',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderMatches()
    await waitFor(() => {
      expect(screen.getByText(/Interest Matches/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/@alice/i)).toBeInTheDocument()
    expect(screen.getByText(/NYC → Tokyo/i)).toBeInTheDocument()
  })

  it('shows interest match count badge', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u1',
        fromUsername: 'me',
        toUserId: 'u2',
        toUsername: 'bob',
        tripId: 't1',
        tripLabel: 'LA → Miami',
        tripStartDate: '2026-08-01',
        tripEndDate: '2026-08-10',
        timestamp: new Date().toISOString(),
        status: 'accepted',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderMatches()
    await waitFor(() => {
      expect(screen.getByText(/1 interest match/i)).toBeInTheDocument()
    })
  })

  it('does not show accepted interest matches for other users', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u3',
        fromUsername: 'charlie',
        toUserId: 'u4',
        toUsername: 'dave',
        tripId: 't1',
        tripLabel: 'NYC → Tokyo',
        tripStartDate: '2026-07-01',
        tripEndDate: '2026-07-10',
        timestamp: new Date().toISOString(),
        status: 'accepted',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderMatches()
    await waitFor(() => {
      // Should not show since current user (u1) is neither sender nor receiver
      expect(screen.queryByText(/@charlie/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/@dave/i)).not.toBeInTheDocument()
    })
  })

  it('does not show pending interests in the matches page', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u2',
        fromUsername: 'eve',
        toUserId: 'u1',
        toUsername: 'me',
        tripId: 't1',
        tripLabel: 'London → Paris',
        tripStartDate: '2026-07-01',
        tripEndDate: '2026-07-10',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderMatches()
    await waitFor(() => {
      expect(screen.queryByText(/Interest Matches/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/@eve/i)).not.toBeInTheDocument()
    })
  })
})
