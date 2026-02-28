import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './components/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Trips from './pages/Trips'
import Explore from './pages/Explore'
import Dashboard from './pages/Dashboard'
import Suggestions from './pages/Suggestions'
import Matches from './pages/Matches'
import Sidebar from './components/Sidebar'
import './App.css'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{display:'flex'}}>
        <Sidebar />
        <main style={{flex:1}}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/matches" element={<Matches />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
