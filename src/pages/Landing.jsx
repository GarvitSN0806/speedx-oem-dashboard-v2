import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

const FEATURES = [
  ['Sales & profit tracking', 'Record every sale by direct units or bundles. Cost, selling price and gross profit are always calculated in one place.'],
  ['State-wise insights', 'See which states, zones, towns, companies and clients drive profit and which need attention, at a glance.'],
  ['MIS reports', 'Order, dispatch and pending quantities by party, SKU, category and print type, with live charts.'],
  ['Controlled sharing', 'Share a filtered view or a raw export with a teammate or an external email, released only after admin approval.'],
]

export default function Landing() {
  const { session, role } = useAuth()
  return (
    <div className="land">
      <div className="land-top"><span className="logo">S</span><strong>SpeedX OEM</strong></div>
      <section className="hero">
        <h1>Track sales, profit &amp; orders in one place</h1>
        <p>A single source of truth for your sales data, with live dashboards and order MIS your whole team can trust.</p>
        <div className="cta">
          {session ? (
            <Link className="btn" to={role === 'admin' ? '/admin' : '/dashboard'}>Open my workspace</Link>
          ) : (
            <>
              <Link className="btn" to="/dashboard">View Dashboard</Link>
              <Link className="btn alt" to="/admin/login">Admin Login</Link>
            </>
          )}
        </div>
      </section>
      <section className="feats">
        {FEATURES.map(([t, d]) => <div key={t} className="card feat"><h3>{t}</h3><p>{d}</p></div>)}
      </section>
    </div>
  )
}
