import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Header from '../Header'

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>)

describe('Header', () => {
  it('renders the logo with alt text', () => {
    renderWithRouter(<Header />)
    expect(screen.getByAltText('Routed logo')).toBeInTheDocument()
  })

  it('renders Login and Sign up links', () => {
    renderWithRouter(<Header />)
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Sign up')).toBeInTheDocument()
  })

  it('Login link points to /login', () => {
    renderWithRouter(<Header />)
    const loginLink = screen.getByText('Login').closest('a')
    expect(loginLink).toHaveAttribute('href', '/login')
  })

  it('Sign up link points to /signup', () => {
    renderWithRouter(<Header />)
    const signupLink = screen.getByText('Sign up').closest('a')
    expect(signupLink).toHaveAttribute('href', '/signup')
  })

  it('renders the Explore Trips button', () => {
    renderWithRouter(<Header />)
    expect(screen.getByText('Explore Trips')).toBeInTheDocument()
    const exploreLink = screen.getByText('Explore Trips').closest('a')
    expect(exploreLink).toHaveAttribute('href', '/explore')
  })

  it('has a home link on the logo', () => {
    renderWithRouter(<Header />)
    const homeLink = screen.getByLabelText('Routed home')
    expect(homeLink).toHaveAttribute('href', '/')
  })
})
