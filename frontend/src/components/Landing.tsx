import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from './Header'
import './landing.css'
import TCP from '../assets/TCP.png'
import SCP from '../assets/SCP.png'
import SIM from '../assets/SIM.png'
import CDM from '../assets/CDM.png'

const Landing: React.FC = () => {
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

      {/* Features */}
    <section id="features" className="px-4 sm:px-6 md:px-18 py-25 w-full">
    <h3 className="text-3xl font-bold text-center mb-16 text-gray-900">Why Choose Routed?</h3>
    <div className="max-w-1xl mx-auto grid md:grid-cols-4 gap-6">
          <FeatureCard
            icon={<img src={SCP} alt="map" className="w-15 h-15 object-contain mx-auto" />}
            title="Smart Compatibility"
            description="Matches are generated using travel preferences and interests"
          />
          <FeatureCard
            icon={<img src={TCP} alt="map" className="w-15 h-15 object-contain mx-auto" />}
            title="Trip-Centric Planning"
            description="Focus on real trips, structured itineraries, and shared planning"
          />
          <FeatureCard
            icon={<img src={CDM} alt="map" className="w-15 h-15 object-contain mx-auto" />}
            title="Consent-Driven Matching"
            description="All travelers must agree before connecting, privacy first"
          />
          <FeatureCard
            icon={<img src={SIM} alt="map" className="w-15 h-15 object-contain mx-auto" />}
            title="Built with Safety in Mind"
            description="secure authentication to ensure meaningful and safe connections"
            />
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl transition p-6 text-center border bg-white">
      <div className="flex justify-center text-indigo-600 mb-4">{icon}</div>
      <h4 className="text-xl font-semibold mb-3 text-gray-900">{title}</h4>
      <p className="text-gray-700">{description}</p>
    </div>
  )
}

export default Landing
