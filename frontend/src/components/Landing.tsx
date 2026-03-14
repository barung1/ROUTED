import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PlaceAutocomplete } from './PlaceAutocomplete'
import { LandingMap } from './LandingMap'
import './landing.css'
import logo from '../assets/logo.png'
import TCP from '../assets/TCP.png'
import SCP from '../assets/SCP.png'
import SIM from '../assets/SIM.png'
import CDM from '../assets/CDM.png'

const Landing: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<{ display_name: string } | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [startX, setStartX] = useState(0)
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim() || (selectedPlace?.display_name ?? '')
    if (q) {
      navigate(`/explore?q=${encodeURIComponent(q)}`)
    } else {
      navigate('/explore')
    }
  }

  const handlePlaceChange = (place: { display_name: string } | null) => {
    setSelectedPlace(place)
    setSearchQuery(place?.display_name ?? '')
  }
  const handleQueryChange = (q: string) => setSearchQuery(q)

  const features = [
    { icon: SCP, title: 'Smart Compatibility', desc: 'AI-powered matching based on travel preferences, interests, and budget.' },
    { icon: TCP, title: 'Trip-Centric Planning', desc: 'Focus on real trips with structured itineraries. Plan together, share costs.' },
    { icon: CDM, title: 'Consent-Driven Matching', desc: 'Both travelers must agree before connecting. Privacy first, always.' },
    { icon: SIM, title: 'Safety First', desc: 'Secure auth, verified profiles, and community guidelines for safe journeys.' },
  ]

  const steps = [
    { num: '1', title: 'Plan your trip', desc: 'Add your route, dates, and interests. We’ll surface compatible travel partners.' },
    { num: '2', title: 'Get matched', desc: 'See travelers heading the same way. Accept matches and start chatting.' },
    { num: '3', title: 'Meet & travel', desc: 'Coordinate at a public spot, share costs, and create memories together.' },
  ]

  const lifestyleCards = [
    { emoji: '🤝', title: 'Connect', desc: 'Meet fellow travelers who share your route. Real connections, no guesswork.' },
    { emoji: '🧳', title: 'Travel', desc: 'Split costs, share experiences. Same destination, half the hassle.' },
    { emoji: '🌍', title: 'Explore', desc: '190+ countries. From Tokyo to Reykjavik — find your next adventure.' },
    { emoji: '🔒', title: 'Trust', desc: 'Verified profiles, consent-driven matching. Safe and transparent.' },
  ]

  const handlePrevious = () => setCurrentSlide((prev) => (prev === 0 ? features.length - 1 : prev - 1))
  const handleNext = () => setCurrentSlide((prev) => (prev === features.length - 1 ? 0 : prev + 1))
  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX)
  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX
    if (startX - endX > 50) handleNext()
    else if (endX - startX > 50) handlePrevious()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#0B1220] landing-page">
      {/* Large logo — top left with glow */}
      <Link
        to="/"
        className="fixed top-6 left-6 md:top-8 md:left-8 z-50 flex items-center"
        aria-label="Routed home"
      >
        <img
          src={logo}
          alt="Routed"
          className="h-20 md:h-28 w-auto object-contain landing-logo-glow"
        />
      </Link>

      {/* Explore trips + Sign in — top right */}
      <div className="fixed top-6 right-6 md:top-8 md:right-8 z-50 flex items-center gap-3">
        <Link
          to="/explore"
          className="px-4 py-2.5 text-white font-semibold rounded-xl hover:bg-white/15 transition text-sm"
        >
          Explore trips
        </Link>
        <Link
          to="/login"
          className="px-5 py-2.5 bg-white text-primary font-bold rounded-xl hover:scale-[1.02] hover:bg-white/95 transition text-sm shadow-lg"
        >
          Sign in
        </Link>
      </div>

      {/* Hero — full viewport, royal blue gradient, floating cards */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden hero-section">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#1e40af]" />
        <div className="absolute inset-0 hero-shapes" aria-hidden="true" />

        {/* Floating image cards */}
        <div className="absolute top-[18%] left-[8%] w-24 h-24 md:w-32 md:h-32 opacity-90 landing-float" style={{ animationDelay: '0s' }}>
          <div className="landing-card-floating rounded-2xl overflow-hidden shadow-xl">
            <img src={SCP} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="absolute top-[12%] right-[12%] w-20 h-20 md:w-28 md:h-28 opacity-80 landing-float" style={{ animationDelay: '0.2s' }}>
          <div className="landing-card-floating rounded-2xl overflow-hidden shadow-xl">
            <img src={TCP} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="absolute bottom-[22%] left-[15%] w-16 h-16 md:w-24 md:h-24 opacity-85 landing-float" style={{ animationDelay: '0.4s' }}>
          <div className="landing-card-floating rounded-2xl overflow-hidden shadow-xl">
            <img src={CDM} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="absolute bottom-[18%] right-[10%] w-20 h-20 md:w-28 md:h-28 opacity-80 landing-float" style={{ animationDelay: '0.3s' }}>
          <div className="landing-card-floating rounded-2xl overflow-hidden shadow-xl">
            <img src={SIM} alt="" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 md:px-8 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <h1
              className="font-heading font-bold tracking-tight leading-[1.1] mb-6 text-white"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
            >
              Stick around.
              <br />
              <span className="text-white/95">It&apos;s Routed.</span>
            </h1>
            <p
              className="text-white/90 max-w-2xl mx-auto mb-10 font-medium"
              style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}
            >
              Find travel partners who share your route. Plan together, split costs, explore the world — all under one roof.
            </p>

            <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  <PlaceAutocomplete
                    value={searchQuery}
                    onChange={(p) => handlePlaceChange(p ? { display_name: p.display_name } : null)}
                    onQueryChange={handleQueryChange}
                    placeholder="Where are you going? Tokyo, Paris, Iceland..."
                    className="w-full"
                    inputClassName="!px-5 !py-3.5 !rounded-2xl !border-0 !bg-white !shadow-lg focus:!ring-white/50"
                  />
                </div>
                <button
                  type="submit"
                  className="px-8 py-3.5 bg-white text-primary font-bold rounded-2xl hover:scale-[1.02] hover:bg-white/95 transition shadow-lg"
                >
                  Explore trips
                </button>
              </div>
            </form>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-white/80 text-sm">
              <span>Travelers from 190+ countries</span>
              <span>Smart matching</span>
              <span>Privacy first</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Map — where users listed trips */}
      <section className="px-4 md:px-8 py-24 md:py-24 bg-[#F8FAFC]">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-heading text-[clamp(2rem,4vw,2.75rem)] font-bold text-[#0B1220] text-center mb-3">
            Trips on the map
          </h2>
          <p className="text-[#64748B] text-center mb-10 max-w-xl mx-auto" style={{ fontSize: '1.125rem' }}>
            See where travelers are heading. Click a marker to view details.
          </p>
          <LandingMap height="420px" className="w-full" />
        </div>
      </section>

      {/* Features — Get a taste of life at Routed */}
      <section className="px-4 md:px-8 py-24 md:py-24 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-heading text-[clamp(2rem,4vw,2.75rem)] font-bold text-[#0B1220] text-center mb-3">
            Get a taste of life at Routed
          </h2>
          <p className="text-[#64748B] text-center mb-14 max-w-xl mx-auto" style={{ fontSize: '1.125rem' }}>
            Where shared routes turn into shared stories.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="landing-card bg-white rounded-2xl p-8 border border-slate-200/80 shadow-[0_4px_24px_-4px_rgba(16,24,40,0.08)] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-lg font-bold mb-6">
                  {step.num}
                </div>
                <h3 className="font-heading text-xl font-bold text-[#0B1220] mb-2">{step.title}</h3>
                <p className="text-[#64748B] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Routed — feature carousel */}
      <section className="px-4 md:px-8 py-24 md:py-24 bg-[#F8FAFC]">
        <h2 className="font-heading text-[clamp(2rem,4vw,2.75rem)] font-bold text-[#0B1220] text-center mb-4">
          Why Routed?
        </h2>
        <p className="text-[#64748B] text-center mb-12">Meaningful connections, not random hookups.</p>

        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center justify-center" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <button
              onClick={handlePrevious}
              className="absolute left-0 z-10 p-3 rounded-full bg-primary text-white hover:bg-[#1d4ed8] hover:scale-105 transition"
              aria-label="Previous"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            <div className="w-full px-14 md:px-16">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="landing-card rounded-2xl p-8 md:p-10 bg-white border border-slate-200/80 shadow-[0_4px_24px_-4px_rgba(16,24,40,0.08)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <img src={features[currentSlide].icon} alt="" className="w-16 h-16 mx-auto mb-6 object-contain" />
                  <h3 className="font-heading text-2xl font-bold text-[#0B1220] mb-4 text-center">{features[currentSlide].title}</h3>
                  <p className="text-[#64748B] text-center leading-relaxed">{features[currentSlide].desc}</p>
                </div>
              </motion.div>
            </div>

            <button
              onClick={handleNext}
              className="absolute right-0 z-10 p-3 rounded-full bg-primary text-white hover:bg-[#1d4ed8] hover:scale-105 transition"
              aria-label="Next"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {features.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition w-8 ${i === currentSlide ? 'bg-primary' : 'bg-slate-200'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Lifestyle cards — Connect, Travel, Explore, Trust */}
      <section className="px-4 md:px-8 py-24 md:py-24 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-heading text-[clamp(2rem,4vw,2.75rem)] font-bold text-[#0B1220] text-center mb-4">
            Live smarter · Travel closer
          </h2>
          <p className="text-[#64748B] text-center mb-14 max-w-2xl mx-auto">
            What you want — real connections, shared routes, peace of mind. What your fellow travelers want too.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {lifestyleCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="landing-card bg-[#F8FAFC] rounded-2xl p-6 border border-slate-200/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <span className="text-3xl mb-4 block">{card.emoji}</span>
                <h3 className="font-heading font-bold text-[#0B1220] mb-2">{card.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-4 md:px-8 py-24 md:py-28 bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#1e40af]">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-bold mb-4">
            Ready to find your travel partner?
          </h2>
          <p className="text-white/90 mb-8" style={{ fontSize: '1.125rem' }}>
            Join Routed and start matching today. No stress, no guesswork.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-white text-primary font-bold rounded-2xl hover:scale-[1.02] hover:bg-white/95 transition shadow-lg"
            >
              Sign up
            </Link>
            <Link
              to="/explore"
              className="px-8 py-4 border-2 border-white text-white font-semibold rounded-2xl hover:bg-white/10 transition"
            >
              Browse trips
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 md:px-8 py-12 bg-[#0F172A] text-white">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="font-heading font-bold text-lg">Routed</Link>
          <div className="flex gap-8 text-sm text-slate-400">
            <Link to="/explore" className="hover:text-white transition">Explore</Link>
            <Link to="/login" className="hover:text-white transition">Log in</Link>
            <Link to="/signup" className="hover:text-white transition">Sign up</Link>
          </div>
        </div>
        <p className="max-w-[1200px] mx-auto mt-6 text-center md:text-left text-sm text-slate-500">
          © {new Date().getFullYear()} Routed
        </p>
      </footer>
    </div>
  )
}

export default Landing
