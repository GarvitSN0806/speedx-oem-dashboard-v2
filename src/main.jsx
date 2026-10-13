import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import { FilterProvider } from './filters'
import { configured } from './supabase'
import './styles.css'

function Setup() {
  return (
    <div className="login">
      <div className="card" style={{ maxWidth: 520 }}>
        <h2>Supabase isn't configured</h2>
        <p>Create a file named <code>.env</code> in the project root (next to <code>package.json</code>):</p>
        <pre>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
        <p>Then stop the dev server (Ctrl+C) and run <code>npm run dev</code> again.</p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  configured ? (
    <BrowserRouter>
      <AuthProvider>
        <FilterProvider>
          <App />
        </FilterProvider>
      </AuthProvider>
    </BrowserRouter>
  ) : (
    <Setup />
  )
)
