import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { useFilters } from '../filters'
import { callResolve, describeFilters, downloadCsv, fetchRows, filtersFromScope } from '../lib'

const Badge = ({ s }) => <span className={`badge ${s}`}>{s}</span>
const when = (t) => (t ? new Date(t).toLocaleString() : '—')
const targetOf = (r) => `${r.target_type === 'internal_user' ? 'User' : 'Email'}: ${r.target_label || r.target_value}`
const kind = (r) => (r.data_scope_type === 'raw_export' ? 'Raw export' : 'Filtered view')

export default function Shares() {
  const { session, role } = useAuth()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const load = useCallback(() =>
    supabase.from('share_requests').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => (error ? setErr(error.message) : setRows(data))), [])
  useEffect(() => { load() }, [load])

  return (
    <main className="page">
      {err && <p className="notice">{err}</p>}
      {role === 'admin' ? <AdminQueue rows={rows} reload={load} /> : <UserShares rows={rows} uid={session.user.id} reload={load} />}
    </main>
  )
}

function AdminQueue({ rows, reload }) {
  const [tab, setTab] = useState('pending')
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const shown = tab === 'all' ? rows : rows.filter((r) => r.status === tab)

  async function act(r, action) {
    if (!window.confirm(`${action === 'approve' ? 'Approve' : 'Deny'} request #${r.id}?`)) return
    setBusy(r.id); setMsg('')
    const res = await callResolve({ id: r.id, action })
    setBusy(null)
    setMsg(res.error || (res.already ? `Request was already ${res.status}.` : `Request #${r.id} ${res.status}.`))
    reload()
  }

  return (
    <section className="card">
      <div className="row"><h3>Share requests</h3><span className="grow" />
        <div className="toggle">{['pending', 'approved', 'denied', 'all'].map((t) =>
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}{t !== 'all' ? ` (${rows.filter((r) => r.status === t).length})` : ''}</button>)}</div>
        <button className="ghost" onClick={reload}>Refresh</button></div>
      {msg && <p className="notice">{msg}</p>}
      <div className="scroll"><table>
        <thead><tr><th>#</th><th>Requested by</th><th>Target</th><th>Type</th><th>Scope</th><th>Status</th><th>Requested</th><th>Resolved</th><th /></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td><td>{r.requester_email}</td><td>{targetOf(r)}</td><td>{kind(r)}</td>
              <td>{r.data_scope_filters?.label}</td><td><Badge s={r.status} /></td><td>{when(r.created_at)}</td><td>{when(r.resolved_at)}</td>
              <td className="nowrap">{r.status === 'pending' && <>
                <button className="sm" disabled={busy === r.id} onClick={() => act(r, 'approve')}>Approve</button>{' '}
                <button className="danger sm" disabled={busy === r.id} onClick={() => act(r, 'deny')}>Deny</button></>}</td>
            </tr>))}
          {!shown.length && <tr><td colSpan="9" className="muted center">Nothing here.</td></tr>}
        </tbody></table></div>
    </section>
  )
}

function UserShares({ rows, uid, reload }) {
  const nav = useNavigate()
  const { setF } = useFilters()
  const mine = rows.filter((r) => r.requested_by === uid)
  const incoming = rows.filter((r) => r.requested_by !== uid && r.status === 'approved')

  return (<>
    <NewShare uid={uid} onDone={reload} />
    <section className="card">
      <div className="row"><h3>My requests</h3><span className="grow" /><button className="ghost" onClick={reload}>Refresh</button></div>
      <div className="scroll"><table>
        <thead><tr><th>#</th><th>Target</th><th>Type</th><th>Scope</th><th>Status</th><th>Requested</th><th>Resolved</th></tr></thead>
        <tbody>
          {mine.map((r) => <tr key={r.id}><td>{r.id}</td><td>{targetOf(r)}</td><td>{kind(r)}</td><td>{r.data_scope_filters?.label}</td>
            <td><Badge s={r.status} /></td><td>{when(r.created_at)}</td><td>{when(r.resolved_at)}</td></tr>)}
          {!mine.length && <tr><td colSpan="7" className="muted center">No requests yet.</td></tr>}
        </tbody></table></div>
    </section>
    <section className="card">
      <h3>Shared with me</h3>
      <div className="scroll"><table>
        <thead><tr><th>From</th><th>Type</th><th>Scope</th><th>Approved</th><th /></tr></thead>
        <tbody>
          {incoming.map((r) => (
            <tr key={r.id}><td>{r.requester_email}</td><td>{kind(r)}</td><td>{r.data_scope_filters?.label}</td><td>{when(r.resolved_at)}</td>
              <td>{r.data_scope_type === 'filtered_view'
                ? <button className="sm" onClick={() => { setF(filtersFromScope(r.data_scope_filters)); nav('/dashboard') }}>Open view</button>
                : <button className="sm" onClick={async () => downloadCsv('sales-export.csv', await fetchRows('sales', r.data_scope_filters))}>Download CSV</button>}</td></tr>))}
          {!incoming.length && <tr><td colSpan="5" className="muted center">Nothing shared with you yet.</td></tr>}
        </tbody></table></div>
    </section>
  </>)
}

function NewShare({ uid, onDone }) {
  const { f, range } = useFilters()
  const [stype, setStype] = useState('filtered_view')
  const [ttype, setTtype] = useState('internal_user')
  const [target, setTarget] = useState('')
  const [users, setUsers] = useState([])
  const [msg, setMsg] = useState('')
  useEffect(() => { supabase.rpc('share_targets').then(({ data }) => setUsers(data || [])) }, [])

  async function submit(e) {
    e.preventDefault(); setMsg('')
    const { error } = await supabase.from('share_requests').insert({
      requested_by: uid, target_type: ttype, target_value: target.trim(),
      data_scope_type: stype, data_scope_filters: { ...range, label: describeFilters(f) },
    })
    if (error) return setMsg(error.message)
    setMsg('Request sent. The admin has been emailed; nothing is shared until they approve.')
    setTarget(''); onDone()
  }

  return (
    <section className="card">
      <h3>New share request</h3>
      <p className="muted small">Scope uses the filters currently set on the dashboard: <b>{range ? describeFilters(f) : 'incomplete filter (pick a date, month or range first)'}</b></p>
      <form onSubmit={submit} className="grid">
        <label>What to share
          <select value={stype} onChange={(e) => setStype(e.target.value)}>
            <option value="filtered_view">Filtered view (summary)</option><option value="raw_export">Raw export (CSV)</option></select></label>
        <label>Share with
          <select value={ttype} onChange={(e) => { setTtype(e.target.value); setTarget('') }}>
            <option value="internal_user">User in this app</option><option value="external_email">External email</option></select></label>
        {ttype === 'internal_user'
          ? <label>User<select required value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select a user…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}</select></label>
          : <label>Email<input type="email" required value={target} onChange={(e) => setTarget(e.target.value)} /></label>}
        <div className="actions"><button disabled={!range}>Send request</button></div>
      </form>
      {msg && <p className="notice">{msg}</p>}
    </section>
  )
}
