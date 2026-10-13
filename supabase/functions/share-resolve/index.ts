// Approve / deny a share request. Auth: signed email link (sig) OR the admin's logged-in session.
// Only on approval does an external share go out.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { sign, safeEqual, esc, sendMail } from '../_shared/util.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const ORDER: Record<string, string[]> = {
  sales: ['date', 'id'],
  v_sales_daily: ['date', 'state', 'zone', 'town_city', 'company', 'client'],
}

async function fetchAll(table: string, f: { from?: string; to?: string; state?: string }) {
  const out: any[] = []
  for (let i = 0; ; i += 1000) {
    let q = db.from(table).select('*')
    ORDER[table].forEach((c) => (q = q.order(c)))
    if (f.from) q = q.gte('date', f.from)
    if (f.to) q = q.lte('date', f.to)
    if (f.state) q = q.eq('state', f.state)
    const { data, error } = await q.range(i, i + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
    if (out.length > 100000) throw new Error('Export too large (over 100,000 rows)')
  }
  return out
}

const toCsv = (rows: any[]) => {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const cell = (v: any) => {
    let s = v == null ? '' : String(v)
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

async function deliver(r: any) {
  const f = r.data_scope_filters ?? {}
  const label = esc(f.label)
  const head = `<p>${esc(r.requester_email)} shared data with you (approved by the admin).<br>Scope: ${label}</p>`
  if (r.data_scope_type === 'raw_export') {
    const rows = await fetchAll('sales', f)
    const csv = toCsv(rows)
    await sendMail(r.target_value, 'Sales data export', `${head}<p>${rows.length} records attached as CSV.</p>`,
      [{ filename: 'sales-export.csv', content: encodeBase64(new TextEncoder().encode(csv)) }])
    return
  }
  const rows = await fetchAll('v_sales_daily', f)
  const by: Record<string, { u: number; s: number; c: number; p: number }> = {}
  const t = { u: 0, s: 0, c: 0, p: 0 }
  for (const x of rows) {
    const a = (by[x.state] ||= { u: 0, s: 0, c: 0, p: 0 })
    for (const [k, v] of [['u', x.total_units], ['s', x.total_selling], ['c', x.total_cost], ['p', x.gross_profit]] as const) {
      a[k] += Number(v); t[k] += Number(v)
    }
  }
  const td = 'padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right'
  const tr = (n: string, a: typeof t) => `<tr><td style="${td};text-align:left">${esc(n)}</td><td style="${td}">${a.u}</td><td style="${td}">${inr(a.c)}</td><td style="${td}">${inr(a.s)}</td><td style="${td}">${inr(a.p)}</td></tr>`
  const table = `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px"><tr><th style="${td};text-align:left">State</th><th style="${td}">Units</th><th style="${td}">Cost</th><th style="${td}">Selling</th><th style="${td}">Gross profit</th></tr>
    ${Object.entries(by).sort((a, b) => b[1].s - a[1].s).map(([n, a]) => tr(n, a)).join('')}${tr('Total', t)}</table>`
  await sendMail(r.target_value, 'Sales & profit summary', `${head}${table}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { id, action, sig } = await req.json()
    if (!id || !['approve', 'deny'].includes(action)) return json({ error: 'Bad request' }, 400)
    if (sig) {
      const exp = await sign(Deno.env.get('SIGNING_SECRET')!, `${id}:${action}`)
      if (!safeEqual(exp, String(sig))) return json({ error: 'Invalid or tampered link' }, 403)
    } else {
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
      const { data: u } = await db.auth.getUser(token)
      const { data: p } = u.user ? await db.from('profiles').select('role').eq('id', u.user.id).single() : { data: null }
      if (p?.role !== 'admin') return json({ error: 'Admin only' }, 403)
    }
    const status = action === 'approve' ? 'approved' : 'denied'
    const { data: row } = await db.from('share_requests')
      .update({ status, resolved_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending').select().maybeSingle()
    if (!row) {
      const { data: cur } = await db.from('share_requests').select('status').eq('id', id).maybeSingle()
      return json({ status: cur?.status ?? 'not_found', already: true })
    }
    if (status === 'approved' && row.target_type === 'external_email') {
      try { await deliver(row) } catch (e) {
        await db.from('share_requests').update({ status: 'pending', resolved_at: null }).eq('id', row.id)
        return json({ error: `Email delivery failed, request left pending: ${e.message ?? e}` }, 502)
      }
    }
    return json({ status })
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 500)
  }
})
