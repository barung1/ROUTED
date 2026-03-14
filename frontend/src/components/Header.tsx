import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/logo.png'

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false)
  const isLanding = useLocation().pathname === '/'

  useEffect(() => {
    if (!isLanding) {
      setScrolled(true)
      return
    }
    const onScroll = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [isLanding])

  const transparent = isLanding && !scrolled
  return (
    <header
      className={`w-full sticky top-0 z-50 transition-all duration-300 ${
        transparent
          ? 'bg-transparent text-white'
          : 'bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm text-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center h-16 justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Routed home">
            <img src={logo} alt="Routed" className="h-9 md:h-10 w-auto object-contain" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/explore"
              className={`font-medium text-sm transition ${transparent ? 'text-white/90 hover:text-white' : 'text-slate-600 hover:text-primary'}`}
            >
              Explore Trips
            </Link>
            <Link
              to="/login"
              className={`font-medium text-sm transition ${transparent ? 'text-white/90 hover:text-white' : 'text-slate-600 hover:text-primary'}`}
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition hover:scale-[1.02] ${transparent ? 'bg-white text-primary hover:bg-white/95' : 'bg-primary text-white hover:bg-[#1d4ed8]'}`}
            >
              Sign up
            </Link>
          </nav>

          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/explore"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${transparent ? 'bg-white/20 text-white' : 'bg-primary text-white'}`}
            >
              Explore
            </Link>
            <Link
              to="/signup"
              className={`px-3 py-2 font-semibold text-sm ${transparent ? 'text-white' : 'text-primary'}`}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
