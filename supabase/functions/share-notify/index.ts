// Called by a Database Webhook on INSERT into share_requests. Emails the admin Approve / Deny links.
import { sign, esc, sendMail } from '../_shared/util.ts'

const SECRET = Deno.env.get('SIGNING_SECRET')!

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== SECRET) return new Response('forbidden', { status: 403 })
  const { record: r } = await req.json()
  if (!r?.id) return new Response('ignored')
  const app = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const link = async (a: string) => `${app}/share-action?id=${r.id}&action=${a}&sig=${await sign(SECRET, `${r.id}:${a}`)}`
  const btn = (href: string, label: string, bg: string) =>
    `<a href="${href}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:${bg};color:#fff;text-decoration:none;font-weight:600;margin-right:8px">${label}</a>`
  const html = `<div style="font-family:sans-serif;max-width:520px">
    <h2>New share request #${r.id}</h2>
    <p><b>${esc(r.requester_email)}</b> wants to share <b>${esc(r.data_scope_type === 'raw_export' ? 'a raw data export' : 'a filtered view')}</b>
    with <b>${esc(r.target_label)}</b> (${esc(r.target_type === 'internal_user' ? 'in-app user' : 'external email')}).</p>
    <p>Scope: ${esc(r.data_scope_filters?.label)}</p>
    <p>${btn(await link('approve'), 'Review & approve', '#15803d')}${btn(await link('deny'), 'Review & deny', '#b91c1c')}</p>
    <p style="color:#6b7280;font-size:12px">Nothing is shared until you confirm on the next page.</p></div>`
  try {
    await sendMail(Deno.env.get('ADMIN_EMAIL')!, `Share request #${r.id} needs your approval`, html)
    return new Response('sent')
  } catch (e) {
    return new Response(String(e.message ?? e), { status: 500 })
  }
})
