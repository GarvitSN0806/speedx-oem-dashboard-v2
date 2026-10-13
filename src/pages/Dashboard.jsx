import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { computeInsights, inr, num, scale } from '../lib'
import { FilterBar, Gate, useRows, useFilters }  from '../filters'

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

export default function Dashboard() {
  const { rows, loading, err, range } = useRows('v_sales_daily')
  const { f } = useFilters()
  const [chart, setChart] = useState('bar')
  const ins = useMemo(() => computeInsights(rows), [rows])
  const tot = useMemo(() => rows.reduce((a, r) => ({
    units: a.units + Number(r.total_units), cost: a.cost + Number(r.total_cost), records: a.records + Number(r.record_count),
    sell: a.sell + Number(r.total_selling), profit: a.profit + Number(r.gross_profit),
  }), { units: 0, cost: 0, sell: 0, profit: 0, records: 0 }), [rows])
  const ranked = useMemo(() => Object.entries(ins.stateSales).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales), [ins])
  const data = useMemo(() => {
    if (f.stateView === 'top') return ranked.slice(0, f.stateCount)
    if (f.stateView === 'bottom') return ranked.slice(-f.stateCount)
    return ranked
  }, [ranked, f.stateView, f.stateCount])
  const min = Math.min(...data.map((d) => d.sales)), max = Math.max(...data.map((d) => d.sales))
  const colorOf = (v) => scale(max === min ? 1 : (v - min) / (max - min))
  const margin = tot.sell ? (tot.profit / tot.sell) * 100 : 0

  return (
    <main className="page">
      <FilterBar />
      <Gate range={range} loading={loading} err={err}>
        <section className="card">
          <div className="row"><h3>State-wise sales</h3>
            {f.stateView !== 'all' && <span className="muted small">({f.stateView === 'top' ? 'Top' : 'Bottom'} {f.stateCount} by sales)</span>}
            <span className="grow" />
            <div className="toggle">
              <button className={chart === 'bar' ? 'on' : ''} onClick={() => setChart('bar')}>Bar</button>
              <button className={chart === 'line' ? 'on' : ''} onClick={() => setChart('line')}>Line</button>
            </div></div>
          {data.length ? (
            <div style={{ height: 320 }}>
              <ResponsiveContainer>
                {chart === 'bar' ? (
                  <BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" /><YAxis tickFormatter={tick} /><Tooltip formatter={(v) => inr(v)} />
                    <Bar dataKey="sales" name="Sales" radius={[4, 4, 0, 0]}>{data.map((d) => <Cell key={d.name} fill={colorOf(d.sales)} />)}</Bar>
                  </BarChart>
                ) : (
                  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" /><YAxis tickFormatter={tick} /><Tooltip formatter={(v) => inr(v)} />
                    <Line type="monotone" dataKey="sales" name="Sales" stroke="#2563eb" strokeWidth={2}
                      dot={({ cx, cy, payload, index }) => <circle key={index} cx={cx} cy={cy} r={6} fill={colorOf(payload.sales)} stroke="#fff" strokeWidth={2} />} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>) : <p className="muted center">No records for this filter.</p>}
          <p className="muted small legend"><i style={{ background: scale(0) }} /> lowest <i style={{ background: scale(1) }} /> highest</p>
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
