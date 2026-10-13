import { useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { aggregate, num, COLORS } from '../lib'
import { FilterBar, Gate, useRows } from '../filters'

export default function Overall() {
  const { rows, loading, err, range } = useRows('v_overall_mis')
  const t = useMemo(() => aggregate(rows.map((r) => ({ ...r, all: 'all' })), 'all')[0] || { order: 0, dispatch: 0, pending: 0 }, [rows])
  const pie = [{ name: 'Dispatched', value: t.dispatch, color: COLORS.dispatch }, { name: 'Pending', value: t.pending, color: COLORS.pending }]
  const pct = t.order ? ((t.dispatch / t.order) * 100).toFixed(1) : '0.0'

  return (
    <main className="page">
      <h2 className="title">Overall Summary</h2>
      <FilterBar />
      <Gate range={range} loading={loading} err={err}>
        <section className="card">
          <div className="stats three">
            <div><span>Total order</span><b style={{ color: COLORS.order }}>{num(t.order)}</b></div>
            <div><span>Total dispatch</span><b className="pos">{num(t.dispatch)}</b></div>
            <div><span>Total pending</span><b className="neg">{num(t.pending)}</b></div>
          </div>
        </section>
        <section className="card">
          <h3>Dispatched vs pending ({pct}% fulfilled)</h3>
          {t.order ? (
            <div style={{ height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={70} outerRadius={115} paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => num(v)} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>) : <p className="muted center">No records for this filter.</p>}
        </section>
      </Gate>
    </main>
  )
}
