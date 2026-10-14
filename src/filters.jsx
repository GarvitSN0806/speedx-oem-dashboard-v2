import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { fetchRows, toRange } from './lib'
import { useAuth } from './auth'

// All Indian states for the filter
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
]

const Ctx = createContext(null)
export const useFilters = () => useContext(Ctx)
const INIT = { mode: 'all', day: '', month: '', start: '', end: '', state: '', stateView: 'all', stateCount: 10 }

export function FilterProvider({ children }) {
  const [f, setF] = useState(INIT)
  const range = useMemo(() => toRange(f), [f])
  return <Ctx.Provider value={{ f, setF, range, states: INDIAN_STATES }}>{children}</Ctx.Provider>
}

// Loads a live view with the current filters.
export function useRows(source) {
  const { range, f } = useFilters()
  const [s, setS] = useState({ rows: [], loading: false, err: '' })
  useEffect(() => {
    // For 'all' mode, range can be null - we still want to fetch all data
    // Only skip fetch when user hasn't selected a valid filter (not all mode)
    const isAllMode = f.mode === 'all'

    if (!range && !isAllMode) { setS({ rows: [], loading: false, err: '' }); return }

    let off = false
    setS((x) => ({ ...x, loading: true, err: '' }))
    // For all mode, pass empty range to get all records
    const fetchRange = isAllMode ? { from: null, to: null, state: null } : range
    fetchRows(source, fetchRange)
      .then((rows) => !off && setS({ rows, loading: false, err: '' }))
      .catch((e) => !off && setS({ rows: [], loading: false, err: e.message }))
    return () => { off = true }
  }, [range, f.mode, source])
  return { ...s, range }
}

export function Gate({ range, loading, err, children }) {
  if (err) return <p className="notice">{err}</p>
  // Don't show "Pick a date" for 'all' mode - range can be null there
  // Only show message when user hasn't selected any valid filter yet
  const { f } = useFilters()
  const isAllMode = f.mode === 'all'
  if (!range && !isAllMode) return <p className="muted center">Pick a date / month / range to load data.</p>
  if (loading) return <p className="muted center">Loading…</p>
  return children
}

export function FilterBar() {
  const { f, setF, states } = useFilters()
  const { role } = useAuth()
  const nav = useNavigate()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <section className="card filters">
      <label>Period
        <select value={f.mode} onChange={set('mode')}>
          <option value="all">All time</option><option value="day">Single date</option>
          <option value="month">Month</option><option value="range">Custom range</option>
        </select></label>
      {f.mode === 'day' && <label>Date<input type="date" value={f.day} onChange={set('day')} /></label>}
      {f.mode === 'month' && <label>Month<input type="month" value={f.month} onChange={set('month')} /></label>}
      {f.mode === 'range' && <>
        <label>From<input type="date" value={f.start} max={f.end || undefined} onChange={set('start')} /></label>
        <label>To<input type="date" value={f.end} min={f.start || undefined} onChange={set('end')} /></label></>}
      <label>State
        <select value={f.state} onChange={set('state')}>
          <option value="">All states</option>{states.map((s) => <option key={s}>{s}</option>)}
        </select></label>
      <label>Show states
        <select value={f.stateView} onChange={set('stateView')}>
          <option value="all">All</option>
          <option value="top">Top by sales</option>
          <option value="bottom">Bottom by sales</option>
        </select></label>
      {f.stateView !== 'all' && <label>Count<input type="number" min="1" max="36" value={f.stateCount} onChange={set('stateCount')} style={{ width: 60 }} /></label>}
      <span className="grow" />
    </section>
  )
}
