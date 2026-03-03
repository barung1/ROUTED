import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'

/* ── types ── */
interface TripItem {
  id: string
  userId: string | null
  username: string | null
  locationId: string
  startDate: string
  endDate: string
  status: string
  fromPlace: string | null
  toPlace: string | null
  modeOfTravel: string | null
  budget: number | null
  interests: string[]
  description: string | null
}

type StatusFilter = 'all' | 'planned' | 'completed' | 'cancelled'

/* ── helpers ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

const tripEmojis = ['✈️', '🚂', '🚗', '🛳️', '🏖️', '🏔️', '🌆', '🗼', '⛩️', '🏝️']
const modeEmoji: Record<string, string> = {
  flight: '✈️', train: '🚂', bus: '🚌', car: '🚗',
  ship: '🛳️', bicycle: '🚲', walking: '🚶', other: '🧳',
}

const STATUS_CONFIG: Record<string, { label: string; emoji: string; bg: string; text: string; ring: string; dot: string }> = {
  planned:   { label: 'Planned',   emoji: '📋', bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-300',    dot: 'bg-blue-500' },
  completed: { label: 'Completed', emoji: '✅', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-300', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', emoji: '❌', bg: 'bg-gray-50',    text: 'text-gray-600',    ring: 'ring-gray-300',    dot: 'bg-gray-400' },
}

/* Seed usernames used as fallback when a trip has no username */
const SEED_USERNAMES = ['anna_lee', 'ben_stone', 'chris_miller', 'diana_wong', 'ethan_kim']

const LS_SHORTLIST_KEY = 'routed_shortlisted'
const LS_INTERESTED_KEY = 'routed_interested'

/* ════════════════════════════════════════════════ */
const Explore: React.FC = () => {
  const [trips, setTrips] = useState<TripItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set())
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  const isLoggedIn = () => !!localStorage.getItem('routed_token')

  const getCurrentUser = () => {
    try { return JSON.parse(localStorage.getItem('routed_user') || 'null') } catch { return null }
  }

  /* ── Auth-gated action helper ── */
  const requireAuth = (action: () => void) => {
    if (!isLoggedIn()) {
      setShowAuthModal(true)
    } else {
      action()
    }
  }

  /* ── Helper: get display username for a trip ── */
  const getDisplayUsername = (trip: TripItem, index: number): string => {
    if (trip.username) return trip.username
    // Deterministic seed fallback based on trip id or index
    return SEED_USERNAMES[index % SEED_USERNAMES.length]
  }

  /* ── Load trips from API ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get('/trips/')
        setTrips(res.data as TripItem[])
      } catch {
        setTrips([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  /* ── Load shortlisted & interested from localStorage ── */
  useEffect(() => {
    const savedShortlist: TripItem[] = JSON.parse(localStorage.getItem(LS_SHORTLIST_KEY) || '[]')
    setShortlistedIds(new Set(savedShortlist.map((t) => t.id)))
    const savedInterested: string[] = JSON.parse(localStorage.getItem(LS_INTERESTED_KEY) || '[]')
    setInterestedIds(new Set(savedInterested))
  }, [])

  /* ── Filter trips by search + status ── */
  let filtered = searchQuery.trim()
    ? trips.filter(
        (t) =>
          (t.fromPlace?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
          (t.toPlace?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
          (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
          t.interests.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : trips

  if (statusFilter !== 'all') {
    filtered = filtered.filter((t) => t.status === statusFilter)
  }

  /* ── Status counts ── */
  const statusCounts = {
    planned: trips.filter((t) => t.status === 'planned').length,
    completed: trips.filter((t) => t.status === 'completed').length,
    cancelled: trips.filter((t) => t.status === 'cancelled').length,
  }

  /* ── Plan similar trip → pre-fill Dashboard form ── */
  const planSimilarTrip = (trip: TripItem) => {
    navigate('/dashboard', {
      state: {
        openTripForm: true,
        prefillTrip: {
          locationId: trip.locationId,
          fromPlace: trip.fromPlace || '',
          toPlace: trip.toPlace || '',
          travelMode: trip.modeOfTravel ? trip.modeOfTravel.charAt(0).toUpperCase() + trip.modeOfTravel.slice(1) : '',
          budget: trip.budget != null ? String(trip.budget) : '',
          interests: trip.interests.join(', '),
          description: trip.description || '',
        },
      },
    })
  }

  /* ── Toggle shortlist (trip-based) ── */
  const toggleShortlist = (trip: TripItem) => {
    const saved: TripItem[] = JSON.parse(localStorage.getItem(LS_SHORTLIST_KEY) || '[]')
    const exists = saved.some((t) => t.id === trip.id)
    let updated: TripItem[]
    if (exists) {
      updated = saved.filter((t) => t.id !== trip.id)
    } else {
      updated = [...saved, trip]
    }
    localStorage.setItem(LS_SHORTLIST_KEY, JSON.stringify(updated))
    setShortlistedIds(new Set(updated.map((t) => t.id)))
  }

  /* ── Toggle interested ── */
  const toggleInterested = (tripId: string) => {
    const saved: string[] = JSON.parse(localStorage.getItem(LS_INTERESTED_KEY) || '[]')
    const exists = saved.includes(tripId)
    let updated: string[]
    if (exists) {
      updated = saved.filter((id) => id !== tripId)
    } else {
      updated = [...saved, tripId]
    }
    localStorage.setItem(LS_INTERESTED_KEY, JSON.stringify(updated))
    setInterestedIds(new Set(updated))
  }

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 relative">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 pt-8 pb-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-white/10 rounded-full blur-2xl" />

        <div className="max-w-6xl mx-auto relative text-center">
          <motion.div {...fadeUp(0)}>
            {isLoggedIn() && (
              <Link to="/dashboard" className="inline-flex items-center gap-2 text-indigo-200 hover:text-white text-sm font-medium mb-4 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Back to Dashboard
              </Link>
            )}
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">🌍 Explore Trips</h1>
            <p className="mt-2 text-indigo-200 text-sm md:text-base max-w-lg mx-auto">
              Discover trips from travelers around the world. Get inspired and plan your next adventure.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Search bar (overlapping hero) ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-8">
        <motion.div {...fadeUp(0.1)} className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/60 p-4 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { if (isLoggedIn()) setSearchQuery(e.target.value); else setShowAuthModal(true) }}
            onFocus={() => { if (!isLoggedIn()) setShowAuthModal(true) }}
            placeholder="Search trips by place, description, or interests…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-gray-400 hover:text-gray-600 transition">
              Clear
            </button>
          )}
          <div className="text-xs text-gray-400 shrink-0">
            {filtered.length} trip{filtered.length !== 1 ? 's' : ''}
          </div>
        </motion.div>
      </div>

      {/* ── Stats bar ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-4">
        <motion.div {...fadeUp(0.15)} className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg">
            ✈️ {trips.length} trip{trips.length !== 1 ? 's' : ''} to explore
          </span>
          <span className="flex-1" />
          {isLoggedIn() && (
            <Link
              to="/trips"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              View My Trips →
            </Link>
          )}
        </motion.div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 pb-28">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div {...fadeUp(0.1)} className="text-center py-20">
            <span className="text-6xl mb-4 block">✈️</span>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No matching trips' : 'No trips to explore yet'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {searchQuery
                ? `Nothing matches "${searchQuery}". Try a different search term.`
                : statusFilter !== 'all'
                ? `No ${statusFilter} trips found. Try a different filter.`
                : 'Trips from other travelers will appear here. Check back soon!'}
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-semibold transition"
              >
                ← Show all trips
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((trip, i) => {
              const modeLabel = trip.modeOfTravel
                ? trip.modeOfTravel.charAt(0).toUpperCase() + trip.modeOfTravel.slice(1)
                : null
              const mIcon = trip.modeOfTravel ? (modeEmoji[trip.modeOfTravel] || '🧳') : null
              const sc = STATUS_CONFIG[trip.status]
              const displayName = getDisplayUsername(trip, i)
              const currentUser = getCurrentUser()
              const isOwnTrip = currentUser && trip.userId === currentUser.id
              const isShortlisted = shortlistedIds.has(trip.id)
              const isInterested = interestedIds.has(trip.id)
              return (
                <motion.div
                  key={trip.id}
                  {...fadeUp(0.04 * Math.min(i, 8))}
                  whileHover={{ y: -4 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-gray-200/60 hover:border-indigo-300 overflow-hidden transition-all group"
                >
                  <div className="h-2 bg-gradient-to-r from-violet-400 to-fuchsia-400" />

                  <div className="p-5">
                    {/* Creator username badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-gray-600">@{displayName}</span>
                    </div>

                    {/* Header row */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-2xl shrink-0 shadow-sm group-hover:shadow-md transition">
                        {tripEmojis[i % tripEmojis.length]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-gray-900 text-base truncate">
                          {trip.fromPlace && trip.toPlace
                            ? `${trip.fromPlace} → ${trip.toPlace}`
                            : trip.toPlace || trip.fromPlace || 'Trip'}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          📅 {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      {/* Status badge — only show when logged in */}
                      {isLoggedIn() && sc && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                      )}
                    </div>

                    {/* Detail chips */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {mIcon && modeLabel && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          {mIcon} {modeLabel}
                        </span>
                      )}
                      {trip.budget != null && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          💰 ${trip.budget.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {trip.description && (
                      <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">{trip.description}</p>
                    )}

                    {trip.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {trip.interests.slice(0, 4).map((tag) => (
                          <span key={tag} className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                        {trip.interests.length > 4 && (
                          <span className="text-[10px] text-gray-400">+{trip.interests.length - 4} more</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                      {/* View More */}
                      <button
                        onClick={() => requireAuth(() => setSelectedTrip(trip))}
                        className="text-xs text-gray-500 hover:text-indigo-600 font-semibold transition"
                      >
                        View More
                      </button>
                      {/* Plan a similar trip — only for completed trips when logged in */}
                      {isLoggedIn() && trip.status === 'completed' && (
                        <>
                          <span className="text-gray-200">|</span>
                          <button
                            onClick={() => planSimilarTrip(trip)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
                          >
                            Plan a similar trip →
                          </button>
                        </>
                      )}
                      <span className="flex-1" />
                      {/* Shortlist button — only when signed in */}
                      {isLoggedIn() && (
                        <button
                          onClick={() => toggleShortlist(trip)}
                          className={`text-lg transition-transform hover:scale-125 ${isShortlisted ? 'drop-shadow-sm' : 'opacity-40 hover:opacity-80'}`}
                          title={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                        >
                          {isShortlisted ? '⭐' : '☆'}
                        </button>
                      )}
                      {/* I'm Interested — only when signed in & NOT own trip */}
                      {isLoggedIn() && !isOwnTrip && (
                        <button
                          onClick={() => toggleInterested(trip.id)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
                            isInterested
                              ? 'bg-pink-100 text-pink-600 border border-pink-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200'
                          }`}
                        >
                          {isInterested ? '❤️ Interested' : '🤍 I\'m Interested'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>

      {/* ═══════ FLOATING STATUS FILTER TAGS — only when logged in ═══════ */}
      <AnimatePresence>
        {isLoggedIn() && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 px-3 py-2.5"
          >
            {/* All trips button */}
            <button
              onClick={() => setStatusFilter('all')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🌍 All
              <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                statusFilter === 'all' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-600'
              }`}>{trips.length}</span>
            </button>

            <div className="w-px h-6 bg-gray-200" />

            {/* Status filter buttons */}
            {(['planned', 'completed', 'cancelled'] as const).map((s) => {
              const cfg = STATUS_CONFIG[s]
              const count = statusCounts[s]
              const active = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(active ? 'all' : s)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all ${
                    active
                      ? `${cfg.bg} ${cfg.text} ring-2 ${cfg.ring} shadow-sm`
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  {cfg.emoji} {cfg.label}
                  <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    active ? `${cfg.bg} ${cfg.text}` : 'bg-gray-200 text-gray-600'
                  }`}>{count}</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ TRIP DETAIL MODAL ═══════ */}
      <AnimatePresence>
        {selectedTrip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedTrip(null)}
            />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full z-10 overflow-hidden"
            >
              {/* Gradient header */}
              <div className="h-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />

              {/* Close button */}
              <button
                onClick={() => setSelectedTrip(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>

              <div className="p-7">
                {/* Trip title */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center text-3xl shadow-sm">
                    {tripEmojis[trips.indexOf(selectedTrip) % tripEmojis.length]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-extrabold text-gray-900 truncate">
                      {selectedTrip.fromPlace && selectedTrip.toPlace
                        ? `${selectedTrip.fromPlace} → ${selectedTrip.toPlace}`
                        : selectedTrip.toPlace || selectedTrip.fromPlace || 'Trip'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {/* Creator badge */}
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[9px] text-white font-bold">
                          {getDisplayUsername(selectedTrip, trips.indexOf(selectedTrip)).charAt(0).toUpperCase()}
                        </span>
                        @{getDisplayUsername(selectedTrip, trips.indexOf(selectedTrip))}
                      </span>
                      {(() => {
                        const sc = STATUS_CONFIG[selectedTrip.status]
                        return sc ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        ) : null
                      })()}
                    </div>
                  </div>
                </div>

                {/* Detail rows */}
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-base">📅</span>
                    <span className="font-medium">
                      {new Date(selectedTrip.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                      {' — '}
                      {new Date(selectedTrip.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {selectedTrip.fromPlace && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">📍</span>
                      <span>From <span className="font-medium">{selectedTrip.fromPlace}</span></span>
                    </div>
                  )}

                  {selectedTrip.toPlace && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">🎯</span>
                      <span>To <span className="font-medium">{selectedTrip.toPlace}</span></span>
                    </div>
                  )}

                  {selectedTrip.modeOfTravel && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">{modeEmoji[selectedTrip.modeOfTravel] || '🧳'}</span>
                      <span className="font-medium">{selectedTrip.modeOfTravel.charAt(0).toUpperCase() + selectedTrip.modeOfTravel.slice(1)}</span>
                    </div>
                  )}

                  {selectedTrip.budget != null && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">💰</span>
                      <span className="font-medium">${selectedTrip.budget.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {selectedTrip.description && (
                  <div className="mb-5">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedTrip.description}</p>
                  </div>
                )}

                {selectedTrip.interests.length > 0 && (
                  <div className="mb-5">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Interests</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTrip.interests.map((tag) => (
                        <span key={tag} className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedTrip(null)}
                    className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition font-medium"
                  >
                    Close
                  </button>
                  {isLoggedIn() && (
                    <button
                      onClick={() => toggleShortlist(selectedTrip)}
                      className={`px-4 py-2.5 text-sm rounded-xl font-medium transition-all ${
                        shortlistedIds.has(selectedTrip.id)
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'border border-gray-200 text-gray-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                      }`}
                    >
                      {shortlistedIds.has(selectedTrip.id) ? '⭐ Shortlisted' : '☆ Shortlist'}
                    </button>
                  )}
                  {isLoggedIn() && !(getCurrentUser() && selectedTrip.userId === getCurrentUser().id) && (
                    <button
                      onClick={() => toggleInterested(selectedTrip.id)}
                      className={`px-4 py-2.5 text-sm rounded-xl font-medium transition-all ${
                        interestedIds.has(selectedTrip.id)
                          ? 'bg-pink-100 text-pink-600 border border-pink-200'
                          : 'border border-gray-200 text-gray-600 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200'
                      }`}
                    >
                      {interestedIds.has(selectedTrip.id) ? '❤️ Interested' : '🤍 I\'m Interested'}
                    </button>
                  )}
                  {selectedTrip.status === 'completed' && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const trip = selectedTrip
                        setSelectedTrip(null)
                        planSimilarTrip(trip)
                      }}
                      className="flex-1 px-5 py-2.5 text-sm rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      ✈️ Plan a Similar Trip
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ AUTH GATE MODAL ═══════ */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowAuthModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center z-10"
            >
              {/* Close button */}
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>

              <span className="text-5xl mb-4 block">🔒</span>
              <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Please Sign In</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Sign in or create an account to explore trip details, filter by status, and plan your own trips.
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  ✨ Sign In
                </Link>
                <Link
                  to="/signup"
                  className="w-full inline-flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 text-indigo-600 px-6 py-3 rounded-2xl font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                >
                  🚀 Create Account
                </Link>
              </div>

              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition"
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Explore
