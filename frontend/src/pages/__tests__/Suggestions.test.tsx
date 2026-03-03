import { render, screen } from '@testing-library/react'
import Suggestions from '../Suggestions'

describe('Suggestions', () => {
  it('renders the heading', () => {
    render(<Suggestions />)
    expect(screen.getByText('Suggestions')).toBeInTheDocument()
  })

  it('renders the description text', () => {
    render(<Suggestions />)
    expect(screen.getByText('Suggested travel partners and trips.')).toBeInTheDocument()
  })
})
