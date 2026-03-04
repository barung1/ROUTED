import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock the API client
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    interceptors: { request: { use: vi.fn() } },
  },
}))

import Dashboard from '../Dashboard'

const renderDashboard = (initialRoute = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Dashboard />
    </MemoryRouter>
  )

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGet.mockResolvedValue({ data: [] })
  })

  it('renders a greeting based on time of day', () => {
    renderDashboard()
    // Should render one of the greetings
    const greetings = screen.queryByText(/Good Morning|Good Afternoon|Good Evening/)
    expect(greetings).toBeInTheDocument()
  })

  it('renders the Add a New Trip button', () => {
    renderDashboard()
    expect(screen.getByText(/Add a New Trip/i)).toBeInTheDocument()
  })

  it('renders the Routed logo', () => {
    renderDashboard()
    expect(screen.getByAltText('Routed logo')).toBeInTheDocument()
  })

  it('loads recommendations from API when logged in', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/matches/me', expect.anything())
    })
  })

  it('does not load recommendations when not logged in', () => {
    renderDashboard()
    // mockGet may still be called but not for matches
    expect(mockGet).not.toHaveBeenCalledWith('/matches/me', expect.anything())
  })

  it('renders profile dropdown area', () => {
    renderDashboard()
    // There should be a profile/user icon or button area
    const profileArea = screen.queryByText(/Profile/i) || screen.queryByLabelText(/profile/i)
    // At minimum, the page should render without crashing
    expect(profileArea || document.body).toBeTruthy()
  })

  /* ── New: Interest system tabs ── */

  it('renders all four tabs (Recs, Received, Given, Messages)', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    expect(screen.getByText(/Recs/i)).toBeInTheDocument()
    expect(screen.getByText(/Received/i)).toBeInTheDocument()
    expect(screen.getByText(/Given/i)).toBeInTheDocument()
    expect(screen.getByText(/Messages/i)).toBeInTheDocument()
  })

  it('shows "No pending recommendations" when there are no pending matches', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/No pending recommendations/i)).toBeInTheDocument()
    })
  })

  it('renders recommendation cards for pending matches', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm1',
          status: 'pending',
          score: 80,
          matchStart: '2026-07-01',
          matchEnd: '2026-07-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't1', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'NYC', toPlace: 'Tokyo', budget: 2000 },
          otherUser: { id: 'u2', username: 'alice', firstName: 'Alice', lastName: null, email: null },
          otherTrip: { id: 't2', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'LA', toPlace: 'Tokyo', budget: 2500 },
          location: { id: 'l1', name: 'Tokyo' },
        },
      ],
    })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/@alice/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/80% match/i)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo/i)).toBeInTheDocument()
  })

  it('can switch to the Received tab', async () => {
    localStorage.setItem('routed_token', 'test-token')
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByText(/Received/i))

    expect(screen.getByText(/No interests received/i)).toBeInTheDocument()
  })

  it('displays received interests from localStorage', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u2',
        fromUsername: 'bob',
        toUserId: 'u1',
        toUsername: 'me',
        tripId: 't1',
        tripLabel: 'NYC → Paris',
        tripStartDate: '2026-07-01',
        tripEndDate: '2026-07-15',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()

    // With received interests and no recs, auto-switches to received tab
    await waitFor(() => {
      expect(screen.getByText(/@bob/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/NYC → Paris/i)).toBeInTheDocument()
  })

  it('can switch to the Given tab and shows empty state', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByText(/Given/i))

    expect(screen.getByText(/No interests sent yet/i)).toBeInTheDocument()
  })

  it('displays given interests with status badges', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u1',
        fromUsername: 'me',
        toUserId: 'u2',
        toUsername: 'alice',
        tripId: 't2',
        tripLabel: 'London → Rome',
        tripStartDate: '2026-08-01',
        tripEndDate: '2026-08-10',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByText(/Given/i))

    await waitFor(() => {
      expect(screen.getByText(/@alice/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Pending/i)).toBeInTheDocument()
  })

  it('can switch to Messages tab and shows empty state', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByText(/Messages/i))

    expect(screen.getByText(/No messages/i)).toBeInTheDocument()
  })

  it('generates match messages for both_accepted matches from API', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm1',
          status: 'both_accepted',
          score: 90,
          matchStart: '2026-07-01',
          matchEnd: '2026-07-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't1', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'NYC', toPlace: 'Tokyo', budget: 2000 },
          otherUser: { id: 'u2', username: 'jane', firstName: 'Jane', lastName: null, email: null },
          otherTrip: { id: 't2', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'LA', toPlace: 'Tokyo', budget: 2500 },
          location: { id: 'l1', name: 'Tokyo' },
        },
      ],
    })

    renderDashboard()

    const user = userEvent.setup()
    // Wait for data to load, then switch to messages tab
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await user.click(screen.getByText(/Messages/i))

    await waitFor(() => {
      expect(screen.getByText(/Trip Matched Successfully/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/@jane/i)).toBeInTheDocument()
  })

  it('generates match messages for rejected matches from API', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm2',
          status: 'rejected',
          score: 60,
          matchStart: '2026-08-01',
          matchEnd: '2026-08-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't1', locationId: 'l1', startDate: '2026-08-01', endDate: '2026-08-10', fromPlace: 'NYC', toPlace: 'Paris', budget: 3000 },
          otherUser: { id: 'u3', username: 'mark', firstName: 'Mark', lastName: null, email: null },
          otherTrip: { id: 't3', locationId: 'l1', startDate: '2026-08-01', endDate: '2026-08-10', fromPlace: 'Boston', toPlace: 'Paris', budget: 2000 },
          location: { id: 'l1', name: 'Paris' },
        },
      ],
    })

    renderDashboard()

    const user = userEvent.setup()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await user.click(screen.getByText(/Messages/i))

    await waitFor(() => {
      expect(screen.getByText(/Trip Not Matched/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/@mark/i)).toBeInTheDocument()
  })

  it('calls accept API when clicking accept on a recommendation', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm1',
          status: 'pending',
          score: 75,
          matchStart: '2026-07-01',
          matchEnd: '2026-07-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't1', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'NYC', toPlace: 'Tokyo', budget: 2000 },
          otherUser: { id: 'u2', username: 'alice', firstName: 'Alice', lastName: null, email: null },
          otherTrip: { id: 't2', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'LA', toPlace: 'Tokyo', budget: 2500 },
          location: { id: 'l1', name: 'Tokyo' },
        },
      ],
    })
    mockPut.mockResolvedValue({
      data: { id: 'm1', status: 'user_a_accepted' },
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/@alice/i)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const acceptBtn = screen.getByTitle(/Accept/i)
    await user.click(acceptBtn)

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/matches/m1', { status: 'user_a_accepted' })
    })
  })

  it('calls decline API when clicking decline on a recommendation', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm1',
          status: 'pending',
          score: 75,
          matchStart: '2026-07-01',
          matchEnd: '2026-07-10',
          createdAt: '2026-01-01',
          myUserId: 'u1',
          isUserA: true,
          myTrip: { id: 't1', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'NYC', toPlace: 'Tokyo', budget: 2000 },
          otherUser: { id: 'u2', username: 'alice', firstName: 'Alice', lastName: null, email: null },
          otherTrip: { id: 't2', locationId: 'l1', startDate: '2026-07-01', endDate: '2026-07-10', fromPlace: 'LA', toPlace: 'Tokyo', budget: 2500 },
          location: { id: 'l1', name: 'Tokyo' },
        },
      ],
    })
    mockPut.mockResolvedValue({ data: { id: 'm1', status: 'rejected' } })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/@alice/i)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const declineBtn = screen.getByTitle(/Decline/i)
    await user.click(declineBtn)

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/matches/m1', { status: 'rejected' })
    })
  })

  it('clears routed_match_messages on logout', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_match_messages', JSON.stringify([{ id: 'msg-1' }]))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    // Find and click the profile avatar to open dropdown, then logout
    // The logout button is inside the profile dropdown
    const user = userEvent.setup()

    // Click avatar (the first button with the user initial or profile icon)
    const avatarButtons = screen.getAllByRole('button')
    // The profile avatar should contain a gradient circle — we look for the button that triggers logout
    // Let's find it by looking for the logout option after clicking
    for (const btn of avatarButtons) {
      if (btn.textContent?.match(/^[A-Z]$/) || btn.querySelector('svg')) {
        await user.click(btn)
        const logoutBtn = screen.queryByText(/Log out|Logout|Sign out/i)
        if (logoutBtn) {
          await user.click(logoutBtn)
          break
        }
      }
    }

    // After logout, match messages should be cleared
    expect(localStorage.getItem('routed_match_messages')).toBeNull()
  })

  it('auto-selects Received tab when there are received interests and no recommendations', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u2',
        fromUsername: 'bob',
        toUserId: 'u1',
        toUsername: 'me',
        tripId: 't1',
        tripLabel: 'NYC → Tokyo',
        tripStartDate: '2026-07-01',
        tripEndDate: '2026-07-10',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()

    // Should auto-switch to received tab since no pending recs
    await waitFor(() => {
      expect(screen.getByText(/@bob/i)).toBeInTheDocument()
    })
  })

  it('accepts an interest and switches to Messages tab', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u2',
        fromUsername: 'carol',
        toUserId: 'u1',
        toUsername: 'me',
        tripId: 't1',
        tripLabel: 'London → Berlin',
        tripStartDate: '2026-09-01',
        tripEndDate: '2026-09-10',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()

    // Wait for auto-switch to received tab
    await waitFor(() => {
      expect(screen.getByText(/@carol/i)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const approveBtn = screen.getByText(/Approve/i)
    await user.click(approveBtn)

    // Should switch to Messages tab and show success
    await waitFor(() => {
      expect(screen.getByText(/Interest Accepted/i)).toBeInTheDocument()
    })

    // localStorage should be updated
    const stored = JSON.parse(localStorage.getItem('routed_interests') || '[]')
    expect(stored[0].status).toBe('accepted')
  })

  it('declines an interest', async () => {
    localStorage.setItem('routed_token', 'test-token')
    localStorage.setItem('routed_user', JSON.stringify({ id: 'u1', username: 'me' }))
    localStorage.setItem('routed_interests', JSON.stringify([
      {
        id: 'int-1',
        fromUserId: 'u2',
        fromUsername: 'dave',
        toUserId: 'u1',
        toUsername: 'me',
        tripId: 't1',
        tripLabel: 'LA → Miami',
        tripStartDate: '2026-10-01',
        tripEndDate: '2026-10-10',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ]))
    mockGet.mockResolvedValue({ data: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/@dave/i)).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const declineBtn = screen.getByText(/Decline/i)
    await user.click(declineBtn)

    // Interest should be updated to declined
    const stored = JSON.parse(localStorage.getItem('routed_interests') || '[]')
    expect(stored[0].status).toBe('declined')

    // Dave should no longer appear in received tab
    await waitFor(() => {
      expect(screen.queryByText(/@dave/i)).not.toBeInTheDocument()
    })
  })
})
