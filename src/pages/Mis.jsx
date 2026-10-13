import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { aggregate, num, scale, COLORS } from '../lib'
import { FilterBar, Gate, useRows } from '../filters'

export default function Mis({ title, source, keyCol, label }) {
  const { rows, loading, err, range } = useRows(source)
  const data = useMemo(() => aggregate(rows, keyCol), [rows, keyCol])
  const tot = data.reduce((a, d) => ({ order: a.order + d.order, dispatch: a.dispatch + d.dispatch, pending: a.pending + d.pending }), { order: 0, dispatch: 0, pending: 0 })
  const pct = (d) => (d.order ? (d.dispatch / d.order) * 100 : 0)

  return (
    <main className="page">
      <h2 className="title">{title}</h2>
      <FilterBar />
      <Gate range={range} loading={loading} err={err}>
        {data.length ? <>
          <section className="card">
            <h3>Order vs dispatch vs pending{data.length > 15 ? ' (top 15 by order qty)' : ''}</h3>
            <div style={{ height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={data.slice(0, 15)} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis /><Tooltip formatter={(v) => num(v)} /><Legend verticalAlign="top" />
                  <Bar dataKey="order" name="Order" fill={COLORS.order} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="dispatch" name="Dispatch" fill={COLORS.dispatch} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" fill={COLORS.pending} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card">
            <h3>{title} table</h3>
            <div className="scroll tall">
              <table>
                <thead><tr><th>{label}</th><th className="r">Order</th><th className="r">Dispatch</th><th className="r">Pending</th><th className="r">Fulfilment</th></tr></thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.name}>
                      <td>{d.name}</td><td className="r">{num(d.order)}</td><td className="r pos">{num(d.dispatch)}</td>
                      <td className={`r ${d.pending > 0 ? 'neg' : ''}`}>{num(d.pending)}</td>
                      <td className="r"><b style={{ color: scale(pct(d) / 100) }}>{pct(d).toFixed(0)}%</b></td>
                    </tr>))}
                  <tr className="total"><td>Total</td><td className="r">{num(tot.order)}</td><td className="r pos">{num(tot.dispatch)}</td>
                    <td className="r neg">{num(tot.pending)}</td><td className="r">{pct(tot).toFixed(0)}%</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </> : <p className="muted center">No records for this filter.</p>}
      </Gate>
    </main>
  )
}
