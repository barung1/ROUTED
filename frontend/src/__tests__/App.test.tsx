import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock Lottie player
vi.mock('@lottiefiles/react-lottie-player', () => ({
  Player: () => null,
}))

// Mock the API client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    put: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}))

import App from '../App'

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders without crashing', () => {
    render(<App />)
    expect(document.body).toBeTruthy()
  })

  it('renders the sidebar', () => {
    render(<App />)
    expect(screen.getByText('Routed')).toBeInTheDocument()
  })

  it('renders the landing page at root route', () => {
    render(<App />)
    // Landing page contains the headline
    expect(screen.getByText(/shared paths/i)).toBeInTheDocument()
  })
})
