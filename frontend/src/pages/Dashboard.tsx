import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/logo.png'
import api from '../api/client'
import { PlaceAutocomplete, type PlaceSuggestion } from '../components/PlaceAutocomplete'
import { TripMap } from '../components/TripMap'
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
  interests: string[]
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
  isUserA: boolean
  myTrip: TripBasic
  otherUser: UserBasic
  otherTrip: TripBasic
  location: { id: string; name: string }
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
  fromLat: null as number | null,
  fromLng: null as number | null,
  toLat: null as number | null,
  toLng: null as number | null,
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

  /* ── Interest system (backend API-based) ── */
  const LS_MATCH_MSGS_KEY = 'routed_match_messages'
  const [interestsReceived, setInterestsReceived] = useState<InterestRecord[]>([])
  const [interestsGiven, setInterestsGiven] = useState<InterestRecord[]>([])
  const [interestMessages, setInterestMessages] = useState<InterestRecord[]>([])
  const [matchMessages, setMatchMessages] = useState<MatchMessage[]>([])
  const [interestActionLoading, setInterestActionLoading] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'recs' | 'received' | 'given' | 'messages'>('recs')

  /* ── toast / notification state ── */
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

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
      // Show pending matches + matches where only the OTHER user has accepted (waiting for me)
      setRecommendations(allMatches.filter((m) => {
        if (m.status === 'pending') return true
        // Show as recommendation if the other user accepted but I haven't yet
        if (m.isUserA && m.status === 'user_b_accepted') return true
        if (!m.isUserA && m.status === 'user_a_accepted') return true
        return false
      }))

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
              locationName: m.location?.name || m.myTrip.toPlace || m.otherTrip.toPlace || 'Unknown',
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
              locationName: m.location?.name || m.myTrip.toPlace || m.otherTrip.toPlace || 'Unknown',
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
      const acceptStatus = match.isUserA ? 'user_a_accepted' : 'user_b_accepted'
      const res = await api.put(`/matches/${match.id}`, { status: acceptStatus })
      const updated = res.data as MatchDetail
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
        type: isBothAccepted ? 'both_accepted' : 'rejected',
        matchId: match.id,
        otherUsername: match.otherUser.username,
        locationName: match.location?.name || match.myTrip.toPlace || match.otherTrip.toPlace || 'Unknown',
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
        showToast(`🎉 You and @${match.otherUser.username} are matched!`, 'success')
      } else {
        // Partial accept — waiting for the other user
        showToast(`✓ Accepted! Waiting for @${match.otherUser.username} to accept.`, 'info')
      }
    } catch {
      showToast('Failed to accept recommendation. Please try again.', 'error')
    } finally {
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
        locationName: match.location?.name || match.myTrip.toPlace || match.otherTrip.toPlace || 'Unknown',
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
      showToast('Recommendation declined.', 'info')
    } catch {
      showToast('Failed to decline recommendation. Please try again.', 'error')
    } finally {
      setRecActionLoading(null)
    }
  }

  /* ── Load interests from backend API ── */
  const loadInterests = useCallback(async () => {
    if (!localStorage.getItem('routed_token')) return
    try {
      const [receivedRes, givenRes, messagesRes] = await Promise.all([
        api.get('/interests/received'),
        api.get('/interests/given'),
        api.get('/interests/messages'),
      ])
      setInterestsReceived(receivedRes.data as InterestRecord[])
      setInterestsGiven(givenRes.data as InterestRecord[])
      setInterestMessages(messagesRes.data as InterestRecord[])
    } catch {
      // Silently fail — interests table may not exist yet
    }
  }, [])

  useEffect(() => {
    loadInterests()
  }, [loadInterests])

  /* Re-load interests whenever we navigate back to this page */
  useEffect(() => {
    loadInterests()
  }, [location.pathname, loadInterests])

  /* Auto-select Interest Received tab when there are received interests and no recs */
  useEffect(() => {
    if (interestsReceived.length > 0 && recommendations.length === 0) setRightTab('received')
  }, [interestsReceived.length, recommendations.length])

  /* ── Accept an interest (via backend API) ── */
  const handleAcceptInterest = async (record: InterestRecord) => {
    setInterestActionLoading(record.id)
    try {
      await api.put(`/interests/${record.id}`, { status: 'accepted' })
      showToast(`✅ Interest from @${record.fromUsername} accepted!`, 'success')
      setRightTab('messages')
      await loadInterests()
    } catch {
      showToast('Failed to accept interest. Please try again.', 'error')
    } finally {
      setInterestActionLoading(null)
    }
  }

  /* ── Decline an interest (via backend API) ── */
  const handleDeclineInterest = async (record: InterestRecord) => {
    setInterestActionLoading(record.id)
    try {
      await api.put(`/interests/${record.id}`, { status: 'declined' })
      showToast('Interest declined.', 'info')
      await loadInterests()
    } catch {
      showToast('Failed to decline interest. Please try again.', 'error')
    } finally {
      setInterestActionLoading(null)
    }
  }

  /* ── Dismiss an interest message (via backend API — delete it) ── */
  const handleDismissMessage = async (record: InterestRecord) => {
    try {
      await api.delete(`/interests/${record.id}`)
    } catch {
      // Ignore — might not be the sender
    }
    await loadInterests()
  }

  /* ── Dismiss a match message ── */
  const handleDismissMatchMsg = (msg: MatchMessage) => {
    const all: MatchMessage[] = JSON.parse(localStorage.getItem(LS_MATCH_MSGS_KEY) || '[]')
    const updated = all.filter((m) => m.id !== msg.id)
    localStorage.setItem(LS_MATCH_MSGS_KEY, JSON.stringify(updated))
    setMatchMessages(updated)
  }

  /* Total messages count (interest + match) */
  const totalMessageCount = interestMessages.length + matchMessages.length

  /* auto-open trip form when navigated from Trips page or Explore page */
  useEffect(() => {
    const state = location.state as any
    if (state?.openTripForm) {
      setTripFormOpen(true)

      // If prefillTrip data is passed (from Explore's "Plan a similar trip"), fill the form
      if (state.prefillTrip) {
        const p = state.prefillTrip
        setTripForm({
          ...emptyForm,
          fromPlace: p.fromPlace || '',
          toPlace: p.toPlace || '',
          fromLat: p.fromLat ?? null,
          fromLng: p.fromLng ?? null,
          toLat: p.toLat ?? null,
          toLng: p.toLng ?? null,
          startDate: '',
          endDate: '',
          travelMode: p.travelMode || '',
          budget: p.budget || '',
          interests: p.interests || '',
          description: p.description || '',
        })
      }

      // clear the state so refreshing won't re-open the form
      window.history.replaceState({}, '')
    }

    // Switch to a specific tab when navigated from Suggestions or other pages
    if (state?.openTab) {
      const validTabs = ['recs', 'received', 'given', 'messages'] as const
      if (validTabs.includes(state.openTab)) {
        setRightTab(state.openTab)
      }
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
    const { name, value } = e.target
    setTripForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFromPlaceSelect = (place: PlaceSuggestion | null) => {
    setTripForm((prev) => ({
      ...prev,
      fromPlace: place?.display_name ?? '',
      fromLat: place?.lat ?? null,
      fromLng: place?.lon ?? null,
    }))
  }

  const handleToPlaceSelect = (place: PlaceSuggestion | null) => {
    setTripForm((prev) => ({
      ...prev,
      toPlace: place?.display_name ?? '',
      toLat: place?.lat ?? null,
      toLng: place?.lon ?? null,
    }))
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
        fromLat: tripForm.fromLat ?? null,
        fromLng: tripForm.fromLng ?? null,
        toLat: tripForm.toLat ?? null,
        toLng: tripForm.toLng ?? null,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/50">

      {/* ── Toast notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-brand-500 text-white'
                : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-brand-500 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-brand-500 text-white px-5 py-2 rounded-full shadow-md hover:opacity-90 hover:shadow-lg transition-all text-sm font-semibold tracking-wide"
            >
              Explore Trips
            </Link>

            {/* Profile avatar */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen((p) => !p)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30"
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
                    <Link to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition rounded-lg mx-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Your Profile
                    </Link>
                    <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition rounded-lg mx-1">
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
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-500 to-brand-600 p-8 md:p-10 text-white shadow-xl text-center">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-xl" />
            <p className="text-sm font-medium text-white/90 mb-1">{greeting.emoji} {greeting.text}</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome back to Routed</h1>
            {/* <p className="mt-2 text-indigo-100 text-sm md:text-base max-w-lg mx-auto">Plan trips, find travel partners, and explore the world together.</p> */}
          </div>
        </motion.div>

        {/* ── Quick Stats (commented out) ──
        <motion.div {...fadeUp(0.1)} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Planned Trips', value: '0', icon: '🗺️', color: 'from-blue-50 to-blue-100 border-blue-200' },
            { label: 'Matches', value: '0', icon: '🤝', color: 'from-brand-50 to-brand-100 border-brand-200' },
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
              <span className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center text-lg">🧳</span>
              My Trips
            </h3>

            <div className="space-y-3">
              {/* ── Add a New Trip ── */}
              <div ref={tripFormRef}>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTripFormOpen((p) => !p)}
                  className="flex items-center gap-4 w-full p-4 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/80 hover:bg-brand-100/80 transition-all group text-left"
                >
                  <span className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-xl font-bold shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all">+</span>
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
                        <span className="w-6 h-6 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center text-xs">✈️</span>
                        Create a New Trip
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <PlaceAutocomplete
                          label="From Place"
                          value={tripForm.fromPlace}
                          onChange={handleFromPlaceSelect}
                          placeholder="e.g. New York, Toronto"
                        />
                        <PlaceAutocomplete
                          label="To Place"
                          value={tripForm.toPlace}
                          onChange={handleToPlaceSelect}
                          placeholder="e.g. Paris, Montreal"
                        />
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                          <input type="date" name="startDate" value={tripForm.startDate} onChange={handleTripField}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                          <input type="date" name="endDate" value={tripForm.endDate} onChange={handleTripField}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Mode of Travel</label>
                          <select name="travelMode" value={tripForm.travelMode} onChange={handleTripField}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition">
                            <option value="" disabled>Select mode</option>
                            {TRAVEL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Budget</label>
                          <div className="flex gap-2">
                            <select name="currency" value={tripForm.currency} onChange={handleTripField}
                              className="w-24 px-2 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition">
                              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="number" name="budget" value={tripForm.budget} onChange={handleTripField} placeholder="Amount" min="0"
                              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition" />
                          </div>
                        </div>
                        {tripForm.fromLat != null && tripForm.fromLng != null && tripForm.toLat != null && tripForm.toLng != null && (
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Route Preview</label>
                            <TripMap
                              from={{ lat: tripForm.fromLat, lng: tripForm.fromLng, name: tripForm.fromPlace || 'From' }}
                              to={{ lat: tripForm.toLat, lng: tripForm.toLng, name: tripForm.toPlace || 'To' }}
                              height="200px"
                            />
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Interests</label>
                          <input type="text" name="interests" value={tripForm.interests} onChange={handleTripField} placeholder="e.g. hiking, food, museums"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                          <textarea name="description" value={tripForm.description} onChange={handleTripField} rows={3} placeholder="Tell others about your trip plans…"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition resize-none" />
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
                          className="px-5 py-2 text-sm rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
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
                <Link to="/trips" className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50/40 transition-all group">
                  <span className="w-11 h-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-100 transition shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">Your Trips</p>
                    <p className="text-xs text-gray-500">View and manage saved trips</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-auto text-gray-300 group-hover:text-brand-500 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              </motion.div>

              {/* ── Matched Trips ── */}
              <motion.div whileHover={{ scale: 1.01 }}>
                <Link to="/matches" className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50/40 transition-all group">
                  <span className="w-11 h-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-100 transition shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">Matched Trips</p>
                    <p className="text-xs text-gray-500">Trips with compatible partners</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-auto text-gray-300 group-hover:text-brand-500 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
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
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      rightTab === key ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600'
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
                    <div className="w-7 h-7 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
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
                      const sharedInterests = (match.myTrip.interests || []).filter((i) =>
                        (match.otherTrip.interests || []).includes(i)
                      )
                      const budgetDiff = match.myTrip.budget != null && match.otherTrip.budget != null
                        ? Math.abs(match.myTrip.budget - match.otherTrip.budget)
                        : null
                      return (
                        <motion.div
                          key={match.id}
                          whileHover={{ scale: 1.01, x: 4 }}
                          className="p-4 rounded-2xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50/40 transition-all group"
                        >
                          {/* Row 1: User + score + actions */}
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-500 flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0">
                              {match.otherUser.username.charAt(0).toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">@{match.otherUser.username}</p>
                              <p className="text-[11px] text-gray-500 truncate">
                                📍 {match.location?.name || match.myTrip.toPlace || 'Unknown'} · {fmtDate(match.matchStart)} – {fmtDate(match.matchEnd)}
                              </p>
                            </div>
                            <p className="text-xs text-amber-600 font-bold shrink-0">⭐ {match.score.toFixed(0)}%</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                disabled={isActing}
                                onClick={(e) => { e.stopPropagation(); handleRecAccept(match) }}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-brand-100 text-brand-700 border border-brand-200 hover:bg-brand-200 transition disabled:opacity-50"
                                title="Accept — I'm interested in traveling together"
                              >{isActing ? '…' : '✓ Accept'}</button>
                              <button
                                disabled={isActing}
                                onClick={(e) => { e.stopPropagation(); handleRecDecline(match) }}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50"
                                title="Decline"
                              >{isActing ? '…' : '✗'}</button>
                            </div>
                          </div>
                          {/* Row 2: Match details — why you matched */}
                          <div className="mt-2 ml-[52px] space-y-1">
                            <p className="text-[11px] text-gray-500">
                              <span className="font-medium text-gray-600">Your trip:</span> {match.myTrip.fromPlace || '?'} → {match.myTrip.toPlace || '?'}
                              {match.myTrip.budget != null && <span className="ml-1 text-gray-400">(${match.myTrip.budget})</span>}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              <span className="font-medium text-gray-600">Their trip:</span> {match.otherTrip.fromPlace || '?'} → {match.otherTrip.toPlace || '?'}
                              {match.otherTrip.budget != null && <span className="ml-1 text-gray-400">(${match.otherTrip.budget})</span>}
                            </p>
                            {sharedInterests.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span className="text-[10px] text-gray-400 mr-1">Shared:</span>
                                {sharedInterests.map((tag) => (
                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {budgetDiff != null && budgetDiff === 0 && (
                              <p className="text-[10px] text-brand-600 font-medium">💰 Same budget!</p>
                            )}
                            {budgetDiff != null && budgetDiff > 0 && (
                              <p className="text-[10px] text-gray-400">💰 Budget difference: ${budgetDiff.toFixed(0)}</p>
                            )}
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
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-brand-100 text-brand-700 border border-brand-200 hover:bg-brand-200 transition disabled:opacity-50"
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
                      className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                    >
                      🔍 Explore Trips
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[26rem]">
                    {interestsGiven.map((record) => {
                      const statusStyles = {
                        pending: { label: '⏳ Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
                        accepted: { label: '✅ Accepted', bg: 'bg-brand-50 text-brand-700 border-brand-200' },
                        declined: { label: '❌ Declined', bg: 'bg-red-50 text-red-600 border-red-200' },
                      }
                      const st = statusStyles[record.status]
                      return (
                        <motion.div
                          key={record.id}
                          whileHover={{ scale: 1.01, x: 4 }}
                          className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50/40 transition-all"
                        >
                          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-500 flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0">
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
                              ? 'border-brand-200 bg-brand-50/60'
                              : 'border-orange-200 bg-orange-50/60'
                          }`}
                        >
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0 ${
                            isSuccess
                              ? 'bg-gradient-to-br from-brand-400 to-brand-600'
                              : 'bg-gradient-to-br from-orange-300 to-red-400'
                          }`}>
                            {msg.otherUsername.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            {isSuccess ? (
                              <>
                                <p className="font-semibold text-brand-800 text-sm">🎉 Trip Matched Successfully!</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  You and <span className="font-semibold text-brand-700">@{msg.otherUsername}</span> both accepted the recommendation!
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
                    {interestMessages.map((record) => {
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
                              ? 'border-brand-200 bg-brand-50/60'
                              : 'border-red-100 bg-red-50/50'
                          }`}
                        >
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold shadow-sm shrink-0 ${
                            isAccepted
                              ? 'bg-gradient-to-br from-brand-400 to-brand-600'
                              : 'bg-gradient-to-br from-red-300 to-rose-400'
                          }`}>
                            {otherName.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            {isAccepted ? (
                              <>
                                <p className="font-semibold text-brand-800 text-sm">🎉 Interest Accepted!</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  You've successfully matched with <span className="font-semibold text-brand-700">@{otherName}</span>!
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