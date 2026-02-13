import React from 'react'

const Trips: React.FC = () => {
  return (
    <div style={{maxWidth:1000,margin:'2rem auto',padding:'1rem'}}>
      <h2>Your Trips</h2>
      <p>List of trips and actions will go here.</p>
      <div style={{display:'grid',gap:12}}>
        <div style={{border:'1px solid #e6eef8',padding:12,borderRadius:8}}>Example trip card</div>
      </div>
    </div>
  )
}

export default Trips
