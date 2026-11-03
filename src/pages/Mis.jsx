import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from 'recharts'
import { aggregate, num, scale, COLORS } from '../lib'
import { FilterBar, Gate, useRows } from '../filters'

function ChartSelector({ value, onChange }) {
  return (
    <div className="toggle">
      <button className={value === 'bar'  ? 'on' : ''} onClick={() => onChange('bar')}>Bar</button>
      <button className={value === 'line' ? 'on' : ''} onClick={() => onChange('line')}>Line</button>
      <button className={value === 'pie'  ? 'on' : ''} onClick={() => onChange('pie')}>Pie</button>
    </div>
  )
}

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
            background: 'none', boxShadow: 'none', padding: '0 4px',
            color: 'var(--muted)', fontSize: 16, lineHeight: 1,
          }}
        >✕</button>
      )}
    </div>
  )
}

export default function Mis({ title, source, keyCol, label, defaultChart = 'bar' }) {
  const { rows, loading, err, range } = useRows(source)
  const [chartType, setChartType] = useState(defaultChart)
  const [search, setSearch] = useState('')

  const allData = useMemo(() => aggregate(rows, keyCol), [rows, keyCol])

  const data = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allData
    return allData.filter((d) => d.name.toLowerCase().includes(q))
  }, [allData, search])

  const tot = data.reduce(
    (a, d) => ({ order: a.order + d.order, dispatch: a.dispatch + d.dispatch, pending: a.pending + d.pending }),
    { order: 0, dispatch: 0, pending: 0 }
  )
  const pct = (d) => (d.order ? (d.dispatch / d.order) * 100 : 0)
  const chartData = data.slice(0, 15)

  return (
    <main className="page">
      <h2 className="title">{title}</h2>
      <FilterBar />
      <Gate range={range} loading={loading} err={err}>
        {allData.length ? (
          <>
            {/* Search bar */}
            <section className="card filters" style={{ alignItems: 'center' }}>
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
            </section>

            {/* Chart */}
            <section className="card">
              <div className="row">
                <h3>
                  Order vs dispatch vs pending
                  {search ? ` · "${search}"` : (data.length > 15 ? ' (top 15 by order qty)' : '')}
                </h3>
                <span className="grow" />
                <ChartSelector value={chartType} onChange={setChartType} />
              </div>
              {data.length === 0 ? (
                <p className="muted center">No results for "{search}".</p>
              ) : (
                <div style={{ height: 340 }}>
                  <ResponsiveContainer>
                    {chartType === 'pie' ? (
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={100} dataKey="order" nameKey="name" label>
                          {chartData.map((_, i) => <Cell key={i} fill={`hsl(${i * 60}, 70%, 50%)`} />)}
                        </Pie>
                        <Tooltip formatter={(v) => num(v)} />
                      </PieChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={70} />
                        <YAxis /><Tooltip formatter={(v) => num(v)} /><Legend verticalAlign="top" />
                        <Line type="monotone" dataKey="order"    name="Order"    stroke={COLORS.order}    strokeWidth={3} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="dispatch" name="Dispatch" stroke={COLORS.dispatch} strokeWidth={3} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="pending"  name="Pending"  stroke={COLORS.pending}  strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={70} />
                        <YAxis /><Tooltip formatter={(v) => num(v)} /><Legend verticalAlign="top" />
                        <Bar dataKey="order"    name="Order"    fill={COLORS.order}    radius={[3, 3, 0, 0]} />
                        <Bar dataKey="dispatch" name="Dispatch" fill={COLORS.dispatch} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="pending"  name="Pending"  fill={COLORS.pending}  radius={[3, 3, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Table */}
            <section className="card">
              <div className="row" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{title} table</h3>
                {search && <span className="muted small">Showing results for "{search}"</span>}
              </div>
              <div className="scroll tall">
                <table>
                  <thead>
                    <tr>
                      <th>{label}</th>
                      <th className="r">Order</th>
                      <th className="r">Dispatch</th>
                      <th className="r">Pending</th>
                      <th className="r">Fulfilment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr><td colSpan={5} className="muted center">No results for "{search}".</td></tr>
                    ) : data.map((d) => (
                      <tr key={d.name}>
                        <td>{d.name}</td>
                        <td className="r">{num(d.order)}</td>
                        <td className="r pos">{num(d.dispatch)}</td>
                        <td className={`r ${d.pending > 0 ? 'neg' : ''}`}>{num(d.pending)}</td>
                        <td className="r"><b style={{ color: scale(pct(d) / 100) }}>{pct(d).toFixed(0)}%</b></td>
                      </tr>
                    ))}
                    {data.length > 0 && (
                      <tr className="total">
                        <td>Total {search ? '(filtered)' : ''}</td>
                        <td className="r">{num(tot.order)}</td>
                        <td className="r pos">{num(tot.dispatch)}</td>
                        <td className="r neg">{num(tot.pending)}</td>
                        <td className="r">{pct(tot).toFixed(0)}%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <p className="muted center">No records for this filter.</p>
        )}
      </Gate>
    </main>
  )
}
