<<<<<<< HEAD
import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './components/Landing'
import Signup from './pages/Signup'
import Trips from './pages/Trips'
import Dashboard from './pages/Dashboard'
import Suggestions from './pages/Suggestions'
import Matches from './pages/Matches'
import Sidebar from './components/Sidebar'
=======
import { useState } from 'react'
>>>>>>> ab07919c9056cfe27e37b4ce65f1e0b487cbb5a8
import './App.css'

const App: React.FC = () => {
  return (
<<<<<<< HEAD
    <BrowserRouter>
      <div style={{display:'flex'}}>
        <Sidebar />
        <main style={{flex:1}}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/matches" element={<Matches />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
=======
    <>
    </>
>>>>>>> ab07919c9056cfe27e37b4ce65f1e0b487cbb5a8
  )
}

export default App
