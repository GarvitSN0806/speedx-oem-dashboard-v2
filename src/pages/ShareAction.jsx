import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { callResolve } from '../lib'

export default function ShareAction() {
  const [p] = useSearchParams()
  const id = Number(p.get('id')), action = p.get('action'), sig = p.get('sig')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async () => { setBusy(true); setRes(await callResolve({ id, action, sig })); setBusy(false) }
  const valid = id && ['approve', 'deny'].includes(action) && sig

  return (
    <div className="login">
      <div className="card">
        <h2>{action === 'deny' ? 'Deny' : 'Approve'} share request #{id || '?'}</h2>
        {!valid && <p className="notice">This link is incomplete.</p>}
        {valid && !res && <>
          <p>{action === 'approve' ? 'Approving sends the data to the target.' : 'Denying shares nothing.'} Confirm to continue.</p>
          <button className={action === 'deny' ? 'danger' : ''} disabled={busy} onClick={run}>{busy ? 'Working…' : `Confirm ${action}`}</button>
        </>}
        {res?.error && <p className="notice">{res.error}</p>}
        {res?.status && <p className="notice">{res.already ? `Already resolved: ${res.status}.` : `Request ${res.status}.`}</p>}
        <Link className="small" to="/">← Home</Link>
      </div>
    </div>
  )
}
