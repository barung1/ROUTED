import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock Lottie player to avoid canvas/svg runtime in jsdom
vi.mock('@lottiefiles/react-lottie-player', () => ({
  Player: () => null,
}))

import Landing from '../Landing'
import { BrowserRouter } from 'react-router-dom'

describe('Landing', () => {
  it('renders landing headline', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )
    expect(screen.getByText(/shared paths become/i)).toBeInTheDocument()
  })

  it('renders Login and Sign up action links', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )
    const loginLinks = screen.getAllByText(/Login/i)
    expect(loginLinks.length).toBeGreaterThanOrEqual(1)
    const signupLinks = screen.getAllByText(/Sign up/i)
    expect(signupLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the features carousel section', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )
    expect(screen.getByText(/Why Choose Routed/i)).toBeInTheDocument()
  })

  it('renders the first feature card', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )
    // The carousel shows the first card by default
    expect(screen.getByText(/Smart Compatibility/i)).toBeInTheDocument()
  })

  it('renders carousel navigation', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )
    expect(screen.getByLabelText(/Previous slide/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Next slide/i)).toBeInTheDocument()
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })
})
