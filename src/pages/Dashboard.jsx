import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from 'recharts'
import { computeInsights, inr, num } from '../lib'
import { FilterBar, Gate, useRows, useFilters } from '../filters'

const tick = (v) => (v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v)
const getColors = (len) => Array.from({ length: len }, (_, i) => `hsl(${(i * 137) % 360}, 65%, 50%)`)

const VIEWS = [
  { value: 'profit',      label: 'Profit Overall Summary' },
  { value: 'sku',         label: 'SKU-wise Sales & Gross Profit' },
  { value: 'party',       label: 'Party-wise Sales & Gross Profit' },
  { value: 'print',       label: 'Print Type-wise Sales & Gross Profit' },
  { value: 'category',    label: 'Category-wise Sales & Gross Profit' },
  { value: 'salesperson', label: 'Salesperson-wise Sales & Gross Profit' },
]

// ── Chart toggle ──────────────────────────────────────────────────────────────
function ChartSelector({ value, onChange }) {
  return (
    <div className="toggle">
      {['bar', 'line', 'pie'].map((t) => (
        <button key={t} className={value === t ? 'on' : ''} onClick={() => onChange(t)}>
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  )
}

// ── Generic dual-metric chart (sales + gross profit) ─────────────────────────
function DualChart({ type, data }) {
  if (!data.length) return <p className="muted center">No data available.</p>
  const colors = getColors(data.length)
  const top = data.slice(0, 12)

  if (type === 'pie') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[['Sales', 'sales', '#3b82f6'], ['Gross Profit', 'profit', '#10b981']].map(([title, key, baseColor]) => (
          <div key={key}>
            <p style={{ textAlign: 'center', fontWeight: 600, marginBottom: 8 }}>{title}</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={top} cx="50%" cy="50%" innerRadius={40} outerRadius={100}
                    dataKey={key} nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {top.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => inr(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'line') {
    return (
      <div style={{ height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={top}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" angle={-40} textAnchor="end" height={80} />
            <YAxis tickFormatter={tick} />
            <Tooltip formatter={(v) => inr(v)} />
            <Legend />
            <Line type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="profit" name="Gross Profit" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // bar (default)
  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer>
        <BarChart data={top}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" angle={-40} textAnchor="end" height={80} />
          <YAxis tickFormatter={tick} />
          <Tooltip formatter={(v) => inr(v)} />
          <Legend />
          <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit" name="Gross Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
      <span style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--muted)', fontSize: 15, pointerEvents: 'none',
      }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', paddingLeft: 38 }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', boxShadow: 'none', padding: '0 4px', color: 'var(--muted)',
            fontSize: 16, lineHeight: 1,
          }}
        >✕</button>
      )}
    </div>
  )
}

// ── Analysis section for a given dimension ────────────────────────────────────
function DimensionSection({ rows, dimKey, label, chartType, setChartType }) {
  const [search, setSearch] = useState('')

  const allData = useMemo(() => {
    const m = {}
    rows.forEach((r) => {
      const k = r[dimKey] || '—'
      if (!m[k]) m[k] = { name: k, sales: 0, profit: 0 }
      m[k].sales  += Number(r.total_selling)
      m[k].profit += Number(r.gross_profit)
    })
    return Object.values(m).sort((a, b) => b.sales - a.sales)
  }, [rows, dimKey])

  const data = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allData
    return allData.filter((d) => d.name.toLowerCase().includes(q))
  }, [allData, search])

  // KPIs reflect filtered data
  const totSales  = data.reduce((s, d) => s + d.sales, 0)
  const totProfit = data.reduce((s, d) => s + d.profit, 0)
  const margin    = totSales ? ((totProfit / totSales) * 100).toFixed(1) : '0.0'

  return (
    <>
      {/* Search + KPIs */}
      <section className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={`Search ${label}…`}
          />
          {search && (
            <span className="muted small">
              {data.length} of {allData.length} result{data.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="stats three">
          <div><span>Total Sales</span><b>{inr(totSales)}</b></div>
          <div><span>Total Gross Profit</span><b className={totProfit < 0 ? 'neg' : 'pos'}>{inr(totProfit)}</b></div>
          <div><span>Margin</span><b>{margin}%</b></div>
        </div>
      </section>

      {/* Chart */}
      <section className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{label} — Sales & Gross Profit{search ? ` · "${search}"` : ''}</h3>
          <span className="grow" />
          <ChartSelector value={chartType} onChange={setChartType} />
        </div>
        {data.length ? <DualChart type={chartType} data={data} /> : <p className="muted center">No results for "{search}".</p>}
      </section>

      {/* Table */}
      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Detailed Table</h3>
          {search && <span className="muted small">Showing results for "{search}"</span>}
        </div>
        <div className="scroll tall">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{label}</th>
                <th className="r">Sales</th>
                <th className="r">Gross Profit</th>
                <th className="r">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={5} className="muted center">No results for "{search}".</td></tr>
              ) : data.map((d, i) => {
                const mg = d.sales ? ((d.profit / d.sales) * 100).toFixed(1) : '0.0'
                return (
                  <tr key={d.name}>
                    <td className="muted small">{i + 1}</td>
                    <td>{d.name}</td>
                    <td className="r">{inr(d.sales)}</td>
                    <td className={`r ${d.profit < 0 ? 'neg' : 'pos'}`}>{inr(d.profit)}</td>
                    <td className="r muted">{mg}%</td>
                  </tr>
                )
              })}
              {data.length > 0 && (
                <tr className="total">
                  <td colSpan={2}>Total {search ? `(filtered)` : ''}</td>
                  <td className="r">{inr(totSales)}</td>
                  <td className={`r ${totProfit < 0 ? 'neg' : 'pos'}`}>{inr(totProfit)}</td>
                  <td className="r">{margin}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// ── Profit overall summary ────────────────────────────────────────────────────
const INSIGHTS = [
  ['Company with highest gross profit', 'company', inr, 'good'],
  ['Client with highest gross profit',  'client',  inr, 'good'],
  ['Zone with highest profit',          'zone',    inr, 'good'],
  ['Town/city with highest profit',     'town',    inr, 'good'],
  ['Best selling state (max units)',    'maxUnits', (v) => `${num(v)} units`, 'good'],
  ['State with most clients',           'mostClients', (v) => `${v} clients`, 'good'],
  ['Underperforming state (lowest margin)', 'underperforming', (v) => `${v.toFixed(1)}% margin`, 'bad'],
  ['Least selling state',               'leastSales', inr, 'bad'],
]

function ProfitSummary({ rows }) {
  const [search, setSearch] = useState('')

  // Filter rows by SKU/product search
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      (r.sku        && String(r.sku).toLowerCase().includes(q)) ||
      (r.category   && String(r.category).toLowerCase().includes(q)) ||
      (r.print_type && String(r.print_type).toLowerCase().includes(q)) ||
      (r.client     && String(r.client).toLowerCase().includes(q))
    )
  }, [rows, search])

  const ins = useMemo(() => computeInsights(filteredRows), [filteredRows])
  const tot = useMemo(() => filteredRows.reduce((a, r) => ({
    units:   a.units   + Number(r.total_units),
    cost:    a.cost    + Number(r.total_cost),
    records: a.records + Number(r.record_count),
    sell:    a.sell    + Number(r.total_selling),
    profit:  a.profit  + Number(r.gross_profit),
  }), { units: 0, cost: 0, sell: 0, profit: 0, records: 0 }), [filteredRows])

  const margin = tot.sell ? ((tot.profit / tot.sell) * 100).toFixed(1) : '0.0'

  const [trendType, setTrendType] = useState('line')
  const dailyData = useMemo(() => {
    const m = {}
    filteredRows.forEach((r) => {
      const k = r.date
      if (!m[k]) m[k] = { name: k, sales: 0, profit: 0 }
      m[k].sales  += Number(r.total_selling)
      m[k].profit += Number(r.gross_profit)
    })
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [filteredRows])

  return (
    <>
      {/* Search */}
      <section className="card filters" style={{ alignItems: 'center' }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by SKU, category, print type, or client…"
        />
        {search && (
          <span className="muted small">
            {filteredRows.length} of {rows.length} records match
          </span>
        )}
      </section>

      <section className="cols">
        <div className="card">
          <h3>Sales Volume{search ? ` · "${search}"` : ''}</h3>
          <div className="stats">
            <div><span>Total Units Sold</span><b>{num(tot.units)}</b></div>
            <div><span>Records</span><b>{num(tot.records)}</b></div>
          </div>
        </div>
        <div className="card">
          <h3>Pricing Breakdown{search ? ` · "${search}"` : ''}</h3>
          <div className="stats three">
            <div><span>Cost Price</span><b>{inr(tot.cost)}</b></div>
            <div><span>Selling Price</span><b>{inr(tot.sell)}</b></div>
            <div>
              <span>Gross Profit</span>
              <b className={tot.profit < 0 ? 'neg' : 'pos'}>{inr(tot.profit)}</b>
              <small>{margin}% margin</small>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Daily Sales & Profit Trend{search ? ` · "${search}"` : ''}</h3>
          <span className="grow" />
          <ChartSelector value={trendType} onChange={setTrendType} />
        </div>
        {dailyData.length
          ? <DualChart type={trendType} data={dailyData} />
          : <p className="muted center">No records match "{search}".</p>}
      </section>

      <section className="card">
        <h3>Key Insights{search ? ` · "${search}"` : ''}</h3>
        <div className="insights">
          {INSIGHTS.map(([label, key, fmt, tone]) => (
            <div key={key} className={`insight ${tone}`}>
              <span>{label}</span>
              {ins[key] ? <><b>{ins[key].name}</b><small>{fmt(ins[key].value)}</small></> : <b>—</b>}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
const DIM_MAP = {
  sku:         { key: 'sku',         label: 'SKU' },
  party:       { key: 'client',      label: 'Party / Client' },
  print:       { key: 'print_type',  label: 'Print Type' },
  category:    { key: 'category',    label: 'Category' },
  salesperson: { key: 'salesperson', label: 'Salesperson' },
}

export default function Dashboard() {
  const { rows, loading, err, range } = useRows('v_sales_daily')
  const { f } = useFilters()

  const [view, setView]           = useState('profit')
  const [chartType, setChartType] = useState('bar')
  // key resets internal search state when view changes
  const [viewKey, setViewKey]     = useState(0)

  const currentView = VIEWS.find((v) => v.value === view)

  return (
    <main className="page">
      <FilterBar />

      {/* View selector */}
      <section className="card filters" style={{ alignItems: 'center' }}>
        <label style={{ flex: '0 0 auto' }}>
          Analysis View
          <select
            value={view}
            onChange={(e) => { setView(e.target.value); setChartType('bar'); setViewKey((k) => k + 1) }}
            style={{ minWidth: 280 }}
          >
            {VIEWS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </label>
        <span className="grow" />
        <span className="muted small">Sales &amp; Profit · {currentView?.label}</span>
      </section>

      <Gate range={range} loading={loading} err={err}>
        {view === 'profit' && <ProfitSummary key={viewKey} rows={rows} />}

        {view !== 'profit' && DIM_MAP[view] && (
          <DimensionSection
            key={viewKey}
            rows={rows}
            dimKey={DIM_MAP[view].key}
            label={DIM_MAP[view].label}
            chartType={chartType}
            setChartType={setChartType}
          />
        )}
      </Gate>
    </main>
  )
}
