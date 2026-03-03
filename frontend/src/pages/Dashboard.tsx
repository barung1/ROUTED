import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/logo.png'
import api from '../api/client'
import type { InterestRecord } from './Explore'

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

/** Message stored in localStorage for backend match notifications */
interface MatchMessage {
  id: string
  type: 'both_accepted' | 'rejected'
  matchId: string
  otherUsername: string
  locationName: string
  matchStart: string
  matchEnd: string
  myTripLabel: string
  otherTripLabel: string
  score: number
  timestamp: string
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

  /* ── Interest system (localStorage-based) ── */
  const LS_INTERESTS_KEY = 'routed_interests'
  const LS_MATCH_MSGS_KEY = 'routed_match_messages'
  const [interestsReceived, setInterestsReceived] = useState<InterestRecord[]>([])
  const [interestsGiven, setInterestsGiven] = useState<InterestRecord[]>([])
  const [messages, setMessages] = useState<InterestRecord[]>([])
  const [matchMessages, setMatchMessages] = useState<MatchMessage[]>([])
  const [interestActionLoading, setInterestActionLoading] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'recs' | 'received' | 'given' | 'messages'>('recs')

  const getCurrentUser = () => {
    try { return JSON.parse(localStorage.getItem('routed_user') || 'null') } catch { return null }
  }

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const loadRecommendations = useCallback(async () => {
    setRecLoading(true)
    try {
      const res = await api.get('/matches/me', { params: { limit: 100 } })
      const allMatches = res.data as MatchDetail[]
      // Only show pending matches as recommendations
      setRecommendations(allMatches.filter((m) => m.status === 'pending'))

      // Auto-generate messages for rejected & both_accepted matches
      const user = getCurrentUser()
      if (user) {
        const existing: MatchMessage[] = JSON.parse(localStorage.getItem(LS_MATCH_MSGS_KEY) || '[]')
        const existingIds = new Set(existing.map((m) => m.matchId))
        const newMsgs: MatchMessage[] = []

        for (const m of allMatches) {
          if (existingIds.has(m.id)) continue
          const tripLabel = (t: TripBasic) => {
            if (t.fromPlace && t.toPlace) return `${t.fromPlace} → ${t.toPlace}`
            return t.toPlace || t.fromPlace || 'Trip'
          }
          if (m.status === 'both_accepted') {
            newMsgs.push({
              id: crypto.randomUUID(),
              type: 'both_accepted',
              matchId: m.id,
              otherUsername: m.otherUser.username,
              locationName: m.location.name,
              matchStart: m.matchStart,
              matchEnd: m.matchEnd,
              myTripLabel: tripLabel(m.myTrip),
              otherTripLabel: tripLabel(m.otherTrip),
              score: m.score,
              timestamp: new Date().toISOString(),
            })
          } else if (m.status === 'rejected') {
            newMsgs.push({
              id: crypto.randomUUID(),
              type: 'rejected',
              matchId: m.id,
              otherUsername: m.otherUser.username,
              locationName: m.location.name,
              matchStart: m.matchStart,
              matchEnd: m.matchEnd,
              myTripLabel: tripLabel(m.myTrip),
              otherTripLabel: tripLabel(m.otherTrip),
              score: m.score,
              timestamp: new Date().toISOString(),
            })
          }
        }

        if (newMsgs.length > 0) {
          const updated = [...newMsgs, ...existing]
          localStorage.setItem(LS_MATCH_MSGS_KEY, JSON.stringify(updated))
          setMatchMessages(updated)
        } else {
          setMatchMessages(existing)
        }
      }
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
      let updated: MatchDetail
      try {
        const res = await api.put(`/matches/${match.id}`, { status: 'user_a_accepted' })
        updated = res.data as MatchDetail
      } catch {
        const res = await api.put(`/matches/${match.id}`, { status: 'user_b_accepted' })
        updated = res.data as MatchDetail
      }
      // Remove from recommendations
      setRecommendations((prev) => prev.filter((m) => m.id !== match.id))

      // If the match became both_accepted, create a success message
      const isBothAccepted = updated.status === 'both_accepted'
      const tripLabel = (t: TripBasic) => {
        if (t.fromPlace && t.toPlace) return `${t.fromPlace} → ${t.toPlace}`
        return t.toPlace || t.fromPlace || 'Trip'
      }
      const msg: MatchMessage = {
        id: crypto.randomUUID(),
        type: isBothAccepted ? 'both_accepted' : 'both_accepted', // we'll show as success even for partial
        matchId: match.id,
        otherUsername: match.otherUser.username,
        locationName: match.location.name,
        matchStart: match.matchStart,
        matchEnd: match.matchEnd,
        myTripLabel: tripLabel(match.myTrip),
        otherTripLabel: tripLabel(match.otherTrip),
        score: match.score,
        timestamp: new Date().toISOString(),
      }

      if (isBothAccepted) {
        // Both accepted — add success message and switch to messages tab
        const existing: MatchMessage[] = JSON.parse(localStorage.getItem(LS_MATCH_MSGS_KEY) || '[]')
        const updatedMsgs = [msg, ...existing]
        localStorage.setItem(LS_MATCH_MSGS_KEY, JSON.stringify(updatedMsgs))
        setMatchMessages(updatedMsgs)
        setRightTab('messages')
      }
    } catch { /* ignore */ } finally {
      setRecActionLoading(null)
    }
  }

  const handleRecDecline = async (match: MatchDetail) => {
    setRecActionLoading(match.id)
    try {
      await api.put(`/matches/${match.id}`, { status: 'rejected' })
      setRecommendations((prev) => prev.filter((m) => m.id !== match.id))

      // Store a rejection message so this user sees it
      const tripLabel = (t: TripBasic) => {
        if (t.fromPlace && t.toPlace) return `${t.fromPlace} → ${t.toPlace}`
        return t.toPlace || t.fromPlace || 'Trip'
      }
      const msg: MatchMessage = {
        id: crypto.randomUUID(),
        type: 'rejected',
        matchId: match.id,
        otherUsername: match.otherUser.username,
        locationName: match.location.name,
        matchStart: match.matchStart,
        matchEnd: match.matchEnd,
        myTripLabel: tripLabel(match.myTrip),
        otherTripLabel: tripLabel(match.otherTrip),
        score: match.score,
        timestamp: new Date().toISOString(),
      }
      const existing: MatchMessage[] = JSON.parse(localStorage.getItem(LS_MATCH_MSGS_KEY) || '[]')
      const updatedMsgs = [msg, ...existing]
      localStorage.setItem(LS_MATCH_MSGS_KEY, JSON.stringify(updatedMsgs))
      setMatchMessages(updatedMsgs)
    } catch { /* ignore */ } finally {
      setRecActionLoading(null)
    }
  }

  /* ── Load interests from localStorage ── */
  const loadInterests = useCallback(() => {
    const user = getCurrentUser()
    if (!user) return
    const all: InterestRecord[] = JSON.parse(localStorage.getItem(LS_INTERESTS_KEY) || '[]')
    setInterestsReceived(all.filter((r) => r.toUserId === user.id && r.status === 'pending'))
    setInterestsGiven(all.filter((r) => r.fromUserId === user.id))
    // Messages: accepted interests (both parties see it) + declined interests (sender sees it)
    setMessages([
      ...all.filter((r) => r.status === 'accepted' && (r.fromUserId === user.id || r.toUserId === user.id)),
      ...all.filter((r) => r.status === 'declined' && r.fromUserId === user.id),
    ])
  }, [])

  useEffect(() => {
    loadInterests()
    // Re-check when localStorage changes (other tabs)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_INTERESTS_KEY) loadInterests()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [loadInterests])

  /* Auto-select Interest Received tab when there are received interests and no recs */
  useEffect(() => {
    if (interestsReceived.length > 0 && recommendations.length === 0) setRightTab('received')
  }, [interestsReceived.length, recommendations.length])

  /* ── Accept an interest ── */
  const handleAcceptInterest = (record: InterestRecord) => {
    setInterestActionLoading(record.id)
    const all: InterestRecord[] = JSON.parse(localStorage.getItem(LS_INTERESTS_KEY) || '[]')
    const updated = all.map((r) => r.id === record.id ? { ...r, status: 'accepted' as const } : r)
    localStorage.setItem(LS_INTERESTS_KEY, JSON.stringify(updated))
    loadInterests()
    setInterestActionLoading(null)
    // Switch to Messages tab so the user sees the success notification
    setRightTab('messages')
  }

  /* ── Decline an interest ── */
  const handleDeclineInterest = (record: InterestRecord) => {
    setInterestActionLoading(record.id)
    const all: InterestRecord[] = JSON.parse(localStorage.getItem(LS_INTERESTS_KEY) || '[]')
    const updated = all.map((r) => r.id === record.id ? { ...r, status: 'declined' as const } : r)
    localStorage.setItem(LS_INTERESTS_KEY, JSON.stringify(updated))
    loadInterests()
    setInterestActionLoading(null)
  }

  /* ── Dismiss a declined message ── */
  const handleDismissMessage = (record: InterestRecord) => {
    const all: InterestRecord[] = JSON.parse(localStorage.getItem(LS_INTERESTS_KEY) || '[]')
    const updated = all.filter((r) => r.id !== record.id)
    localStorage.setItem(LS_INTERESTS_KEY, JSON.stringify(updated))
    loadInterests()
  }

  /* ── Dismiss a match message ── */
  const handleDismissMatchMsg = (msg: MatchMessage) => {
    const all: MatchMessage[] = JSON.parse(localStorage.getItem(LS_MATCH_MSGS_KEY) || '[]')
    const updated = all.filter((m) => m.id !== msg.id)
    localStorage.setItem(LS_MATCH_MSGS_KEY, JSON.stringify(updated))
    setMatchMessages(updated)
  }

  /* Total messages count (interest + match) */
  const totalMessageCount = messages.length + matchMessages.length

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
    localStorage.removeItem('routed_match_messages')
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

          {/* ═══ RECOMMENDATIONS & INTERESTS PANEL ═══ */}
          <motion.div
            {...fadeUp(0.3)}
            className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-gray-200/60 p-6 hover:shadow-xl transition-shadow min-h-[28rem] flex flex-col"
          >
            {/* ── Tabs ── */}
            <div className="flex flex-wrap gap-1 mb-5 bg-gray-100 rounded-xl p-1">
              {([
                { key: 'recs' as const, label: '💡 Recs', count: recommendations.length },
                { key: 'received' as const, label: '📥 Received', count: interestsReceived.length },
                { key: 'given' as const, label: '📤 Given', count: interestsGiven.length },
                { key: 'messages' as const, label: '💬 Messages', count: totalMessageCount },
              ]).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setRightTab(key)}
                  className={`flex-1 text-xs font-semibold px-2 py-2 rounded-lg transition-all ${
                    rightTab === key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      rightTab === key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── TAB: Recommendations (backend pending matches) ── */}
            {rightTab === 'recs' && (
              <>
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
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[26rem]">
                    {recommendations.slice(0, 10).map((match) => {
                      const isActing = recActionLoading === match.id
                      return (
                        <motion.div
                          key={match.id}
                          whileHover={{ scale: 1.01, x: 4 }}
                          className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group"
                        >
                          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0">
                            {match.otherUser.username.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">@{match.otherUser.username}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              📍 {match.location.name} · {fmtDate(match.matchStart)} – {fmtDate(match.matchEnd)}
                            </p>
                            <p className="text-[10px] text-amber-600 font-semibold mt-0.5">⭐ {match.score.toFixed(0)}% match</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              disabled={isActing}
                              onClick={(e) => { e.stopPropagation(); handleRecAccept(match) }}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition disabled:opacity-50"
                              title="Accept — moves to Matched Trips"
                            >{isActing ? '…' : '✓'}</button>
                            <button
                              disabled={isActing}
                              onClick={(e) => { e.stopPropagation(); handleRecDecline(match) }}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50"
                              title="Decline"
                            >{isActing ? '…' : '✗'}</button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── TAB: Interest Received (others interested in your trips) ── */}
            {rightTab === 'received' && (
              <>
                {interestsReceived.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-4xl mb-3">📥</span>
                    <p className="text-sm font-semibold text-gray-700 mb-1">No interests received</p>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                      When someone is interested in joining your trip, they'll appear here for you to approve or decline.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[26rem]">
                    {interestsReceived.map((record) => {
                      const isActing = interestActionLoading === record.id
                      return (
                        <motion.div
                          key={record.id}
                          whileHover={{ scale: 1.01, x: 4 }}
                          className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-pink-300 hover:bg-pink-50/40 transition-all"
                        >
                          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0">
                            {record.fromUsername.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">@{record.fromUsername}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              Interested in your trip: <span className="font-medium text-gray-700">{record.tripLabel}</span>
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              🗓️ {fmtDate(record.tripStartDate)} – {fmtDate(record.tripEndDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              disabled={isActing}
                              onClick={(e) => { e.stopPropagation(); handleAcceptInterest(record) }}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition disabled:opacity-50"
                              title="Approve — creates a match"
                            >✓ Approve</button>
                            <button
                              disabled={isActing}
                              onClick={(e) => { e.stopPropagation(); handleDeclineInterest(record) }}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50"
                              title="Decline"
                            >✗ Decline</button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── TAB: Interest Given (your interests on others' trips) ── */}
            {rightTab === 'given' && (
              <>
                {interestsGiven.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-4xl mb-3">📤</span>
                    <p className="text-sm font-semibold text-gray-700 mb-1">No interests sent yet</p>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                      Browse the Explore page and click "I'm Interested" on trips you'd like to join.
                    </p>
                    <Link
                      to="/explore"
                      className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                    >
                      🔍 Explore Trips
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[26rem]">
                    {interestsGiven.map((record) => {
                      const statusStyles = {
                        pending: { label: '⏳ Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
                        accepted: { label: '✅ Accepted', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        declined: { label: '❌ Declined', bg: 'bg-red-50 text-red-600 border-red-200' },
                      }
                      const st = statusStyles[record.status]
                      return (
                        <motion.div
                          key={record.id}
                          whileHover={{ scale: 1.01, x: 4 }}
                          className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all"
                        >
                          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0">
                            {record.toUsername.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">@{record.toUsername}'s trip</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {record.tripLabel}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              🗓️ {fmtDate(record.tripStartDate)} – {fmtDate(record.tripEndDate)}
                            </p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${st.bg}`}>
                            {st.label}
                          </span>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── TAB: Messages (match notifications + interest notifications) ── */}
            {rightTab === 'messages' && (
              <>
                {totalMessageCount === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-4xl mb-3">💬</span>
                    <p className="text-sm font-semibold text-gray-700 mb-1">No messages</p>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                      Match updates will appear here — successful matches, rejections, and interest notifications.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[26rem]">
                    {/* ── Backend match messages ── */}
                    {matchMessages.map((msg) => {
                      const isSuccess = msg.type === 'both_accepted'
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                            isSuccess
                              ? 'border-emerald-200 bg-emerald-50/60'
                              : 'border-orange-200 bg-orange-50/60'
                          }`}
                        >
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0 ${
                            isSuccess
                              ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                              : 'bg-gradient-to-br from-orange-300 to-red-400'
                          }`}>
                            {msg.otherUsername.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            {isSuccess ? (
                              <>
                                <p className="font-semibold text-emerald-800 text-sm">🎉 Trip Matched Successfully!</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  You and <span className="font-semibold text-emerald-700">@{msg.otherUsername}</span> both accepted the recommendation!
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  📍 {msg.locationName} · {msg.myTripLabel}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-orange-800 text-sm">❌ Trip Not Matched</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  The recommendation with <span className="font-medium">@{msg.otherUsername}</span> was rejected.
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  📍 {msg.locationName} · {msg.myTripLabel}
                                </p>
                              </>
                            )}
                            <p className="text-[10px] text-gray-400 mt-1">
                              🗓️ {fmtDate(msg.matchStart)} – {fmtDate(msg.matchEnd)} · ⭐ {msg.score.toFixed(0)}% match
                            </p>
                          </div>
                          <button
                            onClick={() => handleDismissMatchMsg(msg)}
                            className="text-[10px] text-gray-400 hover:text-gray-600 transition shrink-0 mt-1"
                            title="Dismiss"
                          >
                            ✕
                          </button>
                        </motion.div>
                      )
                    })}

                    {/* ── Interest-based messages ── */}
                    {messages.map((record) => {
                      const user = getCurrentUser()
                      const isAccepted = record.status === 'accepted'
                      const otherName = record.fromUserId === user?.id ? record.toUsername : record.fromUsername
                      return (
                        <motion.div
                          key={record.id + record.status}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                            isAccepted
                              ? 'border-emerald-200 bg-emerald-50/60'
                              : 'border-red-100 bg-red-50/50'
                          }`}
                        >
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0 ${
                            isAccepted
                              ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                              : 'bg-gradient-to-br from-red-300 to-rose-400'
                          }`}>
                            {otherName.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            {isAccepted ? (
                              <>
                                <p className="font-semibold text-emerald-800 text-sm">🎉 Interest Accepted!</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  You've successfully matched with <span className="font-semibold text-emerald-700">@{otherName}</span>!
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  Trip: <span className="font-medium">{record.tripLabel}</span>
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-gray-900 text-sm">Interest Declined</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  <span className="font-medium">@{record.toUsername}</span> declined your interest on their trip{' '}
                                  <span className="font-medium">{record.tripLabel}</span>.
                                </p>
                              </>
                            )}
                            <p className="text-[10px] text-gray-400 mt-1">
                              🗓️ {fmtDate(record.tripStartDate)} – {fmtDate(record.tripEndDate)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDismissMessage(record)}
                            className="text-[10px] text-gray-400 hover:text-gray-600 transition shrink-0 mt-1"
                            title="Dismiss"
                          >
                            ✕
                          </button>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard