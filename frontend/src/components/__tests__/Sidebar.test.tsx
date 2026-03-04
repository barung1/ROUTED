import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '../Sidebar'

const renderWithRouter = (ui: React.ReactElement, initialRoute = '/') =>
  render(<MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>)

describe('Sidebar', () => {
  it('renders the brand name', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByText('Routed')).toBeInTheDocument()
  })

  it('renders all navigation items', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument()
    expect(screen.getByText(/My trips/)).toBeInTheDocument()
    expect(screen.getByText(/Recommendations/)).toBeInTheDocument()
    expect(screen.getByText(/Matches/)).toBeInTheDocument()
    expect(screen.getByText(/Explore/)).toBeInTheDocument()
  })

  it('navigation links point to correct paths', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByText(/Dashboard/).closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText(/My trips/).closest('a')).toHaveAttribute('href', '/trips')
    expect(screen.getByText(/Recommendations/).closest('a')).toHaveAttribute('href', '/suggestions')
    expect(screen.getByText(/Matches/).closest('a')).toHaveAttribute('href', '/matches')
    expect(screen.getByText(/Explore/).closest('a')).toHaveAttribute('href', '/explore')
  })

  it('renders version number', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByText('v0.1.0')).toBeInTheDocument()
  })

  it('highlights the active route', () => {
    renderWithRouter(<Sidebar />, '/dashboard')
    const dashboardLink = screen.getByText(/Dashboard/).closest('a')
    expect(dashboardLink?.className).toContain('indigo')
  })
})
