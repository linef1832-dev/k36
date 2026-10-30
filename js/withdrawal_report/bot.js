const BOT_SETTING_KEY = 'tg_bot_token';

const CHATID_SETTING_KEY = 'tg_bot_chatid';

window.toggleTokenVisibility = function() {
  const inp = document.getElementById('botTokenInput');
  const icon = document.getElementById('tokenEyeIcon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    inp.type = 'password';
    icon.textContent = 'visibility';
  }
};

window.openBotSettings = function() {
  switchCaseTab('settings');
};

async function _loadBotStatus() {
  try {
    const {data: data} = await appDB.from('settings').select('key,value').in('key', [ BOT_SETTING_KEY, CHATID_SETTING_KEY ]);
    const map = {};
    (data || []).forEach((r => {
      map[r.key] = r.value;
    }));
    const token = map[BOT_SETTING_KEY] || '';
    const chatId = map[CHATID_SETTING_KEY] || '';
    const inp1 = document.getElementById('botTokenInput');
    const inp2 = document.getElementById('botChatIdInput');
    if (inp1 && token) inp1.value = token;
    if (inp2 && chatId) inp2.value = chatId;
    if (token) {
      await _verifyBotToken(token, chatId, false);
    } else {
      _setBotStatusUI(false, null, chatId);
    }
  } catch (e) {
    console.warn('loadBotStatus:', e);
  }
}

window.testBotConnection = async function() {
  const token = (document.getElementById('botTokenInput')?.value || '').trim();
  const chatId = (document.getElementById('botChatIdInput')?.value || '').trim();
  if (!token) return _showTestResult(false, 'กรุณาใส่ Bot Token ก่อน');
  const btn = document.getElementById('btnTestBot');
  btn.innerHTML = `<span class="material-icons text-sm animate-spin">sync</span> กำลังทดสอบ...`;
  btn.disabled = true;
  await _verifyBotToken(token, chatId, true);
  btn.innerHTML = `<span class="material-icons text-sm">wifi_tethering</span> ทดสอบ`;
  btn.disabled = false;
};

async function _verifyBotToken(token, chatId, showResult) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const json = await r.json();
    if (!json.ok) throw new Error(json.description || 'Token ไม่ถูกต้อง');
    const bot = json.result;
    _setBotStatusUI(true, bot, chatId);
    if (showResult) _showTestResult(true, `เชื่อมต่อสำเร็จ! ชื่อบอท: ${bot.first_name} (@${bot.username})`);
    return true;
  } catch (e) {
    _setBotStatusUI(false, null, chatId);
    if (showResult) _showTestResult(false, e.message);
    return false;
  }
}

function _setBotStatusUI(connected, botInfo, chatId) {
  const dot = document.getElementById('botStatusDot');
  const txt = document.getElementById('botStatusText');
  const disc = document.getElementById('btnDisconnect');
  if (dot) dot.style.background = connected ? '#10b981' : '#94a3b8';
  if (txt) txt.textContent = connected ? `เชื่อมต่อแล้ว: @${botInfo?.username || '...'}` : 'ยังไม่ได้เชื่อมต่อบอท';
  const sName = document.getElementById('sBot_name');
  const sUser = document.getElementById('sBot_username');
  const sStatus = document.getElementById('sBot_status');
  const sChatId = document.getElementById('sBot_chatid');
  if (sStatus) sStatus.textContent = connected ? '✅ เชื่อมต่อแล้ว' : '❌ ไม่ได้เชื่อมต่อ';
  if (sStatus) sStatus.style.color = connected ? 'var(--k-green-tx)' : 'var(--k-red-tx)';
  if (sName) sName.textContent = botInfo?.first_name || '—';
  if (sUser) sUser.textContent = botInfo ? `@${botInfo.username}` : '—';
  if (sChatId) sChatId.textContent = chatId || '—';
  if (disc) disc.classList.toggle('hidden', !connected);
}

function _showTestResult(ok, msg) {
  const el = document.getElementById('botTestResult');
  if (!el) return;
  el.className = '';
  el.style.cssText = `margin-top:10px;padding:11px 14px;border-radius:12px;font-size:13px;font-weight:800;${ok ? 'background:rgba(16,185,129,.1);color:var(--k-green-tx);border:1px solid rgba(16,185,129,.3)' : 'background:rgba(239,68,68,.1);color:var(--k-red-tx);border:1px solid rgba(239,68,68,.3)'}`;
  el.textContent = (ok ? '✅ ' : '❌ ') + msg;
  el.classList.remove('hidden');
  setTimeout((() => el.classList.add('hidden')), 5e3);
}

window.saveBotSettings = async function() {
  const token = (document.getElementById('botTokenInput')?.value || '').trim();
  const chatId = (document.getElementById('botChatIdInput')?.value || '').trim();
  if (!token) return Swal.fire('แจ้งเตือน', 'กรุณาใส่ Bot Token', 'warning');
  const btn = document.getElementById('btnSaveBot');
  btn.innerHTML = `<span class="material-icons text-sm animate-spin">sync</span> กำลังบันทึก...`;
  btn.disabled = true;
  const ok = await _verifyBotToken(token, chatId, false);
  if (!ok) {
    btn.innerHTML = `<span class="material-icons text-sm">save</span> บันทึกและเชื่อมต่อ`;
    btn.disabled = false;
    return Swal.fire('ผิดพลาด', 'Bot Token ไม่ถูกต้อง — กรุณาตรวจสอบใหม่', 'error');
  }
  try {
    const {error: saveErr} = await appDB.from('settings').upsert([ {
      key: BOT_SETTING_KEY,
      value: token
    }, {
      key: CHATID_SETTING_KEY,
      value: chatId
    } ]);
    if (saveErr) throw saveErr;
    const now = (new Date).toLocaleString('th-TH');
    const sSaved = document.getElementById('sBot_saved');
    if (sSaved) sSaved.textContent = now;
    Swal.fire({
      icon: 'success',
      title: 'บันทึกแล้ว',
      text: 'เชื่อมต่อบอทเรียบร้อย',
      timer: 2e3,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  } finally {
    btn.innerHTML = `<span class="material-icons text-sm">save</span> บันทึกและเชื่อมต่อ`;
    btn.disabled = false;
  }
};

window.disconnectBot = async function() {
  const res = await Swal.fire({
    title: 'ยืนยันการยกเลิก?',
    text: 'จะลบ Token ออกจากระบบ',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444'
  });
  if (!res.isConfirmed) return;
  const {error: delErr} = await appDB.from('settings').delete().in('key', [ BOT_SETTING_KEY, CHATID_SETTING_KEY ]);
  if (delErr) return Swal.fire('ยกเลิกไม่สำเร็จ', delErr.message, 'error');
  document.getElementById('botTokenInput').value = '';
  document.getElementById('botChatIdInput').value = '';
  _setBotStatusUI(false, null, '');
  Swal.fire({
    icon: 'success',
    title: 'ยกเลิกแล้ว',
    timer: 1500,
    showConfirmButton: false
  });
};

window.helpGetChatId = function() {
  Swal.fire({
    title: 'วิธีหา Chat ID',
    html: `\n            <div class="text-left text-sm space-y-3">\n                <p>1. เพิ่ม <strong>@userinfobot</strong> เข้ากลุ่ม</p>\n                <p>2. พิมพ์ <strong>/start</strong> ในกลุ่ม</p>\n                <p>3. บอทจะตอบกลับพร้อม Chat ID (เริ่มด้วย -100...)</p>\n                <hr class="border-slate-600 my-2">\n                <p>หรือใช้วิธีนี้:</p>\n                <p>1. Forward ข้อความจากกลุ่มไปให้ <strong>@getidsbot</strong></p>\n                <p>2. บอทจะบอก Chat ID ให้</p>\n            </div>`,
    confirmButtonText: 'เข้าใจแล้ว',
    background: '#1e293b',
    color: '#e2e8f0'
  });
};

window.exportCaseExcel = async function() {
  if (!_caseData.length) return Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูล', 'warning');
  if (typeof XLSX === 'undefined') {
    await new Promise(((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    }));
  }
  const rows = [ [ '#', 'เวลา', 'พนักงาน', 'ประเภท', 'เว็บ', 'ตอบใคร', 'ข้อความ' ] ];
  _caseData.forEach(((d, i) => {
    const t = new Date(d.created_at).toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok'
    });
    rows.push([ i + 1, t, d.sender_name, d.case_type || 'reply', d.site || '', d.quoted_from || '', d.message_text || '' ]);
  }));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cases');
  XLSX.writeFile(wb, `tg_cases_${_caseDate}.xlsx`);
};

window.loadSummary = async function(silent) {
  const period = document.getElementById('summaryPeriod')?.value || 'month';
  const shiftFilter = document.getElementById('summaryShift')?.value || 'ALL';
  const customDiv = document.getElementById('summaryCustomRange');
  if (customDiv) {
    customDiv.classList.toggle('hidden', period !== 'custom');
    customDiv.style.display = period === 'custom' ? 'flex' : 'none';
  }
  const thNow = new Date(Date.now() + 7 * 60 * 60 * 1e3);
  const ymd = d => d.toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
  let fromDate, toDate;
  if (period === 'today') {
    fromDate = toDate = ymd(thNow);
  } else if (period === 'yesterday') {
    fromDate = toDate = ymd(addDays(thNow, -1));
  } else if (period === 'week') {
    const day = thNow.getUTCDay() || 7;
    fromDate = ymd(addDays(thNow, -(day - 1)));
    toDate = ymd(thNow);
  } else if (period === 'last_week') {
    const day = thNow.getUTCDay() || 7;
    const mon = addDays(thNow, -(day - 1) - 7);
    fromDate = ymd(mon);
    toDate = ymd(addDays(mon, 6));
  } else if (period === 'month') {
    fromDate = ymd(new Date(Date.UTC(thNow.getUTCFullYear(), thNow.getUTCMonth(), 1)));
    toDate = ymd(thNow);
  } else if (period === 'last_month') {
    fromDate = ymd(new Date(Date.UTC(thNow.getUTCFullYear(), thNow.getUTCMonth() - 1, 1)));
    toDate = ymd(new Date(Date.UTC(thNow.getUTCFullYear(), thNow.getUTCMonth(), 0)));
  } else {
    fromDate = document.getElementById('summaryFrom')?.value;
    toDate = document.getElementById('summaryTo')?.value;
    if (!fromDate || !toDate) return;
  }
  const rangeEl = document.getElementById('summaryDateRange');
  if (rangeEl) rangeEl.textContent = `${fromDate} ถึง ${toDate}`;
  if (!silent) document.getElementById('summaryRanking').innerHTML = `<div class="wr-empty"><span class="material-icons animate-spin">sync</span>กำลังโหลด…</div>`;
  const reqId = window._sumReqId = (window._sumReqId || 0) + 1;
  try {
    const rows = await window._caseFetchAll((() => appDB.from('tg_case_logs').select('sender_name, case_type, site, full_name, message_text, quoted_text').gte('msg_date', fromDate).lte('msg_date', toDate).order('created_at', {
      ascending: true
    })));
    if (reqId !== window._sumReqId) return;
    const total = rows.length;
    const del = rows.filter((d => _caseGroup(d) === 'เช็ค')).length;
    const unb = rows.filter((d => _caseGroup(d) === 'ปลด')).length;
    const other = rows.filter((d => _caseGroup(d) === 'other')).length;
    document.getElementById('sumTotal').textContent = total.toLocaleString();
    document.getElementById('sumDel').textContent = del.toLocaleString();
    document.getElementById('sumUnb').textContent = unb.toLocaleString();
    document.getElementById('sumOther').textContent = other.toLocaleString();
    const counts = {};
    rows.forEach((d => {
      const k = d.sender_name;
      const shift = _getShift(k, d.full_name, _shiftMap);
      if (shiftFilter !== 'ALL' && shift !== shiftFilter) return;
      if (!counts[k]) counts[k] = {
        total: 0,
        "ลบ": 0,
        "เช็ค": 0,
        "ปลด": 0,
        other: 0,
        shift: _getShift(k, d.full_name, _shiftMap),
        display: (() => {
          const m = (k || '').match(/^[^-]+-([^-]+)-/);
          return m ? m[1] : k;
        })()
      };
      counts[k].total++;
      const t = d.case_type || '';
      const grp = _caseGroup(d);
      if (grp === 'เช็ค') counts[k].เช็ค++; else if (grp === 'ปลด') counts[k].ปลด++; else counts[k].other++;
    }));
    const sorted = Object.entries(counts).sort(((a, b) => b[1].total - a[1].total));
    const max = sorted[0]?.[1]?.total || 1;
    const medals = [ '🥇', '🥈', '🥉' ];
    const ranking = document.getElementById('summaryRanking');
    if (sorted.length === 0) {
      ranking.innerHTML = `<div class="wr-empty"><span class="material-icons">inbox</span>ไม่มีข้อมูลในช่วงนี้</div>`;
      return;
    }
    const esc = window.escapeHtml;
    ranking.innerHTML = sorted.map((([name, c], i) => window._caseCardHtml(name, c, i, max, esc, esc, false))).join('');
  } catch (e) {
    if (reqId !== window._sumReqId) return;
    document.getElementById('summaryRanking').innerHTML = `<div class="wr-empty" style="color:var(--k-red-tx)"><span class="material-icons">error_outline</span>${window.escapeHtml(e.message || String(e))}</div>`;
  }
};

document.addEventListener('change', (e => {
  if (e.target?.id === 'summaryPeriod') {
    const show = e.target.value === 'custom';
    const el = document.getElementById('summaryCustomRange');
    if (el) {
      el.classList.toggle('hidden', !show);
      el.style.display = show ? 'flex' : 'none';
    }
  }
}));
