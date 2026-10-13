import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Login({ admin = false }) {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setMsg(''); setBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setBusy(false); return setMsg(error.message) }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    const isAdmin = p?.role === 'admin'
    if (admin !== isAdmin) {
      await supabase.auth.signOut(); setBusy(false)
      return setMsg(admin ? 'This account is not the admin account.' : 'Admin must sign in on the Admin login page.')
    }
    nav(admin ? '/admin' : '/dashboard')
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h2>Admin login</h2>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <p className="notice">{msg}</p>}
        <button disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
        <Link className="small" to="/">← Home</Link>
      </form>
    </div>
  )
}
