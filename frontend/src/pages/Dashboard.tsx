import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/logo.png'
import api from '../api/client'

/* ── types ── */
interface UserBasic {
  id: string
  username: string
  firstName: string | null
  lastName: string | null
  email: string | null
}

interface TripBasic {
  id: string
  locationId: string
  startDate: string
  endDate: string
  fromPlace: string | null
  toPlace: string | null
  budget: number | null
}

interface LocationBasic {
  id: string
  name: string
}

type MatchStatus =
  | 'pending'
  | 'user_a_accepted'
  | 'user_b_accepted'
  | 'both_accepted'
  | 'rejected'

interface MatchDetail {
  id: string
  status: MatchStatus
  score: number
  matchStart: string
  matchEnd: string
  createdAt: string
  myUserId: string
  myTrip: TripBasic
  otherUser: UserBasic
  otherTrip: TripBasic
  location: LocationBasic
}

/* ── constants ── */
const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD',
  'CAD', 'CHF', 'CNY', 'INR', 'MXN',
  'BRL', 'KRW', 'SGD', 'HKD', 'NOK',
  'SEK', 'DKK', 'NZD', 'ZAR', 'AED',
] as const

const TRAVEL_MODES = [
  'Flight', 'Train', 'Bus', 'Car', 'Ship', 'Bicycle', 'Walking', 'Other',
] as const

const emptyForm = {
  fromPlace: '',
  toPlace: '',
  startDate: '',
  endDate: '',
  travelMode: '',
  budget: '',
  currency: 'USD',
  interests: '',
  description: '',
}

/* ── helpers ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good Morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good Afternoon', emoji: '🌤️' }
  return { text: 'Good Evening', emoji: '🌙' }
}

/* ════════════════════════════════════════════════ */
const Dashboard: React.FC = () => {
  const [profileOpen, setProfileOpen] = useState(false)
  const [tripFormOpen, setTripFormOpen] = useState(false)
  const [tripForm, setTripForm] = useState({ ...emptyForm })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tripFormRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const greeting = getGreeting()
  const [creatingTrip, setCreatingTrip] = useState(false)

  /* ── Recommendations (pending matches from the backend) ── */
  const [recommendations, setRecommendations] = useState<MatchDetail[]>([])
  const [recLoading, setRecLoading] = useState(true)
  const [recActionLoading, setRecActionLoading] = useState<string | null>(null)

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const loadRecommendations = useCallback(async () => {
    setRecLoading(true)
    try {
      const res = await api.get('/matches/me', { params: { limit: 100 } })
      // Only show pending matches as recommendations
      setRecommendations(
        (res.data as MatchDetail[]).filter((m) => m.status === 'pending'),
      )
    } catch {
      setRecommendations([])
    } finally {
      setRecLoading(false)
    }
  }, [])

  useEffect(() => {
    if (localStorage.getItem('routed_token')) loadRecommendations()
    else setRecLoading(false)
  }, [loadRecommendations])

  const handleRecAccept = async (match: MatchDetail) => {
    setRecActionLoading(match.id)
    try {
      try {
        await api.put(`/matches/${match.id}`, { status: 'user_a_accepted' })
      } catch {
        await api.put(`/matches/${match.id}`, { status: 'user_b_accepted' })
      }
      // Remove from recommendations (it moves to the Matches page)
      setRecommendations((prev) => prev.filter((m) => m.id !== match.id))
    } catch { /* ignore */ } finally {
      setRecActionLoading(null)
    }
  }

  const handleRecDecline = async (match: MatchDetail) => {
    setRecActionLoading(match.id)
    try {
      await api.put(`/matches/${match.id}`, { status: 'rejected' })
      setRecommendations((prev) => prev.filter((m) => m.id !== match.id))
    } catch { /* ignore */ } finally {
      setRecActionLoading(null)
    }
  }

  /* auto-open trip form when navigated from Trips page or Explore page */
  useEffect(() => {
    const state = location.state as any
    if (state?.openTripForm) {
      setTripFormOpen(true)

      // If prefillTrip data is passed (from Explore's "Plan a similar trip"), fill the form
      if (state.prefillTrip) {
        const p = state.prefillTrip
        setTripForm({
          fromPlace: p.fromPlace || '',
          toPlace: p.toPlace || '',
          startDate: '',
          endDate: '',
          travelMode: p.travelMode || '',
          budget: p.budget || '',
          currency: 'USD',
          interests: p.interests || '',
          description: p.description || '',
        })
      }

      // clear the state so refreshing won't re-open the form
      window.history.replaceState({}, '')
    }
  }, [location.state])

  /* close dropdowns on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (tripFormRef.current && !tripFormRef.current.contains(e.target as Node)) setTripFormOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('routed_token')
    localStorage.removeItem('routed_shortlisted')
    localStorage.removeItem('routed_my_trips')
  localStorage.removeItem('routed_user')
    navigate('/')
  }

  const handleTripField = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setTripForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleCreateTrip = async () => {
    if (!tripForm.startDate || !tripForm.endDate) {
      alert('Please select a date range.')
      return
    }
    setCreatingTrip(true)
    try {
      const payload = {
        startDate: tripForm.startDate,
        endDate: tripForm.endDate,
        fromPlace: tripForm.fromPlace || null,
        toPlace: tripForm.toPlace || null,
        modeOfTravel: tripForm.travelMode ? tripForm.travelMode.toLowerCase() : null,
        budget: tripForm.budget ? parseFloat(tripForm.budget) : null,
        interests: tripForm.interests ? tripForm.interests.split(',').map((s) => s.trim()).filter(Boolean) : [],
        description: tripForm.description || null,
      }
      const res = await api.post('/trips/', payload)
      console.log('Trip created via API:', res.data)
      // Persist the created trip locally (keep backend response shape)
      const existing = JSON.parse(localStorage.getItem('routed_my_trips') || '[]')
      // Attach username if available from stored user (fallback to backend user id)
      const storedUser = (() => {
        try {
          return JSON.parse(localStorage.getItem('routed_user') || 'null')
        } catch { return null }
      })()
      const tripWithUser = { ...(res.data || {}), username: storedUser?.username || undefined }
      localStorage.setItem('routed_my_trips', JSON.stringify([tripWithUser, ...existing]))
      setTripForm({ ...emptyForm })
      setTripFormOpen(false)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to create trip. Please try again.'
      alert(detail)
      console.error('Create trip error:', err)
    } finally {
      setCreatingTrip(false)
    }
  }

  /* ── render ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">

      {/* ═══════════ HEADER ═══════════ */}
      <header className="w-full sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center h-16 justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="Routed home">
            <img src={logo} alt="Routed logo" className="h-35 w-auto object-contain" />
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/explore"
              className="bg-indigo-600 text-white px-5 py-2 rounded-full shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all text-sm font-semibold tracking-wide"
            >
              Explore Trips
            </Link>

            {/* Profile avatar */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen((p) => !p)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-label="Profile menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50"
                  >
                    <Link to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition rounded-lg mx-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Your Profile
                    </Link>
                    <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition rounded-lg mx-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      Settings
                    </Link>
                    <hr className="my-1.5 border-gray-100" />
                    <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition rounded-lg mx-1 text-left">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN ═══════════ */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">

        {/* ── Greeting banner ── */}
        <motion.div {...fadeUp(0)} className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-8 md:p-10 text-white shadow-xl text-center">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-xl" />
            <p className="text-sm font-medium text-indigo-200 mb-1">{greeting.emoji} {greeting.text}</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome back to Routed</h1>
            {/* <p className="mt-2 text-indigo-100 text-sm md:text-base max-w-lg mx-auto">Plan trips, find travel partners, and explore the world together.</p> */}
          </div>
        </motion.div>

        {/* ── Quick Stats (commented out) ──
        <motion.div {...fadeUp(0.1)} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Planned Trips', value: '0', icon: '🗺️', color: 'from-blue-50 to-blue-100 border-blue-200' },
            { label: 'Matches', value: '0', icon: '🤝', color: 'from-emerald-50 to-emerald-100 border-emerald-200' },
            { label: 'Suggestions', value: '3', icon: '💡', color: 'from-amber-50 to-amber-100 border-amber-200' },
            { label: 'Countries', value: '0', icon: '🌍', color: 'from-purple-50 to-purple-100 border-purple-200' },
          ].map((s, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -2, scale: 1.02 }}
              className={`bg-gradient-to-br ${s.color} border rounded-2xl p-5 flex items-center gap-4 cursor-default`}
            >
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
        */}

        {/* ── Two-column cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ═══ MY TRIPS ═══ */}
          <motion.div
            {...fadeUp(0.2)}
            className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-gray-200/60 p-6 hover:shadow-xl transition-shadow min-h-[28rem]"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">🧳</span>
              My Trips
            </h3>

            <div className="space-y-3">
              {/* ── Add a New Trip ── */}
              <div ref={tripFormRef}>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTripFormOpen((p) => !p)}
                  className="flex items-center gap-4 w-full p-4 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/80 transition-all group text-left"
                >
                  <span className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xl font-bold shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all">+</span>
                  <div>
                    <p className="font-semibold text-gray-900">Add a New Trip</p>
                    <p className="text-xs text-gray-500">Plan your next adventure</p>
                  </div>
                </motion.button>

                {/* ── Trip Form ── */}
                <AnimatePresence>
                  {tripFormOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                      className="mt-3 bg-white rounded-2xl shadow-lg border border-gray-200 p-6"
                    >
                      <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">✈️</span>
                        Create a New Trip
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">From Place</label>
                          <input type="text" name="fromPlace" value={tripForm.fromPlace} onChange={handleTripField} placeholder="e.g. New York"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">To Place</label>
                          <input type="text" name="toPlace" value={tripForm.toPlace} onChange={handleTripField} placeholder="e.g. Paris"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                          <input type="date" name="startDate" value={tripForm.startDate} onChange={handleTripField}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                          <input type="date" name="endDate" value={tripForm.endDate} onChange={handleTripField}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Mode of Travel</label>
                          <select name="travelMode" value={tripForm.travelMode} onChange={handleTripField}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition">
                            <option value="" disabled>Select mode</option>
                            {TRAVEL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Budget</label>
                          <div className="flex gap-2">
                            <select name="currency" value={tripForm.currency} onChange={handleTripField}
                              className="w-24 px-2 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition">
                              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="number" name="budget" value={tripForm.budget} onChange={handleTripField} placeholder="Amount" min="0"
                              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition" />
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Interests</label>
                          <input type="text" name="interests" value={tripForm.interests} onChange={handleTripField} placeholder="e.g. hiking, food, museums"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                          <textarea name="description" value={tripForm.description} onChange={handleTripField} rows={3} placeholder="Tell others about your trip plans…"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition resize-none" />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-5">
                        <button onClick={() => setTripFormOpen(false)}
                          className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleCreateTrip}
                          disabled={creatingTrip}
                          className="px-5 py-2 text-sm rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {creatingTrip ? 'Creating…' : 'Create Trip'}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Your Trips ── */}
              <motion.div whileHover={{ scale: 1.01 }}>
                <Link to="/trips" className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group">
                  <span className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">Your Trips</p>
                    <p className="text-xs text-gray-500">View and manage saved trips</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-auto text-gray-300 group-hover:text-indigo-400 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              </motion.div>

              {/* ── Matched Trips ── */}
              <motion.div whileHover={{ scale: 1.01 }}>
                <Link to="/matches" className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group">
                  <span className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">Matched Trips</p>
                    <p className="text-xs text-gray-500">Trips with compatible partners</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-auto text-gray-300 group-hover:text-indigo-400 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* ═══ RECOMMENDATIONS (pending matches) ═══ */}
          <motion.div
            {...fadeUp(0.3)}
            className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-gray-200/60 p-6 hover:shadow-xl transition-shadow min-h-[28rem] flex flex-col"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg">💡</span>
              Recommendations
              {recommendations.length > 0 && (
                <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  {recommendations.length}
                </span>
              )}
            </h3>

            {recLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <span className="text-4xl mb-3">🤝</span>
                <p className="text-sm font-semibold text-gray-700 mb-1">No pending recommendations</p>
                <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                  When travelers plan trips to the same destination during the same dates as you, they'll show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {recommendations.slice(0, 5).map((match) => {
                  const isActing = recActionLoading === match.id
                  return (
                    <motion.div
                      key={match.id}
                      whileHover={{ scale: 1.01, x: 4 }}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group"
                    >
                      {/* Avatar */}
                      <span className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0">
                        {match.otherUser.username.charAt(0).toUpperCase()}
                      </span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          @{match.otherUser.username}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          📍 {match.location.name} · {fmtDate(match.matchStart)} – {fmtDate(match.matchEnd)}
                        </p>
                        <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                          ⭐ {match.score.toFixed(0)}% match
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          disabled={isActing}
                          onClick={(e) => { e.stopPropagation(); handleRecAccept(match) }}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition disabled:opacity-50"
                          title="Accept — moves to Matched Trips"
                        >
                          {isActing ? '…' : '✓'}
                        </button>
                        <button
                          disabled={isActing}
                          onClick={(e) => { e.stopPropagation(); handleRecDecline(match) }}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50"
                          title="Decline"
                        >
                          {isActing ? '…' : '✗'}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {recommendations.length > 5 && (
              <div className="mt-auto pt-5 text-center">
                <Link to="/suggestions" className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition">
                  View all {recommendations.length} recommendations →
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
