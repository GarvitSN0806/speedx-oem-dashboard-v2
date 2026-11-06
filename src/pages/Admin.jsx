import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from '../supabase'
import { fetchSales, inr, num } from '../lib'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const empty = () => ({
  date: today(), client: '', state: '', town_city: '', salesperson: '',
  sku: '', item: '', category: '', capacity: '', box: '', color: '', print_type: '',
  order_qty: '', dispatch_qty: '',
  selling_price_per_unit: '', cost_price_per_unit: '',
  cap: '', pouch: '', order_status: '', dispatch_date: '', remarks: '',
  entry_mode: 'direct', units_sold: '', bundles: '', units_per_bundle: '',
  zone: '', company: '',
})
// Fields in ORDER LIST column order
const TEXT_MAIN = [
  ['client',      'Party Name'],
  ['state',       'State'],
  ['town_city',   'City'],
  ['salesperson', 'Concerned Person'],
  ['sku',         'SKU'],
  ['item',        'Item'],
  ['category',    'Category'],
  ['capacity',    'Capacity'],
  ['box',         'Box'],
  ['color',       'Color'],
  ['print_type',  'Print Type'],
]
const TEXT_META = [
  ['cap',   'Cap'],
  ['pouch', 'Pouch'],
  ['remarks', 'Remarks'],
]
const TEXT_HIDDEN = [['zone', 'Zone'], ['company', 'Company']]

export default function Admin() {
  const [form, setForm] = useState(empty())
  const [editId, setEditId] = useState(null)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [delParams, setDelParams] = useState({ mode: 'month', day: '', month: '', start: '', end: '' })
  const fileInputRef = useRef(null)

  const load = () => fetchSales().then(setRows).catch((e) => setMsg(e.message))
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const bundle = form.entry_mode === 'bundle'
  const units = bundle ? (+form.bundles || 0) * (+form.units_per_bundle || 0) : +form.units_sold || 0
  const profit = units * ((+form.selling_price_per_unit || 0) - (+form.cost_price_per_unit || 0))

  async function submit(e) {
    e.preventDefault(); setMsg('')
    const payload = {
      date: form.date,
      client: form.client.trim(), state: form.state.trim(), town_city: form.town_city.trim(),
      salesperson: form.salesperson.trim(), zone: form.zone.trim(), company: form.company.trim(),
      sku: form.sku.trim(), item: form.item.trim(), category: form.category.trim(),
      capacity: form.capacity.trim(), box: form.box.trim(), color: form.color.trim(),
      print_type: form.print_type.trim(),
      order_qty: +form.order_qty, dispatch_qty: +form.dispatch_qty,
      selling_price_per_unit: +form.selling_price_per_unit,
      cost_price_per_unit: +form.cost_price_per_unit,
      cap: form.cap.trim(), pouch: form.pouch.trim(),
      order_status: form.order_status.trim(),
      dispatch_date: form.dispatch_date || null,
      remarks: form.remarks.trim(),
      entry_mode: form.entry_mode,
      units_sold: bundle ? null : +form.units_sold,
      bundles: bundle ? +form.bundles : null,
      units_per_bundle: bundle ? +form.units_per_bundle : null,
    }
    const { error } = editId
      ? await supabase.from('sales').update(payload).eq('id', editId)
      : await supabase.from('sales').insert(payload)
    if (error) return setMsg(error.message)
    setMsg(editId ? 'Record updated.' : 'Record added.')
    setForm(empty()); setEditId(null); load()
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg('Reading file...')
    try {
      const { read, utils } = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = read(data, { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = utils.sheet_to_json(ws)

      if (!json.length) throw new Error('File is empty.')

      const keyMap = {
        // date
        date: 'date', orderdate: 'date',
        // party / client
        client: 'client', party: 'client', partyname: 'client',
        // location
        state: 'state',
        city: 'town_city', town: 'town_city', towncity: 'town_city',
        zone: 'zone',
        // people
        salesperson: 'salesperson', rep: 'salesperson', agent: 'salesperson',
        concernedperson: 'salesperson',
        company: 'company',
        // product
        sku: 'sku',
        item: 'item',
        category: 'category',
        capacity: 'capacity',
        box: 'box',
        color: 'color',
        printtype: 'print_type', print: 'print_type',
        // qty
        orderqty: 'order_qty', order: 'order_qty',
        dispatchqty: 'dispatch_qty', dispatch: 'dispatch_qty',
        pendingqty: 'pending_qty',
        // pricing (order list uses per-unit prices)
        sellingprice: 'selling_price_per_unit', selling: 'selling_price_per_unit',
        sellingpriceperunit: 'selling_price_per_unit', sellingpriceunit: 'selling_price_per_unit',
        costprice: 'cost_price_per_unit', cost: 'cost_price_per_unit',
        costpriceperunit: 'cost_price_per_unit', costpriceunit: 'cost_price_per_unit',
        // entry mode (manual add only)
        entrymode: 'entry_mode', mode: 'entry_mode',
        unitssold: 'units_sold', units: 'units_sold',
        bundles: 'bundles', unitsperbundle: 'units_per_bundle',
        // order list extras
        cap: 'cap',
        pouch: 'pouch',
        orderstatus: 'order_status',
        dispatchdate: 'dispatch_date',
        remarks: 'remarks',
      }

      const parsed = json.map(r => {
        const row = { entry_mode: 'direct' }
        for (const [k, v] of Object.entries(r)) {
          if (v == null || v === '') continue
          const canonical = k.toLowerCase().replace(/[^a-z]/g, '')
          const prop = keyMap[canonical]
          if (!prop) continue

          if (prop === 'date' || prop === 'dispatch_date') {
            let d = v
            if (typeof v === 'number') d = new Date(Math.round((v - 25569) * 86400 * 1000))
            else if (!(v instanceof Date)) d = new Date(v)
            if (d instanceof Date && !isNaN(d)) row[prop] = d.toISOString().slice(0, 10)
            else row[prop] = String(v)
          } else if (prop === 'pending_qty') {
            // skip — calculated by the database
          } else if (['order_qty', 'dispatch_qty', 'units_sold', 'bundles', 'units_per_bundle'].includes(prop)) {
            row[prop] = Math.max(0, parseInt(v, 10) || 0)
          } else if (['cost_price_per_unit', 'selling_price_per_unit'].includes(prop)) {
            row[prop] = Math.max(0, parseFloat(v) || 0)
          } else {
            row[prop] = String(v).trim()
          }
        }

        row.entry_mode = String(row.entry_mode).toLowerCase() === 'bundle' ? 'bundle' : 'direct'
        if (row.entry_mode === 'bundle') {
          row.bundles = row.bundles || 0; row.units_per_bundle = row.units_per_bundle || 0; row.units_sold = null;
        } else {
          row.units_sold = row.units_sold || 0; row.bundles = null; row.units_per_bundle = null;
        }

        if (!row.date) row.date = today()
        for (const k of ['state', 'zone', 'town_city', 'company', 'client', 'sku', 'category', 'print_type', 'item', 'capacity', 'box', 'color', 'cap', 'pouch', 'order_status', 'remarks']) {
          row[k] = row[k] || ''
        }
        row.order_qty = row.order_qty || 0
        row.dispatch_qty = Math.min(row.dispatch_qty || 0, row.order_qty)
        row.cost_price_per_unit = row.cost_price_per_unit || 0
        row.selling_price_per_unit = row.selling_price_per_unit || 0
        if (!row.dispatch_date) row.dispatch_date = null

        return row
      })

      for (let i = 0; i < parsed.length; i += 1000) {
        setMsg(`Uploading chunk ${Math.floor(i / 1000) + 1} / ${Math.ceil(parsed.length / 1000)}...`)
        const { error } = await supabase.from('sales').insert(parsed.slice(i, i + 1000))
        if (error) throw error
      }
      setMsg(`Successfully uploaded ${parsed.length} records.`)
      load()
    } catch(err) {
      setMsg(`Upload failed: ${err.message}`)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function edit(r) {
    setEditId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' })
    setForm(Object.fromEntries(Object.keys(empty()).map((k) => [k, r[k] ?? ''])))
  }

  async function remove(r) {
    if (!window.confirm(`Delete record #${r.id} (${r.client}, ${r.date})? This cannot be undone.`)) return
    const { error } = await supabase.from('sales').delete().eq('id', r.id)
    if (error) return setMsg(error.message)
    load()
  }

  async function executeBulkDelete() {
    let qBase = supabase.from('sales').delete()
    let desc = ''

    if (delParams.mode === 'all') {
      desc = "ALL time (wipe database completely)"
      qBase = qBase.gt('id', -1)
    } else if (delParams.mode === 'day') {
      if (!delParams.day) return setMsg('Please select a date.')
      desc = `the date ${delParams.day}`
      qBase = qBase.eq('date', delParams.day)
    } else if (delParams.mode === 'month') {
      if (!delParams.month) return setMsg('Please select a month.')
      const [y, m] = delParams.month.split('-').map(Number)
      const from = `${delParams.month}-01`
      const to = `${delParams.month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
      desc = `the month of ${delParams.month}`
      qBase = qBase.gte('date', from).lte('date', to)
    } else if (delParams.mode === 'range') {
      if (!delParams.start || !delParams.end) return setMsg('Please select start and end dates.')
      desc = `the range ${delParams.start} to ${delParams.end}`
      qBase = qBase.gte('date', delParams.start).lte('date', delParams.end)
    }

    if (!window.confirm(`WARNING: Are you sure you want to officially delete records for ${desc}? This action cannot be undone.`)) return

    const { error } = await qBase
    if (error) return setMsg(error.message)

    setMsg(`Records for ${desc} have been successfully deleted.`)
    setDeleteMode(false)
    load()
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? rows.filter((r) => [r.state, r.zone, r.town_city, r.company, r.client, r.sku, r.date].join(' ').toLowerCase().includes(s)) : rows
    return list.slice(0, 100)
  }, [rows, q])

  return (
    <main className="page">
      <section className="cols" style={{ gridTemplateColumns: '1fr' }}>
        <div className="card">
          <div className="row">
            <h3>{editId ? `Edit record #${editId}` : 'Add sales record'}</h3>
            <span className="grow" />
            {!editId && (
              <label className="btn alt sm" style={{ cursor: 'pointer', display: 'inline-block', margin: 0, fontWeight: 600 }}>
                {uploading ? 'Uploading...' : 'Bulk Upload Excel/CSV'}
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                  disabled={uploading}
                  ref={fileInputRef}
                />
              </label>
            )}
          </div>
          <form onSubmit={submit} className="grid" style={{ marginTop: 12 }}>
            {/* Row 1: Order Date */}
            <label>Order Date<input type="date" required value={form.date} onChange={set('date')} /></label>

            {/* Main ORDER LIST fields */}
            {TEXT_MAIN.map(([k, l]) => <label key={k}>{l}<input value={form[k]} onChange={set(k)} /></label>)}

            {/* Quantities — ORDER LIST columns */}
            <label>Order Qty<input type="number" min="0" required value={form.order_qty} onChange={set('order_qty')} /></label>
            <label>Dispatch Qty<input type="number" min="0" max={form.order_qty || undefined} required value={form.dispatch_qty} onChange={set('dispatch_qty')} /></label>

            {/* Pricing — ORDER LIST columns: Selling Price, Cost Price */}
            <label>Selling Price<input type="number" min="0" step="0.01" required value={form.selling_price_per_unit} onChange={set('selling_price_per_unit')} /></label>
            <label>Cost Price<input type="number" min="0" step="0.01" required value={form.cost_price_per_unit} onChange={set('cost_price_per_unit')} /></label>

            {/* Order list extras */}
            {TEXT_META.map(([k, l]) => <label key={k}>{l}<input value={form[k]} onChange={set(k)} /></label>)}
            <label>Order Status
              <select value={form.order_status} onChange={set('order_status')}>
                <option value="">—</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Complete">Complete</option>
              </select>
            </label>
            <label>Dispatch Date<input type="date" value={form.dispatch_date} onChange={set('dispatch_date')} /></label>

            {/* Hidden fields (Zone / Company) — kept for backward compat */}
            {TEXT_HIDDEN.map(([k, l]) => <label key={k}>{l}<input value={form[k]} onChange={set(k)} /></label>)}

            {/* Units entry mode (for manual data not in order list) */}
            <label>Entry mode
              <select value={form.entry_mode} onChange={set('entry_mode')}>
                <option value="direct">Direct (units)</option><option value="bundle">Bundle</option>
              </select></label>
            {bundle ? <>
              <label>Bundles<input type="number" min="0" required value={form.bundles} onChange={set('bundles')} /></label>
              <label>Units per bundle<input type="number" min="0" required value={form.units_per_bundle} onChange={set('units_per_bundle')} /></label>
            </> : <label>Units sold<input type="number" min="0" required value={form.units_sold} onChange={set('units_sold')} /></label>}

            <div className="preview">Preview: {num(units)} units · profit <b className={profit < 0 ? 'neg' : 'pos'}>{inr(profit)}</b>
              <span className="muted small"> · pending {num((+form.order_qty || 0) - (+form.dispatch_qty || 0))} · final values are calculated by the database</span></div>
            <div className="actions">
              <button>{editId ? 'Save changes' : 'Add record'}</button>
              {editId && <button type="button" className="ghost" onClick={() => { setEditId(null); setForm(empty()) }}>Cancel</button>}
            </div>
          </form>
          {msg && <p className="notice">{msg}</p>}
        </div>
      </section>

      <section className="card">
        <div className="row"><h3>Records ({num(rows.length)})</h3><span className="grow" />
          <button className="danger sm" onClick={() => setDeleteMode(!deleteMode)} disabled={!rows.length}>
            {deleteMode ? 'Cancel Bulk Delete' : 'Bulk Delete'}
          </button>
          <input className="search" placeholder="Search state, client, company, date…" value={q} onChange={(e) => setQ(e.target.value)} /></div>

        {deleteMode && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <h4 style={{ color: '#b91c1c', margin: '0 0 12px 0' }}>Delete Records by Period</h4>
            <div className="filters">
              <label>Period
                <select value={delParams.mode} onChange={(e) => setDelParams({ ...delParams, mode: e.target.value })}>
                  <option value="all">All time (Wipe database)</option>
                  <option value="day">Single date</option>
                  <option value="month">Month</option>
                  <option value="range">Custom range</option>
                </select>
              </label>
              {delParams.mode === 'day' && <label>Date<input type="date" value={delParams.day} onChange={(e) => setDelParams({ ...delParams, day: e.target.value })} /></label>}
              {delParams.mode === 'month' && <label>Month<input type="month" value={delParams.month} onChange={(e) => setDelParams({ ...delParams, month: e.target.value })} /></label>}
              {delParams.mode === 'range' && <>
                <label>From<input type="date" value={delParams.start} onChange={(e) => setDelParams({ ...delParams, start: e.target.value })} /></label>
                <label>To<input type="date" value={delParams.end} onChange={(e) => setDelParams({ ...delParams, end: e.target.value })} /></label>
              </>}
              <button className="danger" onClick={executeBulkDelete}>Confirm Deletion</button>
            </div>
          </div>
        )}

        <div className="scroll">
          <table>
            <thead><tr>
              <th>Order Date</th><th>Party Name</th><th>State</th><th>City</th><th>Concerned Person</th>
              <th>SKU</th><th>Item</th><th>Category</th><th>Capacity</th><th>Color</th><th>Print Type</th>
              <th>Order Qty</th><th>Dispatch Qty</th><th>Pending</th>
              <th>Selling Price</th><th>Cost Price</th><th>Sales Value</th><th>Gross Profit</th>
              <th>Cap</th><th>Pouch</th><th>Order Status</th><th>Dispatch Date</th>
              <th />
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.client}</td><td>{r.state}</td><td>{r.town_city}</td><td>{r.salesperson}</td>
                  <td>{r.sku}</td><td>{r.item}</td><td>{r.category}</td><td>{r.capacity}</td><td>{r.color}</td><td>{r.print_type}</td>
                  <td>{r.order_qty}</td><td>{r.dispatch_qty}</td><td>{r.pending_qty}</td>
                  <td>{inr(r.selling_price_per_unit)}</td><td>{inr(r.cost_price_per_unit)}</td>
                  <td>{inr(r.total_selling)}</td>
                  <td className={r.gross_profit < 0 ? 'neg' : 'pos'}>{inr(r.gross_profit)}</td>
                  <td>{r.cap}</td><td>{r.pouch}</td><td>{r.order_status}</td><td>{r.dispatch_date}</td>
                  <td className="nowrap"><button className="ghost sm" onClick={() => edit(r)}>Edit</button>{' '}
                    <button className="danger sm" onClick={() => remove(r)}>Delete</button></td>
                </tr>))}
              {!shown.length && <tr><td colSpan="23" className="muted center">No records.</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 100 && <p className="muted small">Showing up to 100 rows — use search to narrow down.</p>}
      </section>
    </main>
  )
}
