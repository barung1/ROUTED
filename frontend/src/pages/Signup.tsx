import React from 'react'

const Signup: React.FC = () => {
  return (
    <div style={{maxWidth:800,margin:'2rem auto',padding:'1rem'}}>
      <h2>Sign up (demo)</h2>
      <p>This is a scaffold page for the signup flow. Replace with real auth when ready.</p>
      <form>
        <div style={{display:'grid',gap:8,maxWidth:420}}>
          <input placeholder="Name" />
          <input placeholder="Email" />
          <input placeholder="Password" type="password" />
          <button type="button">Create account (demo)</button>
        </div>
      </form>
    </div>
  )
}

export default Signup
