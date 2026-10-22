(function() {
  const ACTIVE = 'ds-tab ds-tab-active';
  const INACTIVE = 'ds-tab';
  const PERM = 'ds_chatcount';
  const $ = id => document.getElementById(id);
  const esc = v => window.dsEsc(v);
  const can = () => typeof window.canPerm === 'function' && window.canPerm(PERM);
  const DEF = {
    ask: '📊 **นับแชท {รอบ}** · {วันที่}\nรีพลายข้อความนี้ บอกชื่อเว็บ + จำนวนแชท\nตัวอย่าง: `MK8 15`  `JL69 3`',
    report: 'ตรวจสอบจำนวนแชท{รอบ}\nเวลา {เวลา} น\n\n{รายการ}',
    line: '{สี}เว็บ {เว็บ}{สี}\nไลน์หลัก {จำนวน} แชท\n',
    missing: '{สี}เว็บ {เว็บ}{สี}\nไลน์หลัก ยังไม่ตอบ\n'
  };
  let _settings = {
    webs: [],
    channels: [],
    channels_updated_at: null
  };
  let _schedules = [];
  let _rounds = [];
  let _answers = {};
  let _tgGroups = [];
  let _sub = 'live';
  let _timer = null;
  const LB = 'display:block;font-size:11px;font-weight:800;letter-spacing:.4px;color:#94a3b8;margin-bottom:6px;';
  const FD = 'width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1.5px solid var(--k-line2);' + 'background:var(--k-field);color:var(--k-tx);font-size:13px;font-weight:600;outline:none;';
  const CARD = 'background:var(--k-panel2);border:1px solid var(--k-line);border-radius:14px;padding:14px;';
  const BTN = 'display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;border:1px solid var(--k-line2);background:var(--k-btn);color:var(--k-tx);';
  const BTN_MAIN = 'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;border:none;background:#0ea5e9;color:#fff;';
  const MI = s => `<span class="material-icons" style="font-size:16px">${s}</span>`;
  const CHIP = (bg, fg) => `display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:99px;font-size:12px;font-weight:800;background:${bg};color:${fg};`;
  const SWAL = {
    background: '#1e293b',
    color: '#fff',
    confirmButtonColor: '#0ea5e9',
    cancelButtonColor: '#475569'
  };
  const thaiNow = () => new Date(Date.now() + 7 * 3600 * 1e3);
  const thaiToday = () => thaiNow().toISOString().slice(0, 10);
  const thaiHHMM = () => thaiNow().toISOString().slice(11, 16);
  const thaiDate = d => {
    const [y, m, dd] = String(d).slice(0, 10).split('-');
    return `${dd}/${m}/${Number(y) + 543}`;
  };
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok'
  }) : '';
  const render = (t, vals) => Object.keys(vals).reduce(((s, k) => s.split('{' + k + '}').join(String(vals[k]))), t || '');
  const DEF_EMOJI = {
    Jun88: '🔵',
    MK8: '⚫️',
    PG688: '🟣',
    F168: '🟠',
    JL69: '🟡',
    NM9: '🔴',
    VV72: '🔘',
    TH26: '🟤',
    K188: '🩷',
    BT678: '⚪️'
  };
  const webEmoji = name => {
    const w = (_settings.webs || []).find((x => x && x.name === name));
    return w && w.emoji || '';
  };
  const thaiTime = t => String(t || '').replace(':', '.');
  const webNames = () => (_settings.webs || []).map((w => typeof w === 'string' ? w : w.name)).filter(Boolean);
  const chanName = id => {
    const c = (_settings.channels || []).find((x => String(x.id) === String(id)));
    return c ? c.name : id;
  };
  const normId = v => window.normChatId ? window.normChatId(v) : String(v || '').replace(/^-/, '');
  const tgList = () => _settings.tg_groups && _settings.tg_groups.length ? _settings.tg_groups.map((g => ({
    id: String(g.id),
    name: g.name
  }))) : _tgGroups.map((g => ({
    id: String(g.chat_id),
    name: g.group_name
  })));
  const tgFind = id => {
    const n = normId(id);
    return n ? tgList().find((g => normId(g.id) === n)) : null;
  };
  const tgName = id => {
    const g = tgFind(id);
    return g ? g.name : id || '-';
  };
  const chanKnown = id => (_settings.channels || []).some((x => String(x.id) === String(id)));
  function evaluate(rnd, answers) {
    const latest = {};
    [ ...answers ].sort(((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id)).forEach((a => {
      latest[a.web + '|' + a.channel_id] = a;
    }));
    const perWeb = {};
    Object.values(latest).forEach((a => {
      (perWeb[a.web] = perWeb[a.web] || []).push(a);
    }));
    const resolved = rnd.resolved || {};
    const values = {}, conflicts = {};
    Object.entries(perWeb).forEach((([web, lst]) => {
      if (lst.length === 1) {
        values[web] = lst[0];
        return;
      }
      const pick = lst.find((a => String(a.channel_id) === String(resolved[web])));
      if (pick) values[web] = pick; else conflicts[web] = lst;
    }));
    const expected = rnd.expected_webs || [];
    const missing = expected.filter((w => !values[w] && !conflicts[w]));
    const total = expected.reduce(((s, w) => s + (values[w] ? Number(values[w].count) || 0 : 0)), 0);
    return {
      values: values,
      conflicts: conflicts,
      missing: missing,
      total: total,
      done: expected.filter((w => values[w])).length
    };
  }
  const _origSwitch = window.switchDiscordTab;
  window.switchDiscordTab = function(tabName) {
    const panel = $('dsContent_chatcount');
    const btn = $('tabDsChatcount');
    if (tabName === 'chatcount') {
      if (!can()) {
        Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้ครับ', 'error');
        return;
      }
      document.querySelectorAll('[id^="dsContent_"]').forEach((el => el.classList.add('hidden')));
      document.querySelectorAll('[id^="tabDs"]').forEach((b => {
        if (b.id !== 'tabDsChatcount') b.className = INACTIVE;
      }));
      try {
        if (typeof spyInterval !== 'undefined' && spyInterval) clearInterval(spyInterval);
      } catch (e) {}
      try {
        if (typeof logInterval !== 'undefined' && logInterval) clearInterval(logInterval);
      } catch (e) {}
      if (panel) panel.classList.remove('hidden');
      if (btn) btn.className = ACTIVE;
      init();
      return;
    }
    stopTimer();
    if (panel) panel.classList.add('hidden');
    if (btn) btn.className = INACTIVE;
    if (typeof _origSwitch === 'function') return _origSwitch.apply(this, arguments);
  };
  function applyPerm() {
    const btn = $('tabDsChatcount');
    if (btn) btn.style.display = can() ? '' : 'none';
    if (!can()) {
      $('dsContent_chatcount')?.classList.add('hidden');
      return;
    }
    const noAccess = $('discordNoAccessMessage');
    if (noAccess) {
      noAccess.remove();
      window.switchDiscordTab('chatcount');
    }
  }
  const _origPerm = window.applyDiscordPermissions;
  window.applyDiscordPermissions = function() {
    try {
      return typeof _origPerm === 'function' ? _origPerm.apply(this, arguments) : undefined;
    } finally {
      try {
        applyPerm();
      } catch (e) {
        console.error('[ChatCount] applyPerm:', e);
      }
    }
  };
  const _origSidebar = window.applySidebarPermissions;
  if (typeof _origSidebar === 'function' && !_origSidebar._ccWrapped) {
    window.applySidebarPermissions = async function() {
      try {
        return await _origSidebar.apply(this, arguments);
      } finally {
        try {
          applyPerm();
        } catch (e) {}
      }
    };
    window.applySidebarPermissions._ccWrapped = true;
  }
  applyPerm();
  function stopTimer() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }
  function startTimer() {
    stopTimer();
    _timer = setInterval((() => {
      const panel = $('dsContent_chatcount');
      if (!panel || panel.classList.contains('hidden') || _sub !== 'live') {
        stopTimer();
        return;
      }
      if (!document.querySelector('.swal2-container')) window.ccLoadLive(true);
    }), 1e4);
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(_timer);
  }
  function buildShell() {
    const panel = $('dsContent_chatcount');
    if (!panel || panel.dataset.ccBuilt) return;
    panel.dataset.ccBuilt = '1';
    const subBtn = (id, icon, label) => `<button id="ccSub_${id}" onclick="window.ccSetSub('${id}')" style="${BTN}">${MI(icon)} ${label}</button>`;
    panel.innerHTML = `\n            <div class="bg-slate-800 p-5 rounded-3xl border border-slate-700 shadow-lg">\n                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">\n                    <h2 class="text-sky-400 font-black flex items-center gap-2 text-xl"><span class="material-icons">forum</span> นับแชท</h2>\n                    <div style="display:flex;gap:6px;flex-wrap:wrap">\n                        ${subBtn('live', 'monitoring', 'รอบวันนี้')}\n                        ${subBtn('schedules', 'schedule', 'ตั้งเวลา & แพทเทิร์น')}\n                        ${subBtn('webs', 'language', 'รายชื่อเว็บ')}\n                    </div>\n                </div>\n                <div id="ccView_live"></div>\n                <div id="ccView_schedules" style="display:none"></div>\n                <div id="ccView_webs" style="display:none"></div>\n            </div>`;
    $('ccView_live').innerHTML = `\n            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">\n                <input type="date" id="ccLiveDate" onchange="window.ccLoadLive()" style="${FD}width:auto">\n                <button onclick="window.ccLoadLive()" style="${BTN}">${MI('refresh')} รีเฟรช</button>\n                <span style="font-size:12px;color:var(--k-mute)">อัปเดตเองทุก 10 วินาที</span>\n            </div>\n            <div id="ccLiveList" style="display:flex;flex-direction:column;gap:12px"></div>`;
    $('ccLiveDate').value = thaiToday();
    $('ccView_schedules').innerHTML = `\n            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">\n                <div id="ccChanInfo" style="font-size:12px;color:var(--k-mute)"></div>\n                <div style="display:flex;gap:6px">\n                    <button onclick="window.ccLoadSchedules()" style="${BTN}">${MI('refresh')} รีเฟรช</button>\n                    <button onclick="window.ccEditSchedule()" style="${BTN_MAIN}">${MI('add')} เพิ่มรอบเวลา</button>\n                </div>\n            </div>\n            <div id="ccScheduleList" style="display:flex;flex-direction:column;gap:10px"></div>`;
  }
  async function init() {
    buildShell();
    await loadBase();
    window.ccSetSub(_sub);
  }
  window.ccSetSub = function(sub) {
    _sub = sub;
    [ 'live', 'schedules', 'webs' ].forEach((s => {
      $('ccView_' + s).style.display = s === sub ? '' : 'none';
      const b = $('ccSub_' + s);
      b.style.background = s === sub ? '#0ea5e9' : 'var(--k-btn)';
      b.style.color = s === sub ? '#fff' : 'var(--k-tx)';
    }));
    stopTimer();
    if (sub === 'live') {
      window.ccLoadLive();
      startTimer();
    } else if (sub === 'schedules') window.ccLoadSchedules(); else renderWebs();
  };
  async function loadBase() {
    try {
      const [s, g] = await Promise.all([ appDB.from('chatcount_settings').select('*').eq('id', 1).maybeSingle(), appDB.from('telegram_groups').select('group_name, chat_id, active').order('group_name') ]);
      if (s.error) throw s.error;
      _settings = s.data || {
        webs: [],
        channels: []
      };
      _tgGroups = (g.data || []).filter((x => x.chat_id));
    } catch (e) {
      console.error('[ChatCount] load base:', e);
      Swal.fire({
        ...SWAL,
        icon: 'error',
        title: 'โหลดตั้งค่าไม่ได้',
        html: `${esc(e.message)}<br><small>ถ้ายังไม่ได้สร้างตาราง ให้รัน chatcount.sql ใน Supabase ก่อน</small>`
      });
    }
  }
  window.ccLoadLive = async function(silent) {
    const list = $('ccLiveList');
    if (!list) return;
    if (!silent) list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--k-mute)">กำลังโหลด...</div>`;
    try {
      const date = $('ccLiveDate').value || thaiToday();
      const {data: data, error: error} = await appDB.from('chatcount_rounds').select('*').eq('round_date', date).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      _rounds = data || [];
      _answers = {};
      const ids = _rounds.map((r => r.id));
      if (ids.length) {
        const a = await appDB.from('chatcount_answers').select('*').in('round_id', ids).order('created_at', {
          ascending: true
        });
        if (a.error) throw a.error;
        (a.data || []).forEach((x => {
          (_answers[x.round_id] = _answers[x.round_id] || []).push(x);
        }));
      }
      renderLive();
    } catch (e) {
      console.error('[ChatCount] load live:', e);
      if (!silent) list.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;font-weight:700">โหลดไม่ได้: ${esc(e.message)}</div>`;
    }
  };
  function renderLive() {
    const list = $('ccLiveList');
    if (!_rounds.length) {
      list.innerHTML = `<div style="text-align:center;padding:36px;color:var(--k-mute)"><span class="material-icons" style="font-size:42px;opacity:.4">forum</span><div style="margin-top:6px;font-weight:700">ยังไม่มีรอบในวันนี้</div><div style="font-size:12px">ตั้งรอบเวลาได้ที่ "ตั้งเวลา & แพทเทิร์น" หรือกด "ส่งเลยตอนนี้"</div></div>`;
      return;
    }
    list.innerHTML = _rounds.map((r => {
      const ev = evaluate(r, _answers[r.id] || []);
      const exp = r.expected_webs || [];
      let status;
      if (r.status === 'sent') status = `<span style="${CHIP('rgba(16,185,129,.15)', '#34d399')}">✅ ส่ง Telegram แล้ว ${fmtTime(r.sent_at)}</span>`; else if (r.status === 'cancelled') status = `<span style="${CHIP('rgba(148,163,184,.15)', '#94a3b8')}">ยกเลิกแล้ว</span>`; else if (!r.posted) status = `<span style="${CHIP('rgba(251,191,36,.15)', '#fbbf24')}">⏳ รอบอทส่งคำถาม</span>`; else if (r.force_send) status = `<span style="${CHIP('rgba(251,191,36,.15)', '#fbbf24')}">⏳ กำลังส่งเท่าที่มี</span>`; else status = `<span style="${CHIP('rgba(14,165,233,.15)', '#38bdf8')}">รอคำตอบ ${ev.done}/${exp.length}</span>`;
      const chips = exp.map((w => {
        const v = ev.values[w];
        if (v) return `<span title="${esc((v.channel_name || '') + ' · ' + (v.staff_name || v.discord_name || '') + ' · ' + fmtTime(v.created_at))}" style="${CHIP('rgba(16,185,129,.15)', '#34d399')}">${esc(w)} <b>${Number(v.count)}</b></span>`;
        if (ev.conflicts[w]) return `<span onclick="window.ccResolve(${Number(r.id)}, '${esc(w)}')" title="ตอบมาจากหลายห้อง — กดเพื่อเลือกค่าที่ถูก" style="${CHIP('rgba(251,191,36,.18)', '#fbbf24')}cursor:pointer">⚠️ ${esc(w)} ตอบซ้อน</span>`;
        return `<span style="${CHIP('rgba(148,163,184,.12)', '#94a3b8')}">${esc(w)} —</span>`;
      })).join(' ');
      const rooms = (r.messages || []).map((m => '#' + esc(m.channel_name || chanName(m.channel_id)))).join(', ') || (r.posted ? '-' : 'ยังไม่ส่ง');
      const errs = [ ...r.post_errors || [], ...r.send_error && r.status === 'open' ? [ r.send_error ] : [] ];
      const open = r.status === 'open';
      const btns = [ open && r.posted ? `<button onclick="window.ccForceSend(${Number(r.id)})" style="${BTN}color:#fbbf24">${MI('send')} ส่งเท่าที่มี</button>` : '', r.report_text ? `<button onclick="window.ccShowReport(${Number(r.id)})" style="${BTN}">${MI('article')} ข้อความสรุป</button>` : '', (_answers[r.id] || []).length ? `<button onclick="window.ccShowAnswers(${Number(r.id)})" style="${BTN}">${MI('list')} คำตอบทั้งหมด</button>` : '', open ? `<button onclick="window.ccCancelRound(${Number(r.id)})" style="${BTN}color:#f87171">${MI('close')} ยกเลิก</button>` : '' ].join('');
      return `<div style="${CARD}">\n                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center">\n                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n                        <span style="font-weight:900;color:var(--k-tx-strong);font-size:15px">${esc(r.label || r.round_time || 'รอบ')}</span>\n                        <span style="font-size:12px;color:var(--k-mute)">${esc(r.round_time || '')} · ${r.trigger === 'manual' ? 'ส่งเอง' : 'อัตโนมัติ'}</span>\n                        ${status}\n                    </div>\n                    <div style="font-weight:900;color:#38bdf8">รวม ${ev.total} แชท</div>\n                </div>\n                <div style="font-size:12px;color:var(--k-mute);margin-top:4px">ห้อง: ${rooms} · Telegram: ${esc(tgName(r.telegram_chat_id))}</div>\n                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${chips || '<span style="color:var(--k-mute);font-size:12px">ไม่ได้เลือกเว็บ</span>'}</div>\n                ${errs.length ? `<div style="font-size:12px;color:#f87171;margin-top:8px;font-weight:700">${errs.map(esc).join('<br>')}</div>` : ''}\n                ${btns ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${btns}</div>` : ''}\n            </div>`;
    })).join('');
  }
  window.ccResolve = async function(rid, web) {
    const r = _rounds.find((x => Number(x.id) === Number(rid)));
    if (!r) return;
    const ev = evaluate(r, _answers[r.id] || []);
    const lst = ev.conflicts[web] || [];
    if (!lst.length) return;
    const opts = {};
    lst.forEach((a => {
      opts[a.channel_id] = `#${a.channel_name || a.channel_id}: ${a.count} แชท (${a.staff_name || a.discord_name || '-'} ${fmtTime(a.created_at)})`;
    }));
    const res = await Swal.fire({
      ...SWAL,
      title: `${web} ตอบมาจากหลายห้อง`,
      text: 'เลือกห้องที่ถูกต้อง (เว็บหนึ่งอยู่ได้ห้องเดียว)',
      input: 'radio',
      inputOptions: opts,
      inputValidator: v => !v && 'เลือก 1 ค่า',
      showCancelButton: true,
      confirmButtonText: 'ใช้ค่านี้',
      cancelButtonText: 'ยกเลิก'
    });
    if (!res.isConfirmed) return;
    const fresh = await appDB.from('chatcount_rounds').select('resolved').eq('id', rid).maybeSingle();
    const resolved = {
      ...fresh.data && fresh.data.resolved || {},
      [web]: res.value
    };
    const {error: error} = await appDB.from('chatcount_rounds').update({
      resolved: resolved
    }).eq('id', rid);
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'บันทึกไม่ได้',
      text: error.message
    });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'เลือกแล้ว · ถ้าครบ บอทจะส่ง Telegram ภายใน ~15 วินาที',
      showConfirmButton: false,
      timer: 2500
    });
    window.ccLoadLive(true);
  };
  window.ccForceSend = async function(rid) {
    const r = _rounds.find((x => Number(x.id) === Number(rid)));
    if (!r) return;
    const ev = evaluate(r, _answers[r.id] || []);
    const pending = [ ...ev.missing, ...Object.keys(ev.conflicts).filter((w => (r.expected_webs || []).includes(w))) ];
    const ok = await Swal.fire({
      ...SWAL,
      icon: 'warning',
      title: 'ส่งเท่าที่มีเลย?',
      html: pending.length ? `ยังไม่ครบ: <b>${pending.map(esc).join(', ')}</b><br><small>เว็บที่ยังไม่ตอบจะขึ้นตามแพทเทิร์น "ยังไม่ตอบ" · ตอบซ้อนจะใช้ค่าล่าสุด</small>` : 'ส่งสรุปเข้า Telegram ตอนนี้',
      showCancelButton: true,
      confirmButtonText: 'ส่งเลย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#f59e0b'
    });
    if (!ok.isConfirmed) return;
    const {error: error} = await appDB.from('chatcount_rounds').update({
      force_send: true
    }).eq('id', rid);
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'ผิดพลาด',
      text: error.message
    });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'สั่งแล้ว · บอทจะส่งภายใน ~15 วินาที',
      showConfirmButton: false,
      timer: 2500
    });
    window.ccLoadLive(true);
  };
  window.ccCancelRound = async function(rid) {
    const ok = await Swal.fire({
      ...SWAL,
      icon: 'warning',
      title: 'ยกเลิกรอบนี้?',
      text: 'จะไม่ส่งสรุปเข้า Telegram และไม่รับรีพลายเพิ่ม',
      showCancelButton: true,
      confirmButtonText: 'ยกเลิกรอบ',
      cancelButtonText: 'ไม่',
      confirmButtonColor: '#ef4444'
    });
    if (!ok.isConfirmed) return;
    const {error: error} = await appDB.from('chatcount_rounds').update({
      status: 'cancelled'
    }).eq('id', rid);
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'ผิดพลาด',
      text: error.message
    });
    window.ccLoadLive(true);
  };
  window.ccShowReport = function(rid) {
    const r = _rounds.find((x => Number(x.id) === Number(rid)));
    if (!r) return;
    Swal.fire({
      ...SWAL,
      title: r.status === 'sent' ? 'ข้อความที่ส่งเข้า Telegram' : 'ข้อความสรุป (ยังส่งไม่สำเร็จ)',
      width: 520,
      confirmButtonText: 'ปิด',
      html: `<pre style="text-align:left;white-space:pre-wrap;font-family:inherit;font-size:13px;background:var(--k-field);padding:12px;border-radius:10px">${esc(r.report_text)}</pre>`
    });
  };
  window.ccShowAnswers = function(rid) {
    const rows = (_answers[rid] || []).slice().reverse();
    Swal.fire({
      ...SWAL,
      title: 'คำตอบทั้งหมดของรอบนี้',
      width: 640,
      confirmButtonText: 'ปิด',
      html: `<div style="max-height:60vh;overflow-y:auto;text-align:left">${rows.map((a => `\n                <div style="border-bottom:1px solid var(--k-line);padding:8px 2px;font-size:13px">\n                    <b>${esc(a.web)} = ${Number(a.count)}</b> <span style="color:var(--k-mute)">· #${esc(a.channel_name || a.channel_id)} · ${esc(a.staff_name || a.discord_name || '-')} · ${fmtTime(a.created_at)}</span>\n                    <div style="color:var(--k-mute);font-size:12px;margin-top:2px">“${esc(a.raw_text || '')}”</div>\n                </div>`)).join('')}</div>`
    });
  };
  window.ccLoadSchedules = async function() {
    const list = $('ccScheduleList');
    list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--k-mute)">กำลังโหลด...</div>`;
    await loadBase();
    const info = $('ccChanInfo');
    const nCh = (_settings.channels || []).length;
    const nTg = (_settings.tg_groups || []).length;
    info.innerHTML = (nCh ? `ห้อง Discord ${nCh} ห้อง (อัปเดต ${fmtTime(_settings.channels_updated_at)})` : `<span style="color:#fbbf24">⚠️ ยังไม่มีรายชื่อห้องจากบอท — ตรวจว่า botlink รันอยู่</span>`) + ' · ' + (nTg ? `กลุ่ม Telegram ${nTg} กลุ่ม (อัปเดต ${fmtTime(_settings.tg_groups_updated_at)})` : `<span style="color:#fbbf24">⚠️ ยังไม่มีรายชื่อกลุ่ม Telegram จากบอท</span>`);
    try {
      const {data: data, error: error} = await appDB.from('chatcount_schedules').select('*').order('time', {
        ascending: true
      });
      if (error) throw error;
      _schedules = data || [];
      renderSchedules();
    } catch (e) {
      list.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;font-weight:700">โหลดไม่ได้: ${esc(e.message)}</div>`;
    }
  };
  function renderSchedules() {
    const list = $('ccScheduleList');
    if (!_schedules.length) {
      list.innerHTML = `<div style="text-align:center;padding:36px;color:var(--k-mute)"><span class="material-icons" style="font-size:42px;opacity:.4">schedule</span><div style="margin-top:6px;font-weight:700">ยังไม่มีรอบเวลา กด "เพิ่มรอบเวลา"</div></div>`;
      return;
    }
    list.innerHTML = _schedules.map((s => {
      const hasCh = (_settings.channels || []).length > 0;
      const rooms = (s.channel_ids || []).map((id => !hasCh || chanKnown(id) ? '#' + esc(chanName(id)) : `<span style="color:#f87171" title="ไม่พบห้องนี้ใน Discord แล้ว (อาจถูกลบ)">⚠️ ${esc(id)}</span>`)).join(', ') || '<span style="color:#f87171">ยังไม่เลือกห้อง</span>';
      const tgOk = !(_settings.tg_groups || []).length || tgFind(s.telegram_chat_id);
      const tgText = tgOk ? `<b style="color:var(--k-tx2)">${esc(tgName(s.telegram_chat_id))}</b>` : `<b style="color:#f87171" title="บัญชี Telegram ไม่ได้อยู่ในกลุ่มนี้แล้ว">⚠️ ${esc(s.telegram_chat_id || '-')}</b>`;
      const badge = s.active ? `<span style="${CHIP('rgba(16,185,129,.15)', '#34d399')}">เปิดอยู่</span>` : `<span style="${CHIP('rgba(148,163,184,.15)', '#94a3b8')}">ปิดอยู่</span>`;
      return `<div style="${CARD}">\n                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px">\n                    <div style="min-width:0;flex:1">\n                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n                            <span style="font-weight:900;font-size:20px;color:#38bdf8;font-family:monospace">${esc(s.time)}</span>\n                            <span style="font-weight:900;color:var(--k-tx-strong)">${esc(s.name)}</span>${badge}\n                        </div>\n                        <div style="font-size:12px;color:var(--k-mute);margin-top:4px">ทุกวัน · ทุกเว็บ · ห้อง: ${rooms}</div>\n                        <div style="font-size:12px;color:var(--k-mute);margin-top:2px">Telegram: ${tgText}</div>\n                    </div>\n                    <div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap">\n                        <button onclick="window.ccSendNow(${Number(s.id)})" style="${BTN}color:#38bdf8">${MI('send')} ส่งเลยตอนนี้</button>\n                        <button onclick="window.ccEditSchedule(${Number(s.id)})" style="${BTN}">${MI('edit')} แก้ไข</button>\n                        <button onclick="window.ccEditSchedule(${Number(s.id)}, true)" style="${BTN}" title="คัดลอกเป็นรอบใหม่">${MI('content_copy')}</button>\n                        <button onclick="window.ccToggleSchedule(${Number(s.id)})" style="${BTN}">${MI(s.active ? 'pause' : 'play_arrow')}</button>\n                        <button onclick="window.ccDeleteSchedule(${Number(s.id)})" style="${BTN}color:#f87171">${MI('delete')}</button>\n                    </div>\n                </div>\n            </div>`;
    })).join('');
  }
  function ensureEditorStyle() {
    if (document.getElementById('cce-style')) return;
    const css = `\n.cce-pop.swal2-popup{padding:0 0 18px;border-radius:20px;border:1px solid rgba(148,163,184,.14)}\n.cce-pop .swal2-title{margin:0;padding:22px 28px 0;text-align:left;font-size:20px;font-weight:900;letter-spacing:.2px}\n.cce-pop .swal2-html-container{margin:14px 0 0;padding:0 28px;overflow:visible}\n.cce-pop .swal2-actions{margin-top:16px;padding:0 28px;justify-content:flex-end;width:100%;box-sizing:border-box}\n.cce-pop .swal2-validation-message{margin:12px 28px 0;border-radius:10px}\n.cce{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:22px;text-align:left;color:var(--k-tx)}\n.cce-main{max-height:66vh;overflow-y:auto;padding-right:6px}\n.cce-side{max-height:66vh;overflow-y:auto;background:rgba(2,6,23,.45);border:1px solid rgba(148,163,184,.12);border-radius:16px;padding:16px}\n.cce-step{padding:4px 0 20px;border-bottom:1px solid rgba(148,163,184,.10);margin-bottom:18px}\n.cce-step:last-of-type{border-bottom:0}\n.cce-sh{display:flex;align-items:center;gap:10px;margin-bottom:12px}\n.cce-num{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;background:rgba(14,165,233,.16);color:#7dd3fc;flex:none}\n.cce-sh h4{margin:0;font-size:14px;font-weight:900;color:var(--k-tx-strong)}\n.cce-sh .cce-aside{margin-left:auto;font-size:12px;color:var(--k-mute);font-weight:600}\n.cce-in{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:11px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:var(--k-tx);font-size:13.5px;font-weight:600;outline:none;transition:border-color .15s}\n.cce-in:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.15)}\n.cce-tp{position:relative}\n.cce-tbtn{width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:11px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:var(--k-tx);cursor:pointer;text-align:left;transition:border-color .15s,box-shadow .15s}\n.cce-tbtn:hover{border-color:rgba(56,189,248,.5)}\n.cce-tbtn[aria-expanded=true],.cce-tbtn:focus-visible{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.15);outline:0}\n.cce-tval{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:.5px;color:#7dd3fc;line-height:1.2}\n.cce-tval.empty{color:var(--k-mute);font-weight:700}\n.cce-tunit{font-size:12px;font-weight:700;color:var(--k-mute)}\n.cce-tbtn svg{margin-left:auto;opacity:.6;flex:none}\n.cce-tpop{position:absolute;top:calc(100% + 8px);right:0;z-index:30;width:236px;padding:12px;border-radius:16px;background:#0f172a;border:1px solid rgba(148,163,184,.18);box-shadow:0 22px 50px rgba(2,6,23,.65);\n  opacity:0;transform:translateY(-6px) scale(.97);transform-origin:top right;pointer-events:none;transition:opacity .18s ease,transform .22s cubic-bezier(.2,.8,.2,1)}\n.cce-tpop.open{opacity:1;transform:none;pointer-events:auto}\n.cce-wheels{position:relative;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;height:200px}\n.cce-wheels::before{content:'';position:absolute;left:0;right:0;top:80px;height:40px;border-radius:10px;background:rgba(14,165,233,.16);border:1px solid rgba(56,189,248,.35);pointer-events:none}\n.cce-colon{font-size:22px;font-weight:900;color:#7dd3fc;padding:0 2px;position:relative;top:-2px}\n.cce-wheel{height:200px;overflow-y:auto;scroll-snap-type:y mandatory;scrollbar-width:none;outline:0;position:relative;\n  -webkit-mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent)}\n.cce-wheel::-webkit-scrollbar{display:none}\n.cce-wheel div{height:40px;display:grid;place-items:center;scroll-snap-align:center;font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;color:rgba(203,213,225,.55);cursor:pointer;transition:color .15s,transform .2s cubic-bezier(.2,.8,.2,1),font-size .15s}\n.cce-wheel div.pad{cursor:default}\n.cce-wheel div.on{color:#f0f9ff;font-size:22px;font-weight:900;transform:scale(1.04)}\n.cce-wheel:focus-visible div.on{color:#7dd3fc}\n.cce-tquick{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(148,163,184,.12)}\n.cce-tquick button{flex:1;border:1px solid rgba(148,163,184,.2);background:rgba(30,41,59,.6);color:var(--k-tx);border-radius:8px;padding:5px 0;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;cursor:pointer;transition:border-color .12s,background .12s}\n.cce-tquick button:hover{border-color:#38bdf8;background:rgba(14,165,233,.14)}\n.cce-tdone{width:100%;margin-top:8px;border:0;border-radius:9px;padding:8px;background:#0ea5e9;color:#fff;font-weight:800;font-size:13px;cursor:pointer}\n.cce-row{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:10px}\n.cce-lb{display:block;font-size:12px;font-weight:700;color:var(--k-mute);margin:0 0 6px}\n.cce-box{border:1px solid rgba(148,163,184,.14);border-radius:12px;background:rgba(15,23,42,.45);max-height:220px;overflow-y:auto;padding:6px 10px 10px;margin-top:8px}\n.cce-cat{font-size:11.5px;font-weight:800;color:var(--k-mute);margin:10px 2px 6px;display:flex;gap:6px}\n.cce-cat span{opacity:.6;font-weight:600}\n.cce-chips{display:flex;flex-wrap:wrap;gap:6px}\n.cce-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:10px;border:1px solid rgba(148,163,184,.2);background:rgba(30,41,59,.6);font-size:12.5px;font-weight:700;cursor:pointer;user-select:none;color:var(--k-tx);transition:background .12s,border-color .12s}\n.cce-chip:hover{border-color:rgba(56,189,248,.5)}\n.cce-chip i{font-style:normal;font-size:11px;opacity:.55}\n.cce-chip input,.cce-tg input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}\n.cce-chip:has(input:checked){background:rgba(14,165,233,.18);border-color:#38bdf8;color:#e0f2fe}\n.cce-chip:has(input:checked) i{opacity:1}\n.cce-chip:has(input:focus-visible),.cce-tg:has(input:focus-visible){outline:2px solid #38bdf8;outline-offset:2px}\n.cce-picked{display:flex;flex-wrap:wrap;gap:6px;min-height:20px;font-size:12px;color:var(--k-mute)}\n.cce-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:99px;background:rgba(14,165,233,.16);color:#bae6fd;font-weight:700}\n.cce-pill button{border:0;background:rgba(2,6,23,.4);color:#bae6fd;border-radius:50%;width:18px;height:18px;line-height:18px;cursor:pointer;font-size:12px;padding:0}\n.cce-tglist{display:flex;flex-direction:column;gap:4px}\n.cce-tg{position:relative;display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;cursor:pointer;border:1px solid transparent}\n.cce-tg:hover{background:rgba(30,41,59,.7)}\n.cce-tg b{font-size:13px;font-weight:700;color:var(--k-tx);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.cce-tg small{font-size:11px;color:var(--k-mute);font-variant-numeric:tabular-nums}\n.cce-tg .cce-dot{width:16px;height:16px;border-radius:50%;border:2px solid rgba(148,163,184,.4);flex:none}\n.cce-tg:has(input:checked){background:rgba(14,165,233,.14);border-color:rgba(56,189,248,.6)}\n.cce-tg:has(input:checked) .cce-dot{border-color:#38bdf8;background:radial-gradient(#38bdf8 45%,transparent 50%)}\n.cce-link{background:none;border:0;color:#7dd3fc;font-size:12px;font-weight:700;cursor:pointer;padding:0}\n.cce-adv{border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:0 14px}\n.cce-adv summary{cursor:pointer;list-style:none;padding:14px 0;display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px;color:var(--k-tx-strong)}\n.cce-adv summary::-webkit-details-marker{display:none}\n.cce-adv summary::after{content:'';width:8px;height:8px;border-right:2px solid var(--k-mute);border-bottom:2px solid var(--k-mute);transform:rotate(45deg);margin:0 4px 4px auto;transition:transform .15s}\n.cce-adv[open] summary::after{transform:rotate(225deg);margin-bottom:-4px}\n.cce-adv summary span{font-size:12px;font-weight:600;color:var(--k-mute)}\n.cce-ta{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:11px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:var(--k-tx);font-size:13px;line-height:1.55;resize:vertical;outline:none;font-family:inherit}\n.cce-ta:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.15)}\n.cce-f{margin-bottom:14px}\n.cce-vars{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}\n.cce-vars button{border:1px solid rgba(148,163,184,.2);background:rgba(30,41,59,.6);color:#bae6fd;border-radius:7px;padding:2px 7px;font-size:11.5px;font-weight:700;cursor:pointer}\n.cce-vars button:hover{border-color:#38bdf8}\n.cce-switch{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px}\n.cce-switch input{appearance:none;width:38px;height:22px;border-radius:99px;background:rgba(148,163,184,.3);position:relative;cursor:pointer;transition:background .15s;flex:none;margin:0}\n.cce-switch input::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}\n.cce-switch input:checked{background:#0ea5e9}\n.cce-switch input:checked::after{left:19px}\n.cce-ph{font-size:12px;font-weight:800;color:var(--k-mute);margin:0 0 8px;display:flex;align-items:center;gap:6px}\n.cce-ph em{font-style:normal;font-weight:600;opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.cce-dc{background:#313338;border-radius:12px;padding:12px 14px;display:flex;gap:12px;margin-bottom:18px}\n.cce-av{width:36px;height:36px;border-radius:50%;background:#0ea5e9;display:grid;place-items:center;font-size:17px;flex:none}\n.cce-dcn{font-size:13.5px;font-weight:700;color:#f2f3f5;display:flex;align-items:center;gap:6px;margin-bottom:2px}\n.cce-dcn span{background:#5865f2;color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px}\n.cce-dct{font-size:13.5px;line-height:1.45;color:#dbdee1;white-space:pre-wrap;word-break:break-word}\n.cce-dct code{background:#2b2d31;border:1px solid #1e1f22;border-radius:4px;padding:0 4px;font-size:12.5px}\n.cce-tgw{background:#0e1621;border-radius:12px;padding:14px;display:flex;justify-content:flex-end}\n.cce-tgb{background:#2b5278;color:#fff;border-radius:14px 14px 4px 14px;padding:9px 12px 6px;max-width:92%;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}\n.cce-tgb small{display:block;text-align:right;font-size:11px;color:#a5c6e6;margin-top:4px}\n.cce-seg{display:inline-flex;background:rgba(15,23,42,.7);border-radius:9px;padding:3px;margin-left:auto}\n.cce-seg button{border:0;background:none;color:var(--k-mute);font-size:11.5px;font-weight:700;padding:4px 9px;border-radius:7px;cursor:pointer}\n.cce-seg button.on{background:rgba(14,165,233,.25);color:#e0f2fe}\n@media (max-width:520px){.cce-row{grid-template-columns:1fr}.cce-pop .swal2-title,.cce-pop .swal2-html-container,.cce-pop .swal2-actions{padding-left:16px;padding-right:16px}}\n@media (max-width:860px){.cce{grid-template-columns:1fr}.cce-main,.cce-side{max-height:none;overflow:visible}.cce-pop .swal2-html-container{max-height:72vh;overflow-y:auto}}\n@media (prefers-reduced-motion:reduce){.cce *{transition:none!important}.cce-wheel{scroll-behavior:auto}}`;
    const st = document.createElement('style');
    st.id = 'cce-style';
    st.textContent = css;
    document.head.appendChild(st);
  }
  let _ccPrevMode = 'full';
  window.ccEditSchedule = async function(id, copy) {
    if (!can()) return;
    await loadBase();
    if (!webNames().length) {
      await Swal.fire({
        ...SWAL,
        icon: 'info',
        title: 'ตั้งรายชื่อเว็บก่อน',
        text: 'ไปที่แท็บย่อย "รายชื่อเว็บ" แล้วกดบันทึกก่อนครับ'
      });
      return window.ccSetSub('webs');
    }
    ensureEditorStyle();
    _ccPrevMode = 'full';
    const src = id ? _schedules.find((x => Number(x.id) === Number(id))) : null;
    const s = src ? {
      ...src
    } : {
      name: '',
      time: '',
      channel_ids: [],
      telegram_chat_id: '',
      ask_template: DEF.ask,
      report_template: DEF.report,
      line_template: DEF.line,
      missing_template: DEF.missing,
      active: true
    };
    if (copy) {
      s.name = (s.name || '') + ' (สำเนา)';
      s.time = '';
    }
    const isEdit = src && !copy;
    const selCh = new Set((s.channel_ids || []).map(String));
    const groups = {};
    (_settings.channels || []).forEach((c => {
      (groups[c.category || 'ไม่มีหมวด'] = groups[c.category || 'ไม่มีหมวด'] || []).push(c);
    }));
    const knownIds = new Set((_settings.channels || []).map((c => String(c.id))));
    const unknown = [ ...selCh ].filter((x => !knownIds.has(x)));
    const chHtml = Object.keys(groups).length ? Object.entries(groups).map((([cat, chs]) => `\n            <div class="cc-chgroup">\n                <div class="cce-cat">${esc(cat)} <span>${chs.length}</span></div>\n                <div class="cce-chips">${chs.map((c => `<label class="cce-chip cc-chitem" data-name="${esc(String(c.name).toLowerCase())}"><input type="checkbox" class="cc-ch" value="${esc(c.id)}" data-label="${esc(c.name)}" ${selCh.has(String(c.id)) ? 'checked' : ''}><i>${c.type === 'voice' ? '🔊' : '#'}</i>${esc(c.name)}</label>`)).join('')}</div>\n            </div>`)).join('') : `<div style="padding:14px 4px;font-size:12.5px;color:#fbbf24">ยังไม่มีรายชื่อห้องจากบอท ตรวจว่า botlink รันอยู่ หรือใส่ Channel ID เองด้านล่าง</div>`;
    const curTg = tgFind(s.telegram_chat_id);
    const tgHtml = tgList().map((g => `<label class="cce-tg cc-tgitem" data-name="${esc(String(g.name).toLowerCase())} ${esc(g.id)}">\n                <input type="radio" name="ccTg" class="cc-tg" value="${esc(g.id)}" data-label="${esc(g.name)}" ${curTg && normId(curTg.id) === normId(g.id) ? 'checked' : ''}>\n                <span class="cce-dot"></span><b>${esc(g.name)}</b><small>${esc(g.id)}</small></label>`)).join('') || `<div style="padding:14px 4px;font-size:12.5px;color:#fbbf24">ยังไม่มีรายชื่อกลุ่มจากบอท ใส่ Chat ID เองด้านล่างได้</div>`;
    const vars = (taId, list) => `<div class="cce-vars">${list.map((v => `<button type="button" onmousedown="event.preventDefault()" onclick="window.ccInsertVar('${taId}','{${v}}')">{${v}}</button>`)).join('')}</div>`;
    const res = await Swal.fire({
      ...SWAL,
      width: 1040,
      showCancelButton: true,
      focusConfirm: false,
      reverseButtons: true,
      customClass: {
        popup: 'cce-pop'
      },
      title: isEdit ? 'แก้ไขรอบเวลา' : 'เพิ่มรอบเวลา',
      confirmButtonText: isEdit ? 'บันทึกการแก้ไข' : 'บันทึกรอบเวลา',
      cancelButtonText: 'ยกเลิก',
      html: `<div class="cce">\n              <div class="cce-main">\n                <section class="cce-step">\n                    <div class="cce-sh"><span class="cce-num">1</span><h4>ชื่อรอบและเวลา</h4><span class="cce-aside">ส่งทุกวัน · ถามทุกเว็บ</span></div>\n                    <div class="cce-row">\n                        <div><label class="cce-lb" for="ccName">ชื่อรอบ</label><input id="ccName" class="cce-in" value="${esc(s.name)}" placeholder="เช่น กะเช้า รอบที่ 1" oninput="window.ccPreview()"></div>\n                        <div class="cce-tp"><label class="cce-lb" for="ccTimeBtn">เวลา (ไทย)</label>\n                            <input type="hidden" id="ccTime" value="${esc(s.time)}">\n                            <button type="button" id="ccTimeBtn" class="cce-tbtn" aria-haspopup="dialog" aria-expanded="false" onclick="window.ccTimeToggle()">\n                                <span id="ccTimeVal" class="cce-tval${s.time ? '' : ' empty'}">${s.time ? esc(s.time) : 'เลือกเวลา'}</span><span class="cce-tunit">${s.time ? 'น.' : ''}</span>\n                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>\n                            </button>\n                            <div id="ccTimePop" class="cce-tpop" role="dialog" aria-label="เลือกเวลา">\n                                <div class="cce-wheels">\n                                    <div class="cce-wheel" id="ccWheelH" tabindex="0" aria-label="ชั่วโมง"></div>\n                                    <span class="cce-colon">:</span>\n                                    <div class="cce-wheel" id="ccWheelM" tabindex="0" aria-label="นาที"></div>\n                                </div>\n                                <div class="cce-tquick">${[ '08:00', '12:00', '16:00', '20:00', '00:00' ].map((t => `<button type="button" onclick="window.ccTimeSet('${t}', true)">${t}</button>`)).join('')}</div>\n                                <button type="button" class="cce-tdone" onclick="window.ccTimeClose()">ตกลง</button>\n                            </div>\n                        </div>\n                    </div>\n                </section>\n\n                <section class="cce-step">\n                    <div class="cce-sh"><span class="cce-num">2</span><h4>ห้อง Discord ที่จะถาม</h4><span class="cce-aside" id="ccChCount"></span></div>\n                    <div class="cce-picked" id="ccChPicked"></div>\n                    <input id="ccChSearch" class="cce-in" style="margin-top:10px" oninput="window.ccFilterCh(this.value)" placeholder="🔍 ค้นหาห้อง">\n                    <div class="cce-box" onchange="window.ccEdSync()">${chHtml}</div>\n                    <details style="margin-top:8px" ${unknown.length ? 'open' : ''}><summary class="cce-link" style="list-style:none">ห้องไม่อยู่ในรายการ? ใส่ Channel ID เอง</summary>\n                        <input id="ccChExtra" class="cce-in" style="margin-top:8px" value="${esc(unknown.join(', '))}" placeholder="123456789012345678, ..."></details>\n                </section>\n\n                <section class="cce-step">\n                    <div class="cce-sh"><span class="cce-num">3</span><h4>ส่งสรุปเข้ากลุ่ม Telegram</h4><span class="cce-aside">${tgList().length} กลุ่มที่บัญชีอยู่</span></div>\n                    <input id="ccTgSearch" class="cce-in" oninput="window.ccFilterTg(this.value)" placeholder="🔍 ค้นหาชื่อกลุ่ม">\n                    <div class="cce-box cce-tglist" onchange="window.ccEdSync()">${tgHtml}</div>\n                    <details style="margin-top:8px" ${s.telegram_chat_id && !curTg ? 'open' : ''}><summary class="cce-link" style="list-style:none">ไม่เจอกลุ่ม? ใส่ Chat ID เอง</summary>\n                        <input id="ccTgManual" class="cce-in" style="margin-top:8px" value="${curTg ? '' : esc(s.telegram_chat_id || '')}" placeholder="-1001234567890" oninput="window.ccEdSync()"></details>\n                </section>\n\n                <details class="cce-adv">\n                    <summary>ปรับแต่งข้อความ <span>ไม่ต้องแก้ ถ้าใช้รูปแบบเดิม</span></summary>\n                    <div class="cce-f"><label class="cce-lb" for="ccAsk">ข้อความคำถามในห้อง Discord</label>\n                        <textarea id="ccAsk" rows="3" class="cce-ta" oninput="window.ccPreview()">${esc(s.ask_template || DEF.ask)}</textarea>\n                        ${vars('ccAsk', [ 'รอบ', 'วันที่', 'เวลา', 'เว็บทั้งหมด' ])}</div>\n                    <div class="cce-f"><label class="cce-lb" for="ccReport">ข้อความสรุปใน Telegram</label>\n                        <textarea id="ccReport" rows="4" class="cce-ta" oninput="window.ccPreview()">${esc(s.report_template || DEF.report)}</textarea>\n                        ${vars('ccReport', [ 'รายการ', 'รอบ', 'เวลา', 'วันที่', 'รวม', 'ตอบแล้ว', 'ทั้งหมด', 'ยังไม่ตอบ' ])}</div>\n                    <div class="cce-f"><label class="cce-lb" for="ccLine">แต่ละเว็บใน {รายการ} <span style="font-weight:500">· บรรทัดว่างท้ายสุด = เว้นระหว่างเว็บ</span></label>\n                        <textarea id="ccLine" rows="3" class="cce-ta" oninput="window.ccPreview()">${esc(s.line_template || DEF.line)}</textarea>\n                        ${vars('ccLine', [ 'สี', 'เว็บ', 'จำนวน', 'ห้อง', 'ผู้ตอบ' ])}</div>\n                    <div class="cce-f"><label class="cce-lb" for="ccMissing">เว็บที่ยังไม่ตอบ <span style="font-weight:500">· ใช้ตอนกด "ส่งเท่าที่มี" · เว้นว่าง = ไม่แสดง</span></label>\n                        <textarea id="ccMissing" rows="3" class="cce-ta" oninput="window.ccPreview()">${esc(s.missing_template == null ? DEF.missing : s.missing_template)}</textarea>\n                        ${vars('ccMissing', [ 'สี', 'เว็บ' ])}</div>\n                </details>\n\n                <label class="cce-switch" style="margin-top:18px"><input type="checkbox" id="ccActive" ${s.active !== false ? 'checked' : ''}> เปิดใช้งาน ส่งอัตโนมัติตามเวลา</label>\n              </div>\n\n              <aside class="cce-side">\n                <div class="cce-ph">ในห้อง Discord <em id="ccPrevChan"></em></div>\n                <div class="cce-dc"><div class="cce-av">📊</div><div style="min-width:0"><div class="cce-dcn">BotLink <span>BOT</span></div><div class="cce-dct" id="ccPrevAsk"></div></div></div>\n                <div class="cce-ph">ใน Telegram <em id="ccPrevTg"></em>\n                    <div class="cce-seg"><button type="button" id="ccSegFull" class="on" onclick="window.ccPrevMode('full')">ตอบครบ</button><button type="button" id="ccSegPart" onclick="window.ccPrevMode('partial')">ส่งเท่าที่มี</button></div></div>\n                <div class="cce-tgw"><div class="cce-tgb"><span id="ccPrevReport"></span><small id="ccPrevTime"></small></div></div>\n                <div style="font-size:11.5px;color:var(--k-mute);margin-top:10px">ตัวเลขในตัวอย่างเป็นเลขสมมติ</div>\n              </aside>\n            </div>`,
      didOpen: () => {
        initTimeWheels();
        window.ccEdSync();
        const on = document.querySelector('.cc-tg:checked');
        const item = on && on.closest('.cce-tg'), box = item && item.parentElement;
        if (item && box) box.scrollTop = item.offsetTop - box.offsetTop - 8;
      },
      preConfirm: () => {
        const name = $('ccName').value.trim();
        const time = $('ccTime').value.trim();
        if (!name) return Swal.showValidationMessage('ใส่ชื่อรอบ');
        if (!/^\d{2}:\d{2}$/.test(time)) return Swal.showValidationMessage('ใส่เวลาส่ง');
        const extra = $('ccChExtra').value.split(/[\s,]+/).map((x => x.trim())).filter(Boolean);
        if (extra.some((x => !/^\d{15,22}$/.test(x)))) return Swal.showValidationMessage('Channel ID ที่ใส่เองต้องเป็นตัวเลข 15-22 หลัก');
        const channel_ids = [ ...new Set([ ...document.querySelectorAll('.cc-ch:checked') ].map((x => x.value)).concat(extra)) ];
        if (!channel_ids.length) return Swal.showValidationMessage('เลือกห้อง Discord อย่างน้อย 1 ห้อง');
        const picked = document.querySelector('.cc-tg:checked');
        const tg = $('ccTgManual').value.trim() || (picked ? picked.value : '');
        if (!tg) return Swal.showValidationMessage('เลือกกลุ่ม Telegram ที่จะรับสรุป');
        if (window.normChatId && !window.normChatId(tg)) return Swal.showValidationMessage('Chat ID Telegram ต้องเป็นตัวเลข');
        return {
          name: name,
          time: time,
          days: [ 0, 1, 2, 3, 4, 5, 6 ],
          channel_ids: channel_ids,
          webs: [],
          telegram_chat_id: tg,
          ask_template: $('ccAsk').value,
          report_template: $('ccReport').value,
          line_template: $('ccLine').value,
          missing_template: $('ccMissing').value,
          active: $('ccActive').checked,
          updated_at: (new Date).toISOString()
        };
      }
    });
    if (!res.isConfirmed || !res.value) return;
    const q = isEdit ? appDB.from('chatcount_schedules').update(res.value).eq('id', src.id) : appDB.from('chatcount_schedules').insert([ res.value ]);
    const {error: error} = await q;
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'บันทึกไม่ได้',
      text: error.message
    });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'บันทึกรอบเวลาแล้ว',
      showConfirmButton: false,
      timer: 1500
    });
    window.ccLoadSchedules();
  };
  const ROW = 40;
  const pad2 = n => String(n).padStart(2, '0');
  function buildWheel(el, count) {
    el.innerHTML = '<div class="pad"></div><div class="pad"></div>' + Array.from({
      length: count
    }, ((_, i) => `<div data-v="${i}">${pad2(i)}</div>`)).join('') + '<div class="pad"></div><div class="pad"></div>';
    let t = null;
    el.addEventListener('scroll', (() => {
      markWheel(el);
      clearTimeout(t);
      t = setTimeout((() => commitTime()), 90);
    }), {
      passive: true
    });
    el.addEventListener('click', (e => {
      const d = e.target.closest('div[data-v]');
      if (d) scrollWheelTo(el, Number(d.dataset.v), true);
    }));
    el.addEventListener('keydown', (e => {
      const max = el.querySelectorAll('div[data-v]').length - 1;
      const cur = wheelIndex(el);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollWheelTo(el, Math.min(max, cur + 1), true);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollWheelTo(el, Math.max(0, cur - 1), true);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        window.ccTimeClose();
      }
    }));
  }
  const wheelIndex = el => Math.round(el.scrollTop / ROW);
  function markWheel(el) {
    const i = wheelIndex(el);
    el.querySelectorAll('div[data-v]').forEach((d => d.classList.toggle('on', Number(d.dataset.v) === i)));
  }
  function scrollWheelTo(el, i, smooth) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({
      top: i * ROW,
      behavior: smooth && !reduce ? 'smooth' : 'auto'
    });
    markWheel(el);
  }
  function commitTime() {
    const h = $('ccWheelH'), m = $('ccWheelM');
    if (!h || !m) return;
    setTimeDisplay(`${pad2(wheelIndex(h))}:${pad2(wheelIndex(m))}`);
  }
  function setTimeDisplay(v) {
    const inp = $('ccTime'), val = $('ccTimeVal');
    if (!inp || !val) return;
    if (inp.value === v && !val.classList.contains('empty')) return;
    inp.value = v;
    val.textContent = v;
    val.classList.remove('empty');
    val.nextElementSibling.textContent = 'น.';
    window.ccPreview();
  }
  function initTimeWheels() {
    const h = $('ccWheelH'), m = $('ccWheelM');
    if (!h || !m) return;
    buildWheel(h, 24);
    buildWheel(m, 60);
  }
  function onOutside(e) {
    const tp = document.querySelector('.cce-tp');
    if (tp && !tp.contains(e.target)) window.ccTimeClose();
  }
  function onEsc(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      window.ccTimeClose();
      $('ccTimeBtn')?.focus();
    }
  }
  window.ccTimeToggle = function() {
    const pop = $('ccTimePop');
    if (!pop) return;
    if (pop.classList.contains('open')) return window.ccTimeClose();
    const cur = $('ccTime').value || '09:00';
    const [hh, mm] = cur.split(':').map(Number);
    pop.classList.add('open');
    $('ccTimeBtn').setAttribute('aria-expanded', 'true');
    scrollWheelTo($('ccWheelH'), hh || 0, false);
    scrollWheelTo($('ccWheelM'), mm || 0, false);
    if (!$('ccTime').value) setTimeDisplay(cur);
    setTimeout((() => $('ccWheelH')?.focus({
      preventScroll: true
    })), 30);
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onEsc, true);
  };
  window.ccTimeClose = function() {
    const pop = $('ccTimePop');
    if (!pop || !pop.classList.contains('open')) return;
    commitTime();
    pop.classList.remove('open');
    $('ccTimeBtn')?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onEsc, true);
  };
  window.ccTimeSet = function(v, smooth) {
    const [hh, mm] = v.split(':').map(Number);
    scrollWheelTo($('ccWheelH'), hh, smooth);
    scrollWheelTo($('ccWheelM'), mm, smooth);
    setTimeDisplay(v);
  };
  window.ccEdSync = function() {
    const boxes = [ ...document.querySelectorAll('.cc-ch:checked') ];
    const picked = $('ccChPicked');
    if (picked) {
      picked.innerHTML = boxes.length ? boxes.map((b => `<span class="cce-pill">${esc(b.dataset.label)}<button type="button" aria-label="เอาออก" onclick="window.ccUnpick('${esc(b.value)}')">×</button></span>`)).join('') : 'ยังไม่ได้เลือกห้อง';
    }
    const cnt = $('ccChCount');
    if (cnt) cnt.textContent = boxes.length ? `เลือก ${boxes.length} ห้อง` : '';
    const prevCh = $('ccPrevChan');
    if (prevCh) prevCh.textContent = boxes.length ? '#' + boxes[0].dataset.label + (boxes.length > 1 ? ` และอีก ${boxes.length - 1} ห้อง` : '') : '';
    const tg = document.querySelector('.cc-tg:checked');
    const manual = $('ccTgManual') ? $('ccTgManual').value.trim() : '';
    const prevTg = $('ccPrevTg');
    if (prevTg) prevTg.textContent = manual ? manual : tg ? tg.dataset.label : '';
    window.ccPreview();
  };
  window.ccUnpick = function(val) {
    const b = [ ...document.querySelectorAll('.cc-ch') ].find((x => x.value === val));
    if (b) {
      b.checked = false;
      window.ccEdSync();
    }
  };
  window.ccInsertVar = function(taId, token) {
    const ta = $(taId);
    if (!ta) return;
    const st = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, st) + token + ta.value.slice(en);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = st + token.length;
    window.ccPreview();
  };
  window.ccPrevMode = function(m) {
    _ccPrevMode = m;
    $('ccSegFull')?.classList.toggle('on', m === 'full');
    $('ccSegPart')?.classList.toggle('on', m === 'partial');
    window.ccPreview();
  };
  window.ccFilterTg = function(q) {
    q = String(q || '').trim().toLowerCase();
    document.querySelectorAll('.cc-tgitem').forEach((el => {
      el.style.display = !q || el.dataset.name.includes(q) ? '' : 'none';
    }));
  };
  window.ccFilterCh = function(q) {
    q = String(q || '').trim().toLowerCase();
    document.querySelectorAll('.cc-chitem').forEach((el => {
      el.style.display = !q || el.dataset.name.includes(q) ? '' : 'none';
    }));
    document.querySelectorAll('.cc-chgroup').forEach((g => {
      const any = [ ...g.querySelectorAll('.cc-chitem') ].some((el => el.style.display !== 'none'));
      g.style.display = any ? '' : 'none';
    }));
  };
  const dcMd = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  window.ccPreview = function() {
    const a = $('ccAsk');
    if (!a) return;
    const sample = webNames();
    const name = $('ccName').value.trim() || 'กะเช้า รอบที่ 1';
    const time = $('ccTime').value || '12:00';
    const date = thaiDate(thaiToday());
    $('ccPrevAsk').innerHTML = dcMd(render(a.value, {
      'รอบ': name,
      'วันที่': date,
      'เวลา': thaiTime(time),
      'เว็บทั้งหมด': sample.join(', ')
    }).trim());
    const partial = _ccPrevMode === 'partial';
    const missing = partial ? sample.slice(-2) : [];
    let total = 0, answered = 0;
    const lines = sample.map(((w, i) => {
      if (missing.includes(w)) return $('ccMissing').value.trim() ? render($('ccMissing').value, {
        'เว็บ': w,
        'สี': webEmoji(w)
      }) : null;
      const n = [ 2, 0, 9, 3, 7, 1, 0, 4, 5, 3 ][i % 10];
      total += n;
      answered++;
      return render($('ccLine').value, {
        'เว็บ': w,
        'สี': webEmoji(w),
        'จำนวน': n,
        'ห้อง': 'ห้อง ' + (i + 1),
        'ผู้ตอบ': 'BOB'
      });
    })).filter((x => x != null));
    $('ccPrevReport').textContent = render($('ccReport').value, {
      'วันที่': date,
      'รอบ': name,
      'เวลา': thaiTime(time),
      'รายการ': lines.join('\n'),
      'รวม': total,
      'ตอบแล้ว': answered,
      'ทั้งหมด': sample.length,
      'ยังไม่ตอบ': missing.join(', ') || '-'
    }).trim();
    $('ccPrevTime').textContent = time;
  };
  window.ccToggleSchedule = async function(id) {
    const s = _schedules.find((x => Number(x.id) === Number(id)));
    if (!s) return;
    const {error: error} = await appDB.from('chatcount_schedules').update({
      active: !s.active,
      updated_at: (new Date).toISOString()
    }).eq('id', id);
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'ผิดพลาด',
      text: error.message
    });
    window.ccLoadSchedules();
  };
  window.ccDeleteSchedule = async function(id) {
    const s = _schedules.find((x => Number(x.id) === Number(id)));
    if (!s) return;
    const ok = await Swal.fire({
      ...SWAL,
      icon: 'warning',
      title: `ลบรอบ ${esc(s.time)} "${esc(s.name)}"?`,
      text: 'ประวัติรอบที่ถามไปแล้วยังอยู่',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    });
    if (!ok.isConfirmed) return;
    const {error: error} = await appDB.from('chatcount_schedules').delete().eq('id', id);
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'ผิดพลาด',
      text: error.message
    });
    window.ccLoadSchedules();
  };
  window.ccSendNow = async function(id) {
    const s = _schedules.find((x => Number(x.id) === Number(id)));
    if (!s) return;
    const ok = await Swal.fire({
      ...SWAL,
      icon: 'question',
      title: `ส่งคำถาม "${esc(s.name)}" ตอนนี้?`,
      text: `ส่งเข้า ${(s.channel_ids || []).length} ห้อง (ไม่กระทบรอบอัตโนมัติตามเวลา)`,
      showCancelButton: true,
      confirmButtonText: 'ส่งเลย',
      cancelButtonText: 'ยกเลิก'
    });
    if (!ok.isConfirmed) return;
    const row = {
      schedule_id: s.id,
      trigger: 'manual',
      label: s.name,
      round_date: thaiToday(),
      round_time: thaiHHMM(),
      channel_ids: s.channel_ids || [],
      expected_webs: webNames(),
      telegram_chat_id: s.telegram_chat_id,
      ask_template: s.ask_template,
      report_template: s.report_template,
      line_template: s.line_template,
      missing_template: s.missing_template
    };
    const {error: error} = await appDB.from('chatcount_rounds').insert([ row ]);
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'ส่งไม่ได้',
      text: error.message
    });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'สั่งแล้ว · บอทจะส่งเข้าห้องภายใน ~15 วินาที',
      showConfirmButton: false,
      timer: 2500
    });
    $('ccLiveDate').value = thaiToday();
    window.ccSetSub('live');
  };
  let _webDraft = null;
  function renderWebs() {
    const box = $('ccView_webs');
    if (!_webDraft) {
      const cur = (_settings.webs || []).map((w => typeof w === 'string' ? {
        name: w
      } : {
        name: w.name,
        emoji: w.emoji
      }));
      const seed = typeof TEAM_LIST !== 'undefined' && Array.isArray(TEAM_LIST) ? TEAM_LIST : [];
      _webDraft = (cur.length ? cur : seed.map((n => ({
        name: n
      })))).map((w => ({
        name: w.name,
        emoji: w.emoji || DEF_EMOJI[w.name] || ''
      })));
    }
    box.innerHTML = `\n            <div style="font-size:12px;color:var(--k-mute);margin-bottom:10px">\n                พนักงานต้องพิมพ์ชื่อเว็บ<b style="color:#fbbf24">ตรงทุกตัวอักษร (รวมตัวพิมพ์ใหญ่/เล็ก)</b> ตามที่ตั้งไว้ในนี้ ถ้าพิมพ์ผิด บอทจะไม่รับและแจ้งให้รีพลายใหม่\n                · ชื่อต้องขึ้นต้นด้วยตัวอักษรอังกฤษ · ลำดับในนี้ = ลำดับในข้อความสรุป · ช่องซ้าย = อีโมจิประจำเว็บ (ใช้แทน <b>{สี}</b> ในแพทเทิร์น)\n            </div>\n            <div style="display:flex;flex-direction:column;gap:6px">\n                ${_webDraft.map(((w, i) => `\n                <div style="display:flex;gap:6px;align-items:center">\n                    <span style="width:22px;text-align:right;color:var(--k-mute);font-weight:800">${i + 1}</span>\n                    <input oninput="window.ccWebSet(${i},'emoji',this.value)" value="${esc(w.emoji || '')}" placeholder="🔵" title="อีโมจิประจำเว็บ ใช้แทน {สี}" style="${FD}width:64px;flex:none;text-align:center;font-size:16px">\n                    <input oninput="window.ccWebSet(${i},'name',this.value)" value="${esc(w.name)}" placeholder="ชื่อเว็บ เช่น MK8" style="${FD}flex:1;max-width:320px;font-family:monospace">\n                    <button onclick="window.ccWebMove(${i},-1)" style="${BTN}" title="เลื่อนขึ้น">${MI('arrow_upward')}</button>\n                    <button onclick="window.ccWebMove(${i},1)" style="${BTN}" title="เลื่อนลง">${MI('arrow_downward')}</button>\n                    <button onclick="window.ccWebDel(${i})" style="${BTN}color:#f87171">${MI('delete')}</button>\n                </div>`)).join('')}\n            </div>\n            <div style="display:flex;gap:6px;margin-top:12px">\n                <button onclick="window.ccWebAdd()" style="${BTN}">${MI('add')} เพิ่มเว็บ</button>\n                <button onclick="window.ccWebSave()" style="${BTN_MAIN}">${MI('save')} บันทึก</button>\n            </div>`;
  }
  window.ccWebSet = (i, k, v) => {
    _webDraft[i][k] = v;
  };
  window.ccWebMove = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= _webDraft.length) return;
    [_webDraft[i], _webDraft[j]] = [ _webDraft[j], _webDraft[i] ];
    renderWebs();
  };
  window.ccWebDel = i => {
    _webDraft.splice(i, 1);
    renderWebs();
  };
  window.ccWebAdd = () => {
    _webDraft.push({
      name: '',
      emoji: ''
    });
    renderWebs();
  };
  window.ccWebSave = async function() {
    const webs = _webDraft.map((w => ({
      name: String(w.name || '').trim(),
      emoji: String(w.emoji || '').trim()
    }))).filter((w => w.name));
    const names = webs.map((w => w.name.toLowerCase()));
    if (new Set(names).size !== names.length) return Swal.fire({
      ...SWAL,
      icon: 'warning',
      title: 'ชื่อเว็บซ้ำกัน'
    });
    const bad = webs.find((w => !/^[A-Za-z][A-Za-z0-9]*$/.test(w.name)));
    if (bad) return Swal.fire({
      ...SWAL,
      icon: 'warning',
      title: `ชื่อ "${esc(bad.name)}" ใช้ไม่ได้`,
      text: 'ต้องขึ้นต้นด้วยตัวอักษรอังกฤษ และมีแค่ตัวอักษร/ตัวเลข ไม่มีเว้นวรรคหรือสัญลักษณ์'
    });
    const {error: error} = await appDB.from('chatcount_settings').update({
      webs: webs
    }).eq('id', 1);
    if (error) return Swal.fire({
      ...SWAL,
      icon: 'error',
      title: 'บันทึกไม่ได้',
      text: error.message
    });
    _settings.webs = webs;
    _webDraft = null;
    renderWebs();
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'บันทึกรายชื่อเว็บแล้ว',
      showConfirmButton: false,
      timer: 1500
    });
  };
})();
