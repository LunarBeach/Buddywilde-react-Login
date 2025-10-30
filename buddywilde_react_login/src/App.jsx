import { useState } from 'react'
import BuddyForm from './components/buddyForm'
import { api } from './services/api'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <BuddyForm />
    </div>
  )
}

export default App
