import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'

/* ── Types mirroring MatchDetailModel from the backend ── */
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

/* ── Helpers ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const overlapDays = (start: string, end: string) => {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

const STATUS_UI: Record<
  string,
  { label: string; emoji: string; bg: string; text: string }
> = {
  user_a_accepted:  { label: 'You Accepted',  emoji: '👍', bg: 'bg-blue-50',    text: 'text-blue-700' },
  user_b_accepted:  { label: 'They Accepted', emoji: '👋', bg: 'bg-cyan-50',    text: 'text-cyan-700' },
  both_accepted:    { label: 'Matched!',      emoji: '🎉', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

const scoreColor = (score: number) => {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
}

const ACCEPTED_STATUSES: MatchStatus[] = ['user_a_accepted', 'user_b_accepted', 'both_accepted']

/* ════════════════════════════════════════════════ */
const Matches: React.FC = () => {
  const [matches, setMatches] = useState<MatchDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<MatchDetail | null>(null)

  const isLoggedIn = () => !!localStorage.getItem('routed_token')

  /* ── Fetch only accepted matches ── */
  const loadMatches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/matches/me', { params: { limit: 100 } })
      // Only keep matches that the user has accepted
      setMatches(
        (res.data as MatchDetail[]).filter((m) => ACCEPTED_STATUSES.includes(m.status)),
      )
    } catch {
      setMatches([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn()) loadMatches()
    else setLoading(false)
  }, [loadMatches])

  /* ═══════════════ RENDER ═══════════════ */

  /* Not logged in → prompt */
  if (!isLoggedIn()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center px-4">
        <motion.div {...fadeUp()} className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Sign In to View Matches</h2>
          <p className="text-gray-500 text-sm mb-6">
            Log in to see travelers you've matched with.
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
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 relative">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 pt-8 pb-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-white/10 rounded-full blur-2xl" />

        <div className="max-w-6xl mx-auto relative text-center">
          <motion.div {...fadeUp(0)}>
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-indigo-200 hover:text-white text-sm font-medium mb-4 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              Back to Dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">🤝 Matched Trips</h1>
            <p className="mt-2 text-indigo-200 text-sm md:text-base max-w-lg mx-auto">
              Travelers you've accepted — connect and travel together!
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-8">
        <motion.div {...fadeUp(0.1)} className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/60 p-4 flex items-center gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg">
            🤝 {matches.length} matched trip{matches.length !== 1 ? 's' : ''}
          </span>
          <span className="flex-1" />
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition">
            💡 View Recommendations on Dashboard →
          </Link>
        </motion.div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <motion.div {...fadeUp(0.1)} className="text-center py-20">
            <span className="text-6xl mb-4 block">🤝</span>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No matched trips yet</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Accept recommendations from your Dashboard to see matched travelers here.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-md hover:shadow-lg transition-all"
            >
              💡 Go to Dashboard
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {matches.map((match, i) => {
              const ui = STATUS_UI[match.status] || STATUS_UI.both_accepted
              const days = overlapDays(match.matchStart, match.matchEnd)
              return (
                <motion.div
                  key={match.id}
                  {...fadeUp(0.04 * Math.min(i, 8))}
                  whileHover={{ y: -4 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-gray-200/60 hover:border-indigo-300 overflow-hidden transition-all group"
                >
                  <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-400" />

                  <div className="p-5">
                    {/* Other user badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-sm text-white font-bold shadow-sm">
                        {match.otherUser.username.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-800 block truncate">
                          @{match.otherUser.username}
                        </span>
                        {(match.otherUser.firstName || match.otherUser.lastName) && (
                          <span className="text-[11px] text-gray-400 truncate block">
                            {[match.otherUser.firstName, match.otherUser.lastName].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </div>
                      <span className="flex-1" />
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${ui.bg} ${ui.text}`}>
                        {ui.emoji} {ui.label}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">📍</span>
                      <span className="text-sm font-semibold text-gray-900">{match.location.name}</span>
                    </div>

                    {/* Overlap dates */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">📅</span>
                      <span className="text-xs text-gray-600">
                        {fmtDate(match.matchStart)} – {fmtDate(match.matchEnd)}
                        <span className="ml-1 text-gray-400">({days} day{days !== 1 ? 's' : ''} overlap)</span>
                      </span>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">⭐</span>
                      <span className={`text-sm font-bold ${scoreColor(match.score)}`}>
                        {match.score.toFixed(0)}% compatibility
                      </span>
                    </div>

                    {/* Trip route chips */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {match.otherTrip.fromPlace && match.otherTrip.toPlace && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          ✈️ {match.otherTrip.fromPlace} → {match.otherTrip.toPlace}
                        </span>
                      )}
                      {match.otherTrip.budget != null && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          💰 ${match.otherTrip.budget.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* View details */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => setSelectedMatch(match)}
                        className="text-xs text-gray-500 hover:text-indigo-600 font-semibold transition"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>

      {/* ═══════ MATCH DETAIL MODAL ═══════ */}
      <AnimatePresence>
        {selectedMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedMatch(null)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full z-10 overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

              <button
                onClick={() => setSelectedMatch(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              </button>

              <div className="p-7">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-2xl text-white font-bold shadow-sm">
                    {selectedMatch.otherUser.username.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-extrabold text-gray-900 truncate">
                      @{selectedMatch.otherUser.username}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {(selectedMatch.otherUser.firstName || selectedMatch.otherUser.lastName) && (
                        <span className="text-xs text-gray-500">
                          {[selectedMatch.otherUser.firstName, selectedMatch.otherUser.lastName].filter(Boolean).join(' ')}
                        </span>
                      )}
                      {(() => {
                        const ui = STATUS_UI[selectedMatch.status] || STATUS_UI.both_accepted
                        return (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${ui.bg} ${ui.text}`}>
                            {ui.emoji} {ui.label}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-base">📍</span>
                    <span className="font-medium">{selectedMatch.location.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-base">📅</span>
                    <span className="font-medium">
                      Overlap: {fmtDate(selectedMatch.matchStart)} – {fmtDate(selectedMatch.matchEnd)}
                      <span className="text-gray-400 ml-1">
                        ({overlapDays(selectedMatch.matchStart, selectedMatch.matchEnd)} days)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-base">⭐</span>
                    <span className={`font-bold ${scoreColor(selectedMatch.score)}`}>
                      {selectedMatch.score.toFixed(1)}% compatibility score
                    </span>
                  </div>
                </div>

                {/* Trip comparison */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="rounded-xl bg-indigo-50 p-3">
                    <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Your Trip</h4>
                    {selectedMatch.myTrip.fromPlace && (
                      <p className="text-xs text-gray-700">📍 From: {selectedMatch.myTrip.fromPlace}</p>
                    )}
                    {selectedMatch.myTrip.toPlace && (
                      <p className="text-xs text-gray-700 mt-1">🎯 To: {selectedMatch.myTrip.toPlace}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {fmtDate(selectedMatch.myTrip.startDate)} – {fmtDate(selectedMatch.myTrip.endDate)}
                    </p>
                    {selectedMatch.myTrip.budget != null && (
                      <p className="text-xs text-gray-500 mt-1">💰 ${selectedMatch.myTrip.budget.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-violet-50 p-3">
                    <h4 className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">Their Trip</h4>
                    {selectedMatch.otherTrip.fromPlace && (
                      <p className="text-xs text-gray-700">📍 From: {selectedMatch.otherTrip.fromPlace}</p>
                    )}
                    {selectedMatch.otherTrip.toPlace && (
                      <p className="text-xs text-gray-700 mt-1">🎯 To: {selectedMatch.otherTrip.toPlace}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {fmtDate(selectedMatch.otherTrip.startDate)} – {fmtDate(selectedMatch.otherTrip.endDate)}
                    </p>
                    {selectedMatch.otherTrip.budget != null && (
                      <p className="text-xs text-gray-500 mt-1">💰 ${selectedMatch.otherTrip.budget.toLocaleString()}</p>
                    )}
                  </div>
                </div>

                {/* Close */}
                <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedMatch(null)}
                    className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Matches