import { useEffect, useState, useMemo, useCallback } from 'react'
import { useI18n } from '../contexts/I18nContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { formatRelative } from '../lib/utils.js'
import OwnerInsight from '../components/dashboard/OwnerInsight.jsx'
import DateRangePicker, { presetRange } from '../components/dashboard/DateRangePicker.jsx'
import { loadShifts, shiftsNow, bizToday, bizRange, shiftRange, thaiDate } from '../lib/shifts.js'

const PODIUM = [
  { grad: 'from-yellow-400 to-amber-500',  ring: 'shadow-amber-500/30',  chip: 'text-amber-700',  emoji: '🥇' },
  { grad: 'from-slate-300 to-slate-400',   ring: 'shadow-slate-400/25',  chip: 'text-slate-600',  emoji: '🥈' },
  { grad: 'from-orange-400 to-orange-500', ring: 'shadow-orange-500/30', chip: 'text-orange-700', emoji: '🥉' }
]

// 📊 ดึงข้อความ "ขาออก" ในช่วง — แบ่งหน้า (เลี่ยง limit 1000 ของ PostgREST)
async function fetchOutMessages({ fromISO, toISO, channelId = null }) {
  const PAGE = 1000
  let start = 0
  const all = []
  for (;;) {
    let q = supabase.from('line_messages')
      .select('sender_id, conversation_id, created_at')
      .eq('direction', 'out')
      .gte('created_at', fromISO).lt('created_at', toISO)
    if (channelId && channelId !== 'all') q = q.eq('channel_id', channelId)
    q = q.order('created_at', { ascending: true }).range(start, start + PAGE - 1)
    const { data, error } = await q
    if (error || !data || !data.length) break
    all.push(...data)
    if (data.length < PAGE) break
    start += PAGE
  }
  return all
}

export default function Dashboard() {
  const { lang } = useI18n()
  const { user } = useAuth()

  const [shiftCfg, setShiftCfg] = useState(shiftsNow)
  const [range, setRange] = useState(() => ({ ...presetRange('today', shiftsNow().dayStartMin), preset: 'today' }))
  const [channels, setChannels] = useState([])
  const [selectedChannel, setSelectedChannel] = useState('all')
  const [avatarMap, setAvatarMap] = useState({})
  const [ranked, setRanked] = useState([])
  const [summary, setSummary] = useState(null)      // { in, out, convs, shifts: [{name,label,in,out}] }
  const [loading, setLoading] = useState(true)
  const [staffPage, setStaffPage] = useState(1)
  const [search, setSearch] = useState('')
  const STAFF_PER_PAGE = 20

  // ⏰ โหลดทะเบียนกะจาก K36 — ได้ค่าจริงแล้วค่อยปรับช่วงวันให้ตรง
  useEffect(() => {
    loadShifts().then(cfg => {
      setShiftCfg(cfg)
      setRange(r => r.preset && r.preset !== 'custom'
        ? { ...presetRange(r.preset, cfg.dayStartMin), preset: r.preset } : r)
    })
  }, [])

  useEffect(() => {
    supabase.from('chat_app_users').select('username, avatar_url').not('avatar_url', 'is', null)
      .then(({ data }) => setAvatarMap(Object.fromEntries((data || []).map(u => [u.username, u.avatar_url]))))
    supabase.from('line_channels_public').select('*').order('sort_order')
      .then(({ data }) => setChannels(data || []))
  }, [])

  useEffect(() => { setStaffPage(1) }, [range, selectedChannel, search])

  // 📥 โหลดข้อมูลทั้งหน้า — ยึดวันทำงานตามกะ (ไม่ใช่เที่ยงคืน)
  const load = useCallback(async () => {
    setLoading(true)
    const startMin = shiftCfg.dayStartMin
    const { from, to } = bizRange(range.from, range.to, startMin)
    const fromISO = from.toISOString(), toISO = to.toISOString()

    const cnt = (dir, a, b) => {
      let q = supabase.from('line_messages').select('*', { count: 'exact', head: true })
        .eq('direction', dir).gte('created_at', a.toISOString()).lt('created_at', b.toISOString())
      if (selectedChannel !== 'all') q = q.eq('channel_id', selectedChannel)
      return q.then(({ count }) => count || 0)
    }

    // แยกกะ: วนทุกกะในทะเบียน × ทุกวันทำงานในช่วงที่เลือก
    const days = []
    for (let d = range.from; d <= range.to;) {
      days.push(d)
      const nd = new Date(d + 'T12:00:00'); nd.setDate(nd.getDate() + 1)
      d = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`
    }

    const [totIn, totOut, msgs, shiftRows] = await Promise.all([
      cnt('in', from, to),
      cnt('out', from, to),
      fetchOutMessages({ fromISO, toISO, channelId: selectedChannel }),
      Promise.all(shiftCfg.shifts.map(async sh => {
        const parts = await Promise.all(days.map(d => {
          const r = shiftRange(d, sh, startMin)
          return Promise.all([cnt('in', r.from, r.to), cnt('out', r.from, r.to)])
        }))
        return {
          name: sh.name, label: sh.label,
          in:  parts.reduce((s, p) => s + p[0], 0),
          out: parts.reduce((s, p) => s + p[1], 0)
        }
      }))
    ])

    // อันดับพนักงาน — นับจากข้อความขาออกจริงในช่วง
    const map = {}
    const allConvs = new Set()
    for (const m of msgs) {
      if (!m.sender_id || m.sender_id === 'system') continue
      if (!map[m.sender_id]) map[m.sender_id] = { replies: 0, convSet: new Set(), lastAt: null }
      map[m.sender_id].replies++
      map[m.sender_id].convSet.add(m.conversation_id)
      allConvs.add(m.conversation_id)
      if (!map[m.sender_id].lastAt || m.created_at > map[m.sender_id].lastAt) map[m.sender_id].lastAt = m.created_at
    }
    const list = Object.entries(map)
      .map(([u, v]) => ({ username: u, replies: v.replies, conversations: v.convSet.size, last_reply_at: v.lastAt }))
      .sort((a, b) => b.conversations - a.conversations || b.replies - a.replies)

    setRanked(list)
    setSummary({ in: totIn, out: totOut, convs: allConvs.size, shifts: shiftRows })
    setLoading(false)
  }, [range, selectedChannel, shiftCfg])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? ranked.filter(s => s.username.toLowerCase().includes(q)) : ranked
  }, [ranked, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / STAFF_PER_PAGE))
  const pageRows = filtered.slice((staffPage-1)*STAFF_PER_PAGE, staffPage*STAFF_PER_PAGE)
  const top3 = ranked.slice(0, 3)

  const rangeLabel = range.from === range.to ? thaiDate(range.from) : `${thaiDate(range.from)} – ${thaiDate(range.to)}`
  const dayStartLabel = shiftCfg.shifts[0]?.label?.split('–')[0] || '08:00'

  const Avatar = ({ name, size = 'w-7 h-7', text = 'text-[10px]' }) => (
    avatarMap[name]
      ? <img src={avatarMap[name]} alt={name} loading="lazy" decoding="async" className={`${size} rounded-full object-cover shrink-0`} />
      : <div className={`${size} ${text} rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 text-white flex items-center justify-center font-bold shrink-0`}>{name.substring(0,2).toUpperCase()}</div>
  )

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-xl dark:text-white flex items-center gap-2">
            <span className="material-icons text-emerald-500">insights</span>
            {lang==='th'?'แดชบอร์ด':'Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {rangeLabel} · {lang==='th'?`วันทำงาน ${dayStartLabel}–${dayStartLabel}`:`work day ${dayStartLabel}–${dayStartLabel}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}
                  className="text-sm px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-white outline-none">
            <option value="all">{lang==='th'?'ทุก OA':'All OA'}</option>
            {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.channel_name}</option>)}
          </select>
          <DateRangePicker value={range} onChange={setRange} startMin={shiftCfg.dayStartMin} lang={lang} />
          <button onClick={load} disabled={loading}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50">
            <span className={`material-icons text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 shadow-lg shadow-blue-500/20">
          <div className="text-xs text-white/75 mb-2">📥 {lang==='th'?'แชทเข้า':'Incoming'}</div>
          <div className="text-3xl font-black text-white tabular-nums leading-none">{loading ? '—' : summary?.in.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 shadow-lg shadow-emerald-500/20">
          <div className="text-xs text-white/75 mb-2">📤 {lang==='th'?'staff ตอบ':'Replies'}</div>
          <div className="text-3xl font-black text-white tabular-nums leading-none">{loading ? '—' : summary?.out.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-5 shadow-lg shadow-purple-500/20">
          <div className="text-xs text-white/75 mb-2">👥 {lang==='th'?'ลูกค้าที่ดูแล':'Customers'}</div>
          <div className="text-3xl font-black text-white tabular-nums leading-none">{loading ? '—' : summary?.convs.toLocaleString()}</div>
        </div>
      </div>

      {/* แยกกะ — วนตามทะเบียนกะจริงใน K36 */}
      <div className={`grid gap-3 mb-6 ${(summary?.shifts?.length || 2) > 2 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {(summary?.shifts || shiftCfg.shifts.map(s => ({ name: s.name, label: s.label }))).map((sh, i) => {
          const tone = i === 0
            ? { br: 'border-amber-400/40',  dot: 'bg-amber-400',  tx: 'text-amber-600 dark:text-amber-300' }
            : i === 1
            ? { br: 'border-indigo-400/40', dot: 'bg-indigo-400', tx: 'text-indigo-600 dark:text-indigo-300' }
            : { br: 'border-teal-400/40',   dot: 'bg-teal-400',   tx: 'text-teal-600 dark:text-teal-300' }
          return (
            <div key={sh.name} className={`bg-white dark:bg-slate-800 border ${tone.br} rounded-2xl p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                <span className={`text-sm font-bold ${tone.tx}`}>{sh.name}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">{sh.label}</span>
              </div>
              <div className="flex gap-9">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">{lang==='th'?'เข้า':'In'}</div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums leading-none">{loading ? '—' : (sh.in ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">{lang==='th'?'ตอบ':'Out'}</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{loading ? '—' : (sh.out ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <OwnerInsight channels={channels} selectedChannel={selectedChannel} />

      {/* ท็อป 3 */}
      {top3.length > 0 && (
        <>
          <h2 className="font-bold text-base dark:text-white mb-3 mt-6 flex items-center gap-2">
            <span className="material-icons text-amber-500">emoji_events</span>
            {lang==='th'?'ท็อป 3':'Top 3'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {top3.map((s, i) => (
              <div key={s.username} className={`bg-gradient-to-br ${PODIUM[i].grad} rounded-2xl p-4 shadow-lg ${PODIUM[i].ring}`}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <Avatar name={s.username} size="w-9 h-9" text="text-xs" />
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-white truncate leading-tight">{s.username}</div>
                    <div className="text-[11px] text-white/80">{PODIUM[i].emoji} {lang==='th'?`อันดับ ${i+1}`:`Rank ${i+1}`}</div>
                  </div>
                </div>
                <div className="text-4xl font-black text-white tabular-nums leading-none">{s.conversations.toLocaleString()}</div>
                <div className="text-[11px] text-white/85 mt-1.5">
                  {lang==='th'?'ลูกค้า':'customers'} · {s.replies.toLocaleString()} {lang==='th'?'ข้อความ':'msgs'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* อันดับทั้งหมด */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-base dark:text-white flex items-center gap-2">
          <span className="material-icons text-cyan-500">leaderboard</span>
          {lang==='th'?'อันดับทั้งหมด':'Full leaderboard'}
          <span className="text-xs font-normal text-slate-400">({ranked.length} {lang==='th'?'คน':'staff'})</span>
        </h2>
        <div className="relative">
          <span className="material-icons text-base text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder={lang==='th'?'ค้นหาชื่อพนักงาน':'Search staff'}
                 className="w-[220px] text-sm pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <span className="material-icons text-base">close</span>
            </button>
          )}
        </div>
      </div>

      {loading && ranked.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400">{lang==='th'?'กำลังโหลด...':'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <span className="material-icons text-5xl text-slate-300">{search ? 'search_off' : 'hourglass_empty'}</span>
          <p className="mt-2 text-sm">{search ? (lang==='th'?`ไม่พบพนักงานชื่อ "${search}"`:`No staff matching "${search}"`) : (lang==='th'?'ยังไม่มีข้อมูลในช่วงนี้':'No activity in this period')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left p-3 w-14">#</th>
                <th className="text-left p-3">{lang==='th'?'พนักงาน':'Staff'}</th>
                <th className="text-right p-3 w-20">{lang==='th'?'ลูกค้า':'Customers'}</th>
                <th className="text-right p-3 w-20">{lang==='th'?'ตอบ':'Replies'}</th>
                <th className="text-right p-3 w-24">{lang==='th'?'ตอบล่าสุด':'Last reply'}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => {
                const idx = ranked.findIndex(r => r.username === s.username)
                const isMe = s.username === user.username
                return (
                  <tr key={s.username} className={`border-t border-slate-100 dark:border-slate-700 ${isMe ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                    <td className="p-3 font-black text-slate-500">{idx < 3 ? PODIUM[idx].emoji : `#${idx+1}`}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.username} />
                        <span className="font-bold dark:text-white">{s.username}</span>
                        {isMe && <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded font-bold">{lang==='th'?'คุณ':'YOU'}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold text-[15px] text-emerald-600 dark:text-emerald-400 tabular-nums">{s.conversations.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">{s.replies.toLocaleString()}</td>
                    <td className="p-3 text-right text-[11px] text-slate-400 tabular-nums">{formatRelative(s.last_reply_at, lang)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length > STAFF_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex-wrap gap-2">
              <span className="text-xs text-slate-400">
                {lang==='th'
                  ? `แสดง ${(staffPage-1)*STAFF_PER_PAGE+1}–${Math.min(staffPage*STAFF_PER_PAGE, filtered.length)} จาก ${filtered.length} คน`
                  : `Showing ${(staffPage-1)*STAFF_PER_PAGE+1}–${Math.min(staffPage*STAFF_PER_PAGE, filtered.length)} of ${filtered.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setStaffPage(p => Math.max(1, p-1))} disabled={staffPage === 1}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 transition">
                  ← {lang==='th'?'ก่อนหน้า':'Prev'}
                </button>
                {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
                  <button key={p} onClick={() => setStaffPage(p)}
                          className={`w-8 h-8 text-xs font-bold rounded-lg transition ${staffPage===p ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setStaffPage(p => Math.min(totalPages, p+1))} disabled={staffPage === totalPages}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 transition">
                  {lang==='th'?'ถัดไป':'Next'} →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
