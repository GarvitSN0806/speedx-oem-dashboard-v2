import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ScatterChart, Scatter } from 'recharts'
import { computeInsights, inr, num, scale } from '../lib'
import { FilterBar, Gate, useRows, useFilters } from '../filters'

const INSIGHTS = [
  ['Company with highest gross profit', 'company', inr, 'good'],
  ['Client with highest gross profit', 'client', inr, 'good'],
  ['Zone with highest profit', 'zone', inr, 'good'],
  ['Town/city with highest profit', 'town', inr, 'good'],
  ['Best selling state (max products sold)', 'maxUnits', (v) => `${num(v)} units`, 'good'],
  ['State with most clients', 'mostClients', (v) => `${v} clients`, 'good'],
  ['Underperforming state (lowest margin)', 'underperforming', (v) => `${v.toFixed(1)}% margin`, 'bad'],
  ['Least selling state', 'leastSales', inr, 'bad'],
]
const tick = (v) => (v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v)

// Chart selector component
function ChartSelector({ value, onChange }) {
  return (
    <div className="toggle">
      <button className={value === 'bar' ? 'on' : ''} onClick={() => onChange('bar')}>Bar</button>
      <button className={value === 'line' ? 'on' : ''} onClick={() => onChange('line')}>Line</button>
      <button className={value === 'pie' ? 'on' : ''} onClick={() => onChange('pie')}>Pie</button>
    </div>
  )
}

export default function Dashboard() {
  const { rows, loading, err, range } = useRows('v_sales_daily')
  const { f } = useFilters()

  // Chart type selection state for each section
  const [chart1Type, setChart1Type] = useState('bar')   // State-wise Sales
  const [chart2Type, setChart2Type] = useState('pie')   // Company-wise Profit
  const [chart3Type, setChart3Type] = useState('line')  // Daily Sales Trend
  const [chart4Type, setChart4Type] = useState('bar')   // Client Performance

  const ins = useMemo(() => computeInsights(rows), [rows])
  const tot = useMemo(() => rows.reduce((a, r) => ({
    units: a.units + Number(r.total_units), cost: a.cost + Number(r.total_cost), records: a.records + Number(r.record_count),
    sell: a.sell + Number(r.total_selling), profit: a.profit + Number(r.gross_profit),
  }), { units: 0, cost: 0, sell: 0, profit: 0, records: 0 }), [rows])

  // Data diagnostics
  const septemberRows = useMemo(() => rows.filter(r => r.date && r.date.startsWith('2024-09')), [rows])
  const dataSummary = useMemo(() => {
    if (!rows.length) return { totalRows: 0, dateRange: 'No data', septemberCount: 0 }
    const dates = rows.map(r => r.date).filter(d => d)
    dates.sort()
    return { totalRows: rows.length, dateRange: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No date column', septemberCount: septemberRows.length }
  }, [rows, septemberRows])

  // Data for Section 1 - State-wise sales
  const ranked = useMemo(() => Object.entries(ins.stateSales).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales), [ins])
  const stateData = useMemo(() => {
    if (f.stateView === 'top') return ranked.slice(0, f.stateCount)
    if (f.stateView === 'bottom') return ranked.slice(-f.stateCount)
    return ranked
  }, [ranked, f.stateView, f.stateCount])

  // Data for Section 2 - Company-wise profit
  const companyData = useMemo(() => {
    const m = {}
    rows.forEach((r) => { const k = r.company || '—'; m[k] = (m[k] || 0) + Number(r.gross_profit) })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 15)
  }, [rows])

  // Data for Section 3 - Daily sales trend
  const dailyData = useMemo(() => {
    const m = {}
    rows.forEach((r) => { const k = r.date; m[k] = (m[k] || 0) + Number(r.total_selling) })
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([date, sales]) => ({ name: date, value: sales }))
  }, [rows])

  // Data for Section 4 - Client performance
  const clientData = useMemo(() => {
    const m = {}
    rows.forEach((r) => {
      const k = r.client || '—'
      if (!m[k]) m[k] = { name: k, profit: 0 }
      m[k].profit += Number(r.gross_profit)
    })
    return Object.values(m).sort((a, b) => b.profit - a.profit).slice(0, 15).map(c => ({ name: c.name, value: c.profit }))
  }, [rows])

  // Generate colors
  const getColors = (len) => Array.from({ length: len }, (_, i) => `hsl(${(i * 137) % 360}, 70%, 50%)`)

  const margin = tot.sell ? (tot.profit / tot.sell) * 100 : 0

  // Render chart based on type
  const renderChart = (type, data, valueKey = 'value') => {
    if (!data.length) return <p className="muted center">No data available</p>

    const colors = getColors(data.length)

    return (
      <div style={{ height: 320 }}>
        <ResponsiveContainer>
          {type === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis tickFormatter={tick} />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey={valueKey} name="Value" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={colors[i]} />)}
              </Bar>
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={data.length > 20 ? -45 : 0} textAnchor={data.length > 20 ? 'end' : 'middle'} height={data.length > 20 ? 80 : 60} />
              <YAxis tickFormatter={tick} />
              <Tooltip formatter={(v) => inr(v)} />
              <Line type="monotone" dataKey={valueKey} name="Value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie data={data.slice(0, 10)} cx="50%" cy="50%" innerRadius={50} outerRadius={110} dataKey={valueKey} nameKey="name" label={{ fontSize: 11 }}>
                {data.slice(0, 10).map((d, i) => <Cell key={i} fill={colors[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => inr(v)} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <main className="page">
      <FilterBar />
      <Gate range={range} loading={loading} err={err}>
        {/* Data Summary */}
        <section className="card">
          <h3>📊 Data Summary</h3>
          <div className="stats three">
            <div><span>Total Records</span><b>{dataSummary.totalRows}</b></div>
            <div><span>Date Range</span><b>{dataSummary.dateRange}</b></div>
            <div><span>September 2024 Records</span><b>{dataSummary.septemberCount}</b></div>
          </div>
        </section>

        {/* Section 1: State-wise Sales */}
        <section className="card">
          <div className="row">
            <h3>📊 State-wise Sales</h3>
            {f.stateView !== 'all' && <span className="muted small">({f.stateView === 'top' ? 'Top' : 'Bottom'} {f.stateCount})</span>}
            <span className="grow" />
            <ChartSelector value={chart1Type} onChange={setChart1Type} />
          </div>
          {renderChart(chart1Type, stateData, 'sales')}
        </section>

        {/* Section 2: Company-wise Profit */}
        <section className="card">
          <div className="row">
            <h3>🏢 Company-wise Profit</h3>
            <span className="grow" />
            <ChartSelector value={chart2Type} onChange={setChart2Type} />
          </div>
          {renderChart(chart2Type, companyData)}
        </section>

        {/* Section 3: Daily Sales Trend */}
        <section className="card">
          <div className="row">
            <h3>📈 Daily Sales Trend</h3>
            <span className="grow" />
            <ChartSelector value={chart3Type} onChange={setChart3Type} />
          </div>
          {renderChart(chart3Type, dailyData)}
        </section>

        {/* Section 4: Client Performance */}
        <section className="card">
          <div className="row">
            <h3>👥 Client Performance</h3>
            <span className="grow" />
            <ChartSelector value={chart4Type} onChange={setChart4Type} />
          </div>
          {renderChart(chart4Type, clientData)}
        </section>

        <section className="cols">
          <div className="card"><h3>Sales volume</h3>
            <div className="stats"><div><span>Total units sold</span><b>{num(tot.units)}</b></div>
              <div><span>Records</span><b>{num(tot.records)}</b></div></div></div>
          <div className="card"><h3>Pricing breakdown</h3>
            <div className="stats three">
              <div><span>Cost price</span><b>{inr(tot.cost)}</b></div>
              <div><span>Selling price</span><b>{inr(tot.sell)}</b></div>
              <div><span>Gross profit</span><b className={tot.profit < 0 ? 'neg' : 'pos'}>{inr(tot.profit)}</b>
                <small>{margin.toFixed(1)}% margin</small></div></div></div>
        </section>

        <section className="card"><h3>Insights</h3>
          <div className="insights">
            {INSIGHTS.map(([label, key, fmt, tone]) => (
              <div key={key} className={`insight ${tone}`}>
                <span>{label}</span>
                {ins[key] ? <><b>{ins[key].name}</b><small>{fmt(ins[key].value)}</small></> : <b>—</b>}
              </div>))}
          </div></section>
      </Gate>
    </main>
  )
}
