import { supabase } from './supabase'

export const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)
export const num = (n) => new Intl.NumberFormat('en-IN').format(n || 0)
export const scale = (t) => `hsl(${Math.round(t * 135)}, 65%, 42%)` // red (low) -> green (high)
export const COLORS = { order: '#2563eb', dispatch: '#15803d', pending: '#b91c1c' }

// Stable sort keys so paging never skips/duplicates rows.
const ORDER = {
  sales: ['date', 'id'],
  v_sales_daily: ['date', 'state', 'zone', 'town_city', 'company', 'client'],
  v_party_mis: ['date', 'state', 'client'],
  v_sku_mis: ['date', 'state', 'sku'],
  v_category_mis: ['date', 'state', 'category'],
  v_print_mis: ['date', 'state', 'print_type'],
  v_overall_mis: ['date', 'state'],
  v_salesperson_mis: ['date', 'state', 'salesperson'],
}

// Reads a table or live view, paging past Supabase's 1000-row default.
export async function fetchRows(source, { from, to, state } = {}) {
  const rows = [], size = 1000
  for (let i = 0; ; i += size) {
    let q = supabase.from(source).select('*')
    ORDER[source].forEach((c) => { q = q.order(c, { ascending: c !== 'date' }) })
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    // Always show all-time if mode is all (from/to are null anyway)
    if (state) q = q.eq('state', state)
    const { data, error } = await q.range(i, i + size - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < size) break
  }
  return rows
}
export const fetchSales = (f) => fetchRows('sales', f)

// ---- filters ----
export function toRange(f) {
  const state = f.state || null
  if (f.mode === 'all') return { from: null, to: null, state }
  if (f.mode === 'day') return f.day ? { from: f.day, to: f.day, state } : null
  if (f.mode === 'month') {
    if (!f.month) return null
    const [y, m] = f.month.split('-').map(Number)
    return { from: `${f.month}-01`, to: `${f.month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`, state }
  }
  return f.start && f.end ? { from: f.start, to: f.end, state } : null
}
export function describeFilters(f) {
  const when = { all: 'All time', day: `Date ${f.day}`, month: `Month ${f.month}`, range: `${f.start} → ${f.end}` }[f.mode]
  return `${when} · ${f.state || 'All states'}`
}
export function filtersFromScope(s = {}) {
  const base = { month: '', state: s.state || '' }
  if (!s.from) return { ...base, mode: 'all', day: '', start: '', end: '' }
  if (s.from === s.to) return { ...base, mode: 'day', day: s.from, start: '', end: '' }
  return { ...base, mode: 'range', day: '', start: s.from, end: s.to }
}

// ---- MIS ----
export function aggregate(rows, key) {
  const m = {}
  rows.forEach((r) => {
    const k = r[key] || '—'
    const a = (m[k] ||= { name: k, order: 0, dispatch: 0, pending: 0 })
    a.order += Number(r.order_qty); a.dispatch += Number(r.dispatch_qty); a.pending += Number(r.pending_qty)
  })
  return Object.values(m).sort((a, b) => b.order - a.order)
}

// ---- insights (rows come from v_sales_daily) ----
const group = (rows, key, fn) => {
  const m = {}
  rows.forEach((r) => { const k = r[key] || '—'; m[k] = (m[k] || 0) + fn(r) })
  return m
}
const pick = (m, dir = 1) => {
  const e = Object.entries(m)
  if (!e.length) return null
  e.sort((a, b) => dir * (b[1] - a[1]))
  return { name: e[0][0], value: e[0][1] }
}
export function computeInsights(rows) {
  const gp = (r) => Number(r.gross_profit), u = (r) => Number(r.total_units), s = (r) => Number(r.total_selling)
  const stateSales = group(rows, 'state', s)
  const stateProfit = group(rows, 'state', gp)
  const clients = {}
  rows.forEach((r) => { (clients[r.state] ||= new Set()).add(r.client) })
  const clientCount = Object.fromEntries(Object.entries(clients).map(([k, v]) => [k, v.size]))
  const margin = Object.fromEntries(
    Object.keys(stateSales).map((k) => [k, stateSales[k] ? (stateProfit[k] / stateSales[k]) * 100 : 0]))
  return {
    stateSales,
    company: pick(group(rows, 'company', gp)),
    client: pick(group(rows, 'client', gp)),
    zone: pick(group(rows, 'zone', gp)),
    town: pick(group(rows, 'town_city', gp)),
    maxUnits: pick(group(rows, 'state', u)),
    mostClients: pick(clientCount),
    underperforming: pick(margin, -1),
    leastSales: pick(stateSales, -1),
  }
}

// ---- csv / share ----
export function toCsv(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const cell = (v) => {
    let s = v == null ? '' : String(v)
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}
export function downloadCsv(name, rows) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
export async function callResolve(body) {
  const { data, error } = await supabase.functions.invoke('share-resolve', { body })
  if (!error) return data
  try { return await error.context.json() } catch { return { error: error.message } }
}
