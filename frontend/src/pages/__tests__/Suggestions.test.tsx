import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Suggestions from '../Suggestions'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('Suggestions', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('redirects to /dashboard with openTab recs', () => {
    render(
      <MemoryRouter>
        <Suggestions />
      </MemoryRouter>,
    )
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { state: { openTab: 'recs' }, replace: true })
  })
})
