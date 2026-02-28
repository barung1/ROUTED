import React from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const Header: React.FC = () => {
  return (
  <header className="w-full sticky top-0 z-10 py-3">
      <div className="w-full px-0">
        <div className="flex items-center h-16 justify-between">
          <Link to="/" className="flex items-center gap-3 pl-0" aria-label="Routed home">
            <img src={logo} alt="Routed logo" className="w-60 h-60 object-contain transform translate-y-8 translate-x-140 md:translate-x-10" />
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="text-gray-700">Login</Link>
            <Link to="/signup" className="px-3 py-1.5 bg-indigo-600 text-white rounded-md">Sign up</Link>
          </div>
           {/* Explore Trips fixed button (top-right) */}
            <Link
              to="/explore"
              aria-label="Explore Trips"
              className="fixed top-13 right-20 z-50 bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              Explore Trips
            </Link>
        </div>
      </div>
    </header>
  )
}

export default Header
