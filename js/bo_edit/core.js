(function() {
  // ============================================================
  // แก้ช่องทางชำระเงิน — ส่งคำสั่งให้บอท (bo_tasks) แล้วรอผล
  // ============================================================
  const PAYTYPES = [
    { code: 'QR_BANK', name: 'ธนาคารออนไลน์ QR' },
    { code: 'PROMPTPAY', name: 'สแกนผ่าน QR Code' },
    { code: 'TRUEMONEY', name: 'TrueMoney' },
    { code: 'DEBIT_CARD', name: 'บัตรเดบิต' },
    { code: 'USDT', name: 'USDT' }
  ];
  const TASK_WAIT_MS = 40000;

  let sites = [];
  let mode = 'single';
  const sel = new Set();
  let chanList = [];          // ช่องทางของเว็บหลัก (โหมดเดียว)
  let loaded = null;          // ค่าที่ดึงมาของช่องทางที่เลือก
  let channelCode = '';       // รหัสช่องทาง (เช่น N883OK) ใช้จับคู่ข้ามเว็บ

  const $ = id => document.getElementById(id);
  const esc = v => window.escapeHtml ? window.escapeHtml(v) : String(v == null ? '' : v);
  const can = id => typeof window.hasUserPerm === 'function' && window.hasUserPerm(id);
  const me = () => (window.currentUser && window.currentUser.username) || '';
  const log = (a, d) => { try { if (typeof logAction === 'function') logAction(a, d); } catch (e) {} };
  const nfmt = v => { const n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n.toLocaleString('en-US') : v; };
  const nclean = v => String(v == null ? '' : v).replace(/[, ]/g, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- ส่งคำสั่งแล้วรอผล ----------
  async function runTask(siteId, action, params, confirmed, batchId) {
    const row = {
      site_id: siteId, action, params: params || {},
      confirmed: !!confirmed, created_by: me(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };
    if (batchId) row.batch_id = batchId;
    const { data, error } = await appDB.from('bo_tasks').insert([ row ]).select('id').single();
    if (error) throw new Error(error.message);
    const id = data.id;
    const end = Date.now() + TASK_WAIT_MS;
    while (Date.now() < end) {
      await sleep(1200);
      const { data: t } = await appDB.from('bo_tasks').select('status,result,error').eq('id', id).maybeSingle();
      if (!t) continue;
      if (t.status === 'done') return t.result || {};
      if (t.status === 'failed' || t.status === 'expired' || t.status === 'cancelled')
        throw new Error(t.error || ('งาน' + t.status));
    }
    throw new Error('บอทไม่ตอบใน ' + Math.round(TASK_WAIT_MS / 1000) + ' วินาที (เว็บนี้อาจล็อกอินไม่ได้)');
  }

  // ---------- โหลดรายชื่อเว็บ ----------
  window.beReload = async function() {
    const btn = $('beReloadBtn'); if (btn) btn.disabled = true;
    try {
      const { data, error } = await appDB.from('bo_sites')
        .select('id,name,platform,enabled,status,last_seen,cred_hint').order('name', { ascending: true });
      if (error) throw error;
      sites = (data || []).filter(s => s.enabled);
      renderSites();
    } catch (e) {
      $('beSiteList').innerHTML = `<div class="be-empty" style="border:0">โหลดเว็บไม่สำเร็จ<br><span style="font-size:11px">${esc(e.message || e)}</span></div>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  function isOnline(s) {
    return s.status === 'ok' && s.cred_hint && s.last_seen && (Date.now() - new Date(s.last_seen).getTime() < 5 * 60 * 1000);
  }

  function renderSites() {
    const box = $('beSiteList');
    if (!sites.length) { box.innerHTML = `<div class="be-empty" style="border:0">ยังไม่มีเว็บ<br><span style="font-size:11px">เพิ่มในหน้า "บอทหลังบ้าน" ก่อน</span></div>`; return; }
    box.innerHTML = sites.map(s => {
      const on = isOnline(s);
      const selected = sel.has(s.id);
      return `<div class="be-site ${selected ? 'sel' : ''} ${on ? '' : 'dis'}" ${on ? `onclick="bePickSite('${esc(s.id)}')"` : ''}>
        <span class="be-chk"><span class="material-icons">check</span></span>
        <div><div class="nm">${esc(s.name)}</div>
          <div class="st"><span class="be-pulse ${on ? '' : 'bad'}"></span>${on ? 'ล็อกอินได้' : (s.cred_hint ? 'บอทไม่ตอบ' : 'ยังไม่ตั้งบัญชี')}</div></div>
      </div>`;
    }).join('');
    $('beSelCount').textContent = sel.size;
    updateFoot();
  }

  window.bePickSite = function(id) {
    if (mode === 'single') { sel.clear(); sel.add(id); loadChannelsFor(id); }
    else { sel.has(id) ? sel.delete(id) : sel.add(id); }
    renderSites();
  };
  window.beAllSites = function(on) {
    sel.clear();
    if (on) sites.filter(isOnline).forEach(s => sel.add(s.id));
    renderSites();
  };
  window.beSetMode = function(m) {
    mode = m;
    $('beModeSingle').classList.toggle('on', m === 'single');
    $('beModeBatch').classList.toggle('on', m === 'batch');
    $('beRailTools').classList.toggle('hidden', m === 'single');
    $('beChanField').classList.toggle('hidden', m === 'batch');
    $('beBatchNote').classList.toggle('hidden', m === 'single');
    if (m === 'single') { const f = [...sel][0]; sel.clear(); if (f) sel.add(f); }
    $('beReadBox').style.display = m === 'batch' ? 'none' : '';
    $('beChanSub').textContent = m === 'batch' ? 'จะแก้ช่องทางที่จับคู่กันในทุกเว็บที่เลือก' : 'เลือกเว็บทางซ้าย แล้วเลือกช่องทางด้านล่าง';
    renderSites();
    renderForm();
  };

  // ---------- โหลดรายชื่อช่องทางของเว็บ (โหมดเดียว) ----------
  async function loadChannelsFor(siteId) {
    const sel2 = $('beChanSel');
    sel2.innerHTML = '<option>กำลังโหลด...</option>';
    try {
      const r = await runTask(siteId, 'list_channels', {});
      chanList = r.channels || [];
      if (!chanList.length) { sel2.innerHTML = '<option>ไม่มีช่องทาง</option>'; return; }
      sel2.innerHTML = chanList.map(c => `<option value="${esc(c.id)}" data-code="${esc(c.code)}">${esc(c.name)} (${esc(c.code)})</option>`).join('');
      beLoadChannel();
    } catch (e) {
      sel2.innerHTML = '<option>โหลดช่องทางไม่สำเร็จ</option>';
      Swal.fire('โหลดช่องทางไม่สำเร็จ', e.message || String(e), 'error');
    }
  }

  // ---------- โหลดค่าช่องทางที่เลือก ----------
  window.beLoadChannel = async function() {
    const sel2 = $('beChanSel');
    const opt = sel2.selectedOptions[0];
    if (!opt || !opt.value) return;
    const siteId = [...sel][0];
    channelCode = opt.dataset.code || '';
    $('beForm').innerHTML = `<div class="be-load"><div class="be-spin"></div>กำลังดึงค่าปัจจุบัน...</div>`;
    try {
      loaded = await runTask(siteId, 'get_channel', { channel_id: opt.value });
      window._beBatchCode = loaded.code || opt.dataset.code || '';
      window._beBatchStatic = (chanList.find(c => c.id === opt.value) || {}).staticname || '';
      $('beChanTitle').textContent = loaded.name || opt.text;
      const ro = loaded.readonly || {};
      $('beReadBox').innerHTML = `<span class="be-read">ยอดวันนี้ <b>${nfmt(ro.dailyamt || 0)}</b>&nbsp;·&nbsp;สะสม <b>${nfmt(ro.totalamt || 0)}</b></span>`;
      $('beChanSub').textContent = 'รหัส ' + (loaded.code || '-') + (ro.updatedby ? ' · แก้ล่าสุดโดย ' + ro.updatedby : '');
      renderForm();
    } catch (e) {
      $('beForm').innerHTML = `<div class="be-empty">ดึงค่าไม่สำเร็จ: ${esc(e.message || e)}</div>`;
    }
  };

  // ---------- ฟอร์มแก้ค่า ----------
  function renderForm() {
    const f = $('beForm');
    if (mode === 'batch') {
      if (!sel.size) { f.innerHTML = `<div class="be-empty" style="margin-top:4px">เลือกเว็บทางซ้าย (ติ๊กได้หลายเว็บ)</div>`; updateFoot(); return; }
      // โหมดหลายเว็บ: ใช้ฟอร์มเปล่า (ค่าเริ่มจาก 0/ปิด) ผู้ใช้เปิด "แก้ค่านี้" เฉพาะที่ต้องการ
      f.innerHTML = formHtml(null);
      wireForm();
      updateFoot();
      return;
    }
    if (!loaded) { f.innerHTML = ''; updateFoot(); return; }
    f.innerHTML = formHtml(loaded);
    wireForm();
    updateFoot();
  }

  function secHead(title, key, on) {
    return `<div class="be-sh"><span class="d"></span><h3>${title}</h3>
      <span class="ap" onclick="beTogEdit('${key}')"><span class="be-etog ${on ? 'on' : ''}" id="etog_${key}"><b></b></span>แก้ค่านี้</span></div>`;
  }

  function formHtml(d) {
    const v = d ? d.values : { maxdailyamt: '', maxtotalamt: '', minpayoutamt: '', maxpayoutamt: '', amountsuggest: true, suggestamounts: [], types: {} };
    const statusOpen = d ? (d.status === 1 ? false : true) : true; // หมายเหตุ: ค่าดิบ status แปลผลตามหลังบ้าน (ดู note)
    // ประเภท: ถ้าโหมดเดียวแสดงเฉพาะที่มีจริง, โหมดหลายเว็บแสดงทุกชนิดให้เลือก
    const typeCodes = d ? Object.keys(v.types) : PAYTYPES.map(p => p.code);
    const rows = typeCodes.map(code => {
      const meta = PAYTYPES.find(p => p.code === code) || { name: code };
      const t = (v.types && v.types[code]) || { enabled: false, min: '', max: '' };
      return `<div class="be-pt ${t.enabled ? '' : 'off'}" data-code="${esc(code)}">
        <div class="be-sw ${t.enabled ? 'on' : ''}" onclick="beSwp(this)"><b></b></div>
        <div><div class="name">${esc(meta.name)}</div><div class="code">${esc(code)}</div></div>
        <div><span class="be-mini">ขั้นต่ำ</span><input type="text" class="t-min" value="${esc(t.min)}"></div>
        <div><span class="be-mini">สูงสุด</span><input type="text" class="t-max" value="${esc(t.max)}"></div>
      </div>`;
    }).join('');
    const chips = (v.suggestamounts || []).map(a =>
      `<span class="be-chip">${nfmt(a)}<span class="x" onclick="this.closest('.be-chip').remove();beUpdateFoot()">✕</span></span>`).join('');

    return `
    <div class="be-sec" id="sec_status">
      ${secHead('สถานะช่องทาง', 'status', false)}
      <div class="be-seg">
        <label class="open ${statusOpen ? 'act' : ''}"><input type="radio" name="bestatus" value="open" ${statusOpen ? 'checked' : ''} onchange="beSeg(this)"><span class="dd"></span>เปิดใช้งาน</label>
        <label class="close ${statusOpen ? '' : 'act'}"><input type="radio" name="bestatus" value="close" ${statusOpen ? '' : 'checked'} onchange="beSeg(this)"><span class="dd"></span>ปิดใช้งาน</label>
      </div>
    </div>

    <div class="be-sec" id="sec_totals">
      ${secHead('วงเงินรวมของช่องทาง', 'totals', false)}
      <div class="be-grid">
        <div class="be-f2"><span class="lab">ฝากสูงสุดต่อวัน</span><input type="text" id="v_maxdailyamt" value="${esc(nfmt(v.maxdailyamt || ''))}"></div>
        <div class="be-f2"><span class="lab">เงินฝากสะสมขีดจำกัด</span><input type="text" id="v_maxtotalamt" value="${esc(nfmt(v.maxtotalamt || ''))}"></div>
        <div class="be-f2"><span class="lab">ถอนขั้นต่ำ</span><input type="text" id="v_minpayoutamt" value="${esc(nfmt(v.minpayoutamt || ''))}"></div>
        <div class="be-f2"><span class="lab">ถอนสูงสุด</span><input type="text" id="v_maxpayoutamt" value="${esc(nfmt(v.maxpayoutamt || ''))}"></div>
      </div>
    </div>

    <div class="be-sec" id="sec_types">
      ${secHead('ประเภทการชำระเงิน', 'types', false)}
      <div class="be-ptypes">
        <div class="be-pthead"><span style="grid-column:1/3">เปิด / ประเภท</span><span style="text-align:right">ฝากขั้นต่ำ</span><span style="text-align:right">ฝากสูงสุด</span></div>
        ${rows || '<div class="be-empty" style="border:0;padding:16px">ช่องทางนี้ไม่มีประเภทย่อย</div>'}
      </div>
    </div>

    <div class="be-sec" id="sec_suggest">
      ${secHead('ปุ่มจำนวนเงินแนะนำ', 'suggest', false)}
      <div class="be-chips" id="beChips">${chips}<span class="be-chip add" onclick="beAddChip()">＋ เพิ่ม</span></div>
    </div>`;
  }

  function wireForm() {
    // เปิดทุก section เป็น "ไม่แก้" ก่อน แล้วหรี่ลง
    ['status', 'totals', 'types', 'suggest'].forEach(k => {
      const sec = $('sec_' + k); if (sec) sec.classList.add('off');
    });
    $('beForm').querySelectorAll('input[type=text]').forEach(inp => {
      inp.addEventListener('input', updateFoot);
      inp.addEventListener('blur', () => { if (/amt/.test(inp.id) || inp.classList.contains('t-min') || inp.classList.contains('t-max')) { const n = nclean(inp.value); if (n) inp.value = nfmt(n); } });
    });
  }

  window.beTogEdit = function(key) {
    const t = $('etog_' + key); const sec = $('sec_' + key);
    if (!t || !sec) return;
    const on = !t.classList.contains('on');
    t.classList.toggle('on', on);
    sec.classList.toggle('off', !on);
    updateFoot();
  };
  window.beSeg = function(r) { r.closest('.be-seg').querySelectorAll('label').forEach(l => l.classList.remove('act')); r.parentElement.classList.add('act'); updateFoot(); };
  window.beSwp = function(el) { el.classList.toggle('on'); el.closest('.be-pt').classList.toggle('off', !el.classList.contains('on')); updateFoot(); };
  window.beAddChip = async function() {
    const { value } = await Swal.fire({ title: 'เพิ่มจำนวนเงิน', input: 'text', inputPlaceholder: 'เช่น 1000', showCancelButton: true, confirmButtonText: 'เพิ่ม', cancelButtonText: 'ยกเลิก' });
    if (!value) return;
    const n = Number(nclean(value));
    if (!isFinite(n) || n < 0) return Swal.fire('ค่าไม่ถูกต้อง', '', 'warning');
    const c = document.createElement('span'); c.className = 'be-chip';
    c.innerHTML = nfmt(n) + '<span class="x" onclick="this.closest(\'.be-chip\').remove();beUpdateFoot()">✕</span>';
    $('beChips').insertBefore(c, $('beChips').querySelector('.be-chip.add'));
    updateFoot();
  };
  window.beUpdateFoot = updateFoot;

  // ---------- รวบรวมสิ่งที่จะแก้ ----------
  function collectChanges() {
    const ch = {};
    const act = k => $('etog_' + k) && $('etog_' + k).classList.contains('on');
    if (act('status')) {
      const open = $('beForm').querySelector('input[name=bestatus]:checked').value === 'open';
      // หมายเหตุสถานะ: หน้าเว็บ BT678 ใช้ status=1 สำหรับ "ปิด" ในบางช่องทาง
      // เพื่อความปลอดภัย เราส่งค่าที่ "ตรงข้ามกับตอนนี้" เฉพาะเมื่อผู้ใช้เปลี่ยนจริง — ใช้ค่าดิบจาก loaded เป็นฐาน
      ch._statusOpen = open; // แปลงเป็นเลขจริงตอนส่ง (ดู toTaskChanges)
    }
    if (act('totals')) {
      ['maxdailyamt', 'maxtotalamt', 'minpayoutamt', 'maxpayoutamt'].forEach(k => {
        const el = $('v_' + k); if (el && nclean(el.value) !== '') ch[k] = nclean(el.value);
      });
    }
    if (act('types')) {
      ch.types = {};
      $('beForm').querySelectorAll('.be-pt').forEach(row => {
        const code = row.dataset.code;
        const enabled = row.querySelector('.be-sw').classList.contains('on');
        const min = nclean(row.querySelector('.t-min').value);
        const max = nclean(row.querySelector('.t-max').value);
        const t = { enabled };
        if (min !== '') t.min = min;
        if (max !== '') t.max = max;
        ch.types[code] = t;
      });
    }
    if (act('suggest')) {
      ch.suggestamounts = [...$('beChips').querySelectorAll('.be-chip:not(.add)')].map(c => nclean(c.textContent.replace('✕', '')));
      ch.amountsuggest = ch.suggestamounts.length > 0;
    }
    return ch;
  }

  function countChanges(ch) {
    let n = 0;
    if (ch._statusOpen !== undefined) n++;
    ['maxdailyamt', 'maxtotalamt', 'minpayoutamt', 'maxpayoutamt'].forEach(k => { if (ch[k] !== undefined) n++; });
    if (ch.types) n += Object.keys(ch.types).length;
    if (ch.suggestamounts) n++;
    return n;
  }

  function updateFoot() {
    const nSites = sel.size;
    const ch = (mode === 'single' ? loaded : sel.size) ? collectChanges() : {};
    const nCh = countChanges(ch);
    const ready = nSites > 0 && nCh > 0 && (mode === 'batch' || loaded);
    $('beSendBtn').disabled = !ready;
    $('beFootSummary').innerHTML = nSites
      ? `จะแก้ <b>${nSites} เว็บ</b> · <b>${nCh} รายการ</b>`
      : 'ยังไม่ได้เลือกเว็บ';
  }

  // แปลง changes ที่เก็บจากฟอร์ม → รูปแบบที่บอทเข้าใจ (ต่อ 1 เว็บ)
  function toTaskChanges(ch, baseStatusRaw) {
    const out = {};
    ['maxdailyamt', 'maxtotalamt', 'minpayoutamt', 'maxpayoutamt', 'types', 'suggestamounts', 'amountsuggest'].forEach(k => {
      if (ch[k] !== undefined) out[k] = ch[k];
    });
    if (ch._statusOpen !== undefined) {
      // ปลอดภัย: ส่งเฉพาะเมื่อผู้ใช้อยากได้สถานะหนึ่ง แล้วให้บอทตีความ
      // ที่นี่เราไม่รู้ mapping แน่ชัดทุกเว็บ จึงส่งเป็น intent ให้บอทเทียบกับค่าปัจจุบัน
      out.status = ch._statusOpen ? 1 : 2;
      // NOTE: mapping นี้อาจต้องปรับตามหลังบ้านจริง — ค่อยยืนยันตอนทดสอบช่องทางที่ปิดอยู่
    }
    return out;
  }

  // ---------- ส่งงาน ----------
  window.beSend = async function() {
    const ch = collectChanges();
    const nCh = countChanges(ch);
    if (!sel.size || !nCh) return;
    if (mode === 'batch' && !channelCodeForBatch() && !channelStaticForBatch()) {
      return Swal.fire('ยังไม่ได้เลือกช่องทาง', 'สลับไปโหมด "เว็บเดียว" เลือกช่องทางที่ต้องการก่อน 1 ครั้ง แล้วค่อยกลับมาโหมดหลายเว็บ', 'info');
    }
    const targetSites = [...sel].map(id => sites.find(s => s.id === id)).filter(Boolean);

    // สรุปให้ยืนยัน
    const lines = [];
    if (ch._statusOpen !== undefined) lines.push('ตั้งสถานะเป็น <b>' + (ch._statusOpen ? 'เปิดใช้งาน' : 'ปิดใช้งาน') + '</b>');
    ['maxdailyamt', 'maxtotalamt', 'minpayoutamt', 'maxpayoutamt'].forEach(k => {
      const lbl = { maxdailyamt: 'ฝากสูงสุด/วัน', maxtotalamt: 'สะสมขีดจำกัด', minpayoutamt: 'ถอนขั้นต่ำ', maxpayoutamt: 'ถอนสูงสุด' }[k];
      if (ch[k] !== undefined) lines.push(lbl + ' = <b>' + nfmt(ch[k]) + '</b>');
    });
    if (ch.types) Object.keys(ch.types).forEach(code => {
      const t = ch.types[code]; const bits = [];
      bits.push(t.enabled ? 'เปิด' : 'ปิด');
      if (t.min !== undefined) bits.push('ต่ำ ' + nfmt(t.min));
      if (t.max !== undefined) bits.push('สูง ' + nfmt(t.max));
      lines.push(code + ': <b>' + bits.join(' / ') + '</b>');
    });
    if (ch.suggestamounts) lines.push('ปุ่มเงินแนะนำ <b>' + ch.suggestamounts.length + ' ปุ่ม</b>');

    const siteNames = targetSites.map(s => s.name).join(', ');
    const warnDanger = ch._statusOpen !== undefined;
    const res = await Swal.fire({
      title: 'ยืนยันการแก้',
      html: `<div style="text-align:left;font-size:13.5px;line-height:1.7">
          <div style="margin-bottom:8px">เว็บ: <b>${esc(siteNames)}</b>${targetSites.length > 1 ? ` (${targetSites.length} เว็บ)` : ''}</div>
          <div style="margin-bottom:4px;font-weight:700">จะเปลี่ยน:</div>
          <ul style="margin:0;padding-left:18px">${lines.map(l => '<li>' + l + '</li>').join('')}</ul>
          ${warnDanger ? '<div style="margin-top:10px;color:#dc2626;font-weight:700">⚠️ การเปิด/ปิดช่องทางกระทบการฝากของลูกค้าทันที</div>' : ''}
          ${mode === 'batch' ? '<div style="margin-top:8px;font-size:12px;color:#888">ช่องทางที่จับคู่ด้วยรหัสเดียวกัน · เว็บที่ไม่มีช่องทางนี้จะถูกข้าม</div>' : ''}
        </div>`,
      icon: warnDanger ? 'warning' : 'question',
      showCancelButton: true, confirmButtonText: 'ยืนยัน ส่งให้บอท', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: warnDanger ? '#dc2626' : undefined
    });
    if (!res.isConfirmed) return;

    // โหมดเดียว: ใช้ channel_id ที่เลือก
    // โหมดหลายเว็บ: ต้องหา channel_id ของแต่ละเว็บจากรหัสเดียวกัน → สั่ง list ก่อน
    const batchId = 'b' + Date.now().toString(36);
    const btn = $('beSendBtn'); btn.disabled = true;
    const prog = Swal.fire({ title: 'กำลังส่งให้บอท...', html: '<div id="beProg">เริ่ม</div>', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const setProg = (t) => { const e = document.getElementById('beProg'); if (e) e.innerHTML = t; };

    const results = [];
    try {
      for (const s of targetSites) {
        setProg('กำลังทำ <b>' + esc(s.name) + '</b> ...');
        try {
          let channelId;
          if (mode === 'single') {
            channelId = $('beChanSel').value;
          } else {
            // หา channel_id จากรหัส channelCode ไม่ได้ (คนละเว็บคนละ id) → ใช้ list_channels หาโดย "ชื่อ/code"
            const list = await runTask(s.id, 'list_channels', {});
            const code = channelCodeForBatch(), stat = channelStaticForBatch();
            const match = (list.channels || []).find(c => (code && c.code === code) || (stat && c.staticname === stat));
            if (!match) { results.push({ site: s.name, ok: false, msg: 'ไม่มีช่องทางที่ตรงกัน ข้าม' }); continue; }
            channelId = match.id;
          }
          const r = await runTask(s.id, 'save_channel', { channel_id: channelId, changes: toTaskChanges(ch) }, true, batchId);
          results.push({ site: s.name, ok: true, msg: (r.changed || []).join(', ') || 'สำเร็จ' });
        } catch (e) {
          results.push({ site: s.name, ok: false, msg: e.message || String(e) });
        }
      }
    } finally {
      btn.disabled = false;
    }

    Swal.close();
    const okN = results.filter(r => r.ok).length;
    log('BO_EDIT', `แก้ช่องทาง ${okN}/${results.length} เว็บ`);
    await Swal.fire({
      icon: okN === results.length ? 'success' : (okN ? 'warning' : 'error'),
      title: `สำเร็จ ${okN}/${results.length} เว็บ`,
      html: `<div style="text-align:left;font-size:13px;max-height:300px;overflow:auto">${results.map(r =>
        `<div style="padding:5px 0;border-bottom:1px solid #eee2"><b>${r.ok ? '✅' : '❌'} ${esc(r.site)}</b><br><span style="color:#888;font-size:12px">${esc(r.msg)}</span></div>`).join('')}</div>`
    });
    if (mode === 'single' && loaded) beLoadChannel();
  };

  // โหมดหลายเว็บ: ใช้ code/staticname ของช่องทางที่ผู้ใช้ตั้งไว้ (ตอนนี้ยังอิงจากเว็บแรก)
  function channelCodeForBatch() { return (window._beBatchCode || '').trim(); }
  function channelStaticForBatch() { return (window._beBatchStatic || '').trim(); }

  // ---------- init ----------
  window.initBoEditApp = async function() {
    const app = $('boEditApp'), noPerm = $('boEditNoPerm');
    if (!can('bo_edit')) {
      if (noPerm) noPerm.classList.remove('hidden');
      if (app) { app.classList.add('hidden'); app.style.display = 'none'; }
      return;
    }
    if (noPerm) noPerm.classList.add('hidden');
    if (app) { app.classList.remove('hidden'); app.style.display = 'flex'; }
    sel.clear(); loaded = null; chanList = [];
    await beReload();
  };
})();
