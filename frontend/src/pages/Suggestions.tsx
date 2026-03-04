import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * /suggestions now redirects to the Dashboard with the Recs tab active.
 * All recommendation logic lives in Dashboard.tsx.
 */
const Suggestions: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/dashboard', { state: { openTab: 'recs' }, replace: true })
  }, [navigate])

  return null
}

export default Suggestions
