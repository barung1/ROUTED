import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock Lottie player to avoid canvas/svg runtime in jsdom
vi.mock('@lottiefiles/react-lottie-player', () => ({
  Player: () => null,
}))

import Landing from '../Landing'
import { BrowserRouter } from 'react-router-dom'

test('renders landing headline and CTA', () => {
  render(
    <BrowserRouter>
      <Landing />
    </BrowserRouter>
  )

  expect(screen.getByText(/Routed — Find the right travel partner/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Get started/i })).toBeInTheDocument()
})
