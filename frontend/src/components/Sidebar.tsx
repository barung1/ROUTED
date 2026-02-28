import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const Sidebar: React.FC = () => {
  const { pathname } = useLocation()

  const Item: React.FC<{to: string; children: React.ReactNode}> = ({ to, children }) => (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${pathname === to ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
      {children}
    </Link>
  )

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:h-screen md:sticky md:top-0 bg-white border-r border-gray-100 p-4">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 shadow" />
        <span className="font-semibold text-lg">Routed</span>
      </div>

      <nav className="flex-1">
        <div className="space-y-1">
          <Item to="/dashboard">🏠 Dashboard</Item>
          <Item to="/trips">🧳 My trips</Item>
          <Item to="/suggestions">💡 Suggestions</Item>
          <Item to="/matches">🤝 Matches</Item>
        </div>
      </nav>

      <div className="mt-4 text-sm text-gray-500">v0.1.0</div>
    </aside>
  )
}

export default Sidebar
