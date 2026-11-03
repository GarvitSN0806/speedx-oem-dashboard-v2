import { useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { aggregate, num, scale, COLORS } from '../lib'
import { FilterBar, Gate, useRows } from '../filters'

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

export default function Overall() {
  const { rows, loading, err, range } = useRows('v_overall_mis')
  const [search, setSearch] = useState('')

  const allStateData = useMemo(() => aggregate(rows, 'state'), [rows])

  const stateData = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allStateData
    return allStateData.filter((d) => d.name.toLowerCase().includes(q))
  }, [allStateData, search])

  const t = useMemo(() => {
    return stateData.reduce(
      (a, d) => ({ order: a.order + d.order, dispatch: a.dispatch + d.dispatch, pending: a.pending + d.pending }),
      { order: 0, dispatch: 0, pending: 0 }
    )
  }, [stateData])

  const pie = [
    { name: 'Dispatched', value: t.dispatch, color: COLORS.dispatch },
    { name: 'Pending', value: t.pending, color: COLORS.pending }
  ]
  const pct = t.order ? ((t.dispatch / t.order) * 100).toFixed(1) : '0.0'
  const rowPct = (d) => (d.order ? (d.dispatch / d.order) * 100 : 0)

  return (
    <main className="page">
      <h2 className="title">Overall Summary</h2>
      <FilterBar />
      <Gate range={range} loading={loading} err={err}>
        {allStateData.length ? (
          <>
            {/* Search Bar */}
            <section className="card filters" style={{ alignItems: 'center' }}>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search state…"
              />
              {search && (
                <span className="muted small">
                  {stateData.length} of {allStateData.length} state{stateData.length !== 1 ? 's' : ''}
                </span>
              )}
            </section>

            {/* KPI Stats */}
            <section className="card">
              <div className="stats three">
                <div><span>Total order</span><b style={{ color: COLORS.order }}>{num(t.order)}</b></div>
                <div><span>Total dispatch</span><b className="pos">{num(t.dispatch)}</b></div>
                <div><span>Total pending</span><b className="neg">{num(t.pending)}</b></div>
              </div>
            </section>

            {/* Chart */}
            <section className="card">
              <h3>
                Dispatched vs pending ({pct}% fulfilled)
                {search ? ` · "${search}"` : ''}
              </h3>
              {t.order ? (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={115}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => num(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="muted center">No records for "{search}".</p>
              )}
            </section>

            {/* State breakdown table */}
            <section className="card">
              <div className="row" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>State Breakdown</h3>
                {search && <span className="muted small">Showing results for "{search}"</span>}
              </div>
              <div className="scroll tall">
                <table>
                  <thead>
                    <tr>
                      <th>State</th>
                      <th className="r">Order</th>
                      <th className="r">Dispatch</th>
                      <th className="r">Pending</th>
                      <th className="r">Fulfilment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stateData.length === 0 ? (
                      <tr><td colSpan={5} className="muted center">No results for "{search}".</td></tr>
                    ) : stateData.map((d) => (
                      <tr key={d.name}>
                        <td>{d.name}</td>
                        <td className="r">{num(d.order)}</td>
                        <td className="r pos">{num(d.dispatch)}</td>
                        <td className={`r ${d.pending > 0 ? 'neg' : ''}`}>{num(d.pending)}</td>
                        <td className="r"><b style={{ color: scale(rowPct(d) / 100) }}>{rowPct(d).toFixed(0)}%</b></td>
                      </tr>
                    ))}
                    {stateData.length > 0 && (
                      <tr className="total">
                        <td>Total {search ? '(filtered)' : ''}</td>
                        <td className="r">{num(t.order)}</td>
                        <td className="r pos">{num(t.dispatch)}</td>
                        <td className="r neg">{num(t.pending)}</td>
                        <td className="r">{pct}%</td>
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
