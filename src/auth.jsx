import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [init, setInit] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setInit(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!init) return
    if (!session) { setRole(null); setLoading(false); return }
    setLoading(true)
    supabase.from('profiles').select('role').eq('id', session.user.id).single()
      .then(({ data }) => { setRole(data?.role ?? null); setLoading(false) })
  }, [init, session?.user?.id])

  const signOut = () => supabase.auth.signOut()
  return <Ctx.Provider value={{ session, role, loading, signOut }}>{children}</Ctx.Provider>
}
