import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from './Header'
import './landing.css'
import TCP from '../assets/TCP.png'
import SCP from '../assets/SCP.png'
import SIM from '../assets/SIM.png'
import CDM from '../assets/CDM.png'

const Landing: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [startX, setStartX] = useState(0)

  const features = [
    {
      icon: SCP,
      title: "Smart Compatibility",
      description: "Matches are generated using travel preferences and interests"
    },
    {
      icon: TCP,
      title: "Trip-Centric Planning",
      description: "Focus on real trips, structured itineraries, and shared planning"
    },
    {
      icon: CDM,
      title: "Consent-Driven Matching",
      description: "All travelers must agree before connecting, privacy first"
    },
    {
      icon: SIM,
      title: "Built with Safety in Mind",
      description: "secure authentication to ensure meaningful and safe connections"
    }
  ]

  const handlePrevious = () => {
    setCurrentSlide((prev) => (prev === 0 ? features.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentSlide((prev) => (prev === features.length - 1 ? 0 : prev + 1))
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX
    if (startX - endX > 50) {
      handleNext()
    } else if (endX - startX > 50) {
      handlePrevious()
    }
  }

  return (
  <div className="min-h-screen bg-white text-gray-800">
    <Header />

      {/* Hero Section */}
  <section className="px-4 md:px-0 py-28 flex flex-col items-center text-center w-full max-w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4 text-gray-900">Where shared paths become <span className="text-indigo-600">shared stories...</span></h2>
          <p className="text-base text-gray-700 mb-8">Routed connects you with compatible travel partners based on shared destinations, travel dates, interests, and preferences — so every trip feels right.</p>

          <div className="flex gap-4 justify-center mt-6">
            <Link to="/login" className="px-6 py-3 border text-gray-800 rounded-md">Login</Link>
            <Link to="/signup" className="px-6 py-3 bg-indigo-600 text-white rounded-md">Sign up</Link>
          </div>
        </motion.div>
      </section>

      {/* Features Carousel */}
    <section id="features" className="px-4 sm:px-6 md:px-18 py-25 w-full">
    <h3 className="text-3xl font-bold text-center mb-16 text-gray-900">Why Choose Routed?</h3>
    
    <div className="max-w-3xl mx-auto">
      {/* Carousel Container */}
      <div 
        className="relative flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          className="absolute left-0 z-10 p-3 md:p-4 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Previous slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
        </button>

        {/* Slide Container */}
        <div className="w-full px-16">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <FeatureCard
              icon={<img src={features[currentSlide].icon} alt={features[currentSlide].title} className="w-20 h-20 object-contain mx-auto" />}
              title={features[currentSlide].title}
              description={features[currentSlide].description}
            />
          </motion.div>
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="absolute right-0 z-10 p-3 md:p-4 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Next slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6"></path>
          </svg>
        </button>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-8">
        {features.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition ${
              index === currentSlide ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Counter */}
      <p className="text-center text-gray-600 mt-4 text-sm">
        {currentSlide + 1} / {features.length}
      </p>
    </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-3xl transition p-8 text-center border bg-white shadow-lg">
      <div className="flex justify-center text-indigo-600 mb-6">{icon}</div>
      <h4 className="text-2xl md:text-3xl font-semibold mb-4 text-gray-900">{title}</h4>
      <p className="text-lg md:text-xl text-gray-700">{description}</p>
    </div>
  )
}

export default Landing
