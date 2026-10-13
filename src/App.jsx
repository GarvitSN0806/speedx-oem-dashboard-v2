import { Routes, Route, Navigate, NavLink, Link } from 'react-router-dom'
import { useAuth } from './auth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Mis from './pages/Mis'
import Overall from './pages/Overall'
import ShareAction from './pages/ShareAction'
import Admin from './pages/Admin'

function Guard({ admin, children }) {
  const { session, role, loading } = useAuth()
  if (loading) return <p className="center muted">Loading…</p>
  if (!session) return <Navigate to={admin ? '/admin/login' : '/login'} replace />
  if (admin && role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

const NAV = [
  ['/dashboard', 'Sales & Profit'], ['/mis/party', 'Party-wise MIS'], ['/mis/sku', 'SKU-wise MIS'],
  ['/mis/category', 'Category-wise MIS'], ['/mis/print-type', 'Print Type-wise MIS'], ['/mis/salesperson', 'Salesperson MIS'], ['/mis/overall', 'Overall Summary']
]

function Header() {
  const { session, role, signOut } = useAuth()
  return (
    <header className="bar">
      <Link to="/" className="brand" onClick={() => window.location.reload()}><span className="logo">S</span>SpeedX OEM</Link>
      <nav>
        {NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        {session && <NavLink to="/shares">{role === 'admin' ? 'Share Requests' : 'My Shares'}</NavLink>}
        {session && role === 'admin' && <NavLink to="/admin">Manage records</NavLink>}
      </nav>
      <span className="grow" />
      {session ? (
        <>
          <span className="muted small">{session.user.email} · {role}</span>
          <button className="ghost" onClick={signOut}>Sign out</button>
        </>
      ) : (
        <Link className="btn sm" to="/admin/login">Admin Login</Link>
      )}
    </header>
  )
}

const mis = (path, title, source, keyCol, label) =>
  <Route key={path} path={path} element={<Mis key={source} title={title} source={source} keyCol={keyCol} label={label} />} />

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin/login" element={<Login admin />} />
        <Route path="/share-action" element={<ShareAction />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {mis('/mis/party', 'Party-wise MIS', 'v_party_mis', 'client', 'Party / client')}
        {mis('/mis/sku', 'SKU-wise MIS', 'v_sku_mis', 'sku', 'SKU')}
        {mis('/mis/category', 'Category-wise MIS', 'v_category_mis', 'category', 'Category')}
        {mis('/mis/print-type', 'Print Type-wise MIS', 'v_print_mis', 'print_type', 'Print type')}
        {mis('/mis/salesperson', 'Salesperson MIS', 'v_salesperson_mis', 'salesperson', 'Salesperson')}
        <Route path="/mis/overall" element={<Overall />} />
        <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
