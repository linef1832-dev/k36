(function() {
  // ============================================================
  // บอทหลังบ้าน — ตั้งเว็บ + บัญชีที่บอท Railway ใช้ล็อกอิน
  //
  // ความปลอดภัย: รหัสผ่านถูก "ล็อก" ในเบราว์เซอร์ด้วยกุญแจสาธารณะ (RSA-OAEP)
  // ก่อนบันทึกลง Supabase — K36 อ่านกลับไม่ได้ มีแต่ Railway ที่ถือกุญแจลับไขได้
  // กุญแจลับแสดงครั้งเดียวตอนสร้าง ไม่ถูกบันทึกที่ไหนใน K36
  // ============================================================
  const KEY_SETTING = 'bo_public_key';
  const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
  const STALE_MS = 10 * 60 * 1000;

  let sites = [];
  let pubKey = null;   // { pem, fp, created_at, created_by }
  let rtChannel = null;

  const $ = id => document.getElementById(id);
  const esc = v => window.escapeHtml ? window.escapeHtml(v) : String(v == null ? '' : v);
  const can = id => typeof window.hasUserPerm === 'function' && window.hasUserPerm(id);
  const canManage = () => can('bo_bot_manage');
  const me = () => (window.currentUser && window.currentUser.username) || '';
  const log = (a, d) => {
    try {
      if (typeof logAction === 'function') logAction(a, d);
    } catch (e) {}
  };
  const fmt = ts => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return String(ts);
    }
  };

  // ---------- base64 / PEM ----------
  const b64 = buf => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
  const toPem = (buf, label) => `-----BEGIN ${label}-----\n${b64(buf).match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;
  const fromPem = pem => unb64(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));

  async function fingerprint(spkiBytes) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', spkiBytes));
    return Array.from(h.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{4}/g).join('-');
  }

  function maskUser(u) {
    u = String(u || '');
    if (u.length <= 4) return '****';
    return u.slice(0, 2) + '****' + u.slice(-2);
  }

  // ---------- data ----------
  async function loadKey() {
    const { data, error } = await appDB.from('settings').select('value').eq('key', KEY_SETTING).maybeSingle();
    if (error) throw error;
    let v = data && data.value;
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch (e) {
        v = null;
      }
    }
    pubKey = v && v.pem ? v : null;
  }

  async function loadSites() {
    const { data, error } = await appDB.from('bo_sites')
      .select('id,name,web_url,api_base,enabled,cred_hint,cred_set_at,cred_set_by,cipher_fp,status,last_login_at,last_seen,last_error,note')
      .order('name', { ascending: true });
    if (error) throw error;
    sites = data || [];
  }

  window.boBotReload = async function() {
    try {
      await Promise.all([ loadKey(), loadSites() ]);
    } catch (e) {
      console.error('[bo_bot]', e);
      const list = $('boBotList');
      if (list) {
        list.innerHTML = `<div class="bb-empty">โหลดข้อมูลไม่สำเร็จ: ${esc(e.message || e)}<br><span style="font-size:12px;font-weight:600">ถ้ายังไม่ได้สร้างตาราง ให้รันไฟล์ SQL ของบอทหลังบ้านใน Supabase ก่อน</span></div>`;
      }
      return;
    }
    render();
  };

  // ---------- render ----------
  function render() {
    renderKey();
    renderList();
    const add = $('boBotAddBtn');
    if (add) add.classList.toggle('hidden', !canManage());
  }

  function renderKey() {
    const box = $('boBotKey');
    if (!box) return;
    const manage = canManage();
    if (!pubKey) {
      box.innerHTML = `<div class="bb-key missing">
        <div class="bb-key-ic"><span class="material-icons">key_off</span></div>
        <div style="flex:1;min-width:220px">
          <div class="bb-key-t">ยังไม่มีกุญแจล็อกรหัสผ่าน</div>
          <div class="bb-key-s">ต้องสร้างก่อน 1 ครั้ง ถึงจะบันทึกบัญชีบอทได้ — กุญแจลับจะแสดงให้คัดลอกไปใส่ใน Railway</div>
        </div>
        ${manage ? `<button class="bb-btn pri" onclick="boBotGenKey()"><span class="material-icons">vpn_key</span>สร้างกุญแจ</button>` : ''}
      </div>`;
      return;
    }
    box.innerHTML = `<div class="bb-key">
      <div class="bb-key-ic"><span class="material-icons">lock</span></div>
      <div style="flex:1;min-width:220px">
        <div class="bb-key-t">รหัสผ่านถูกล็อกก่อนบันทึก</div>
        <div class="bb-key-s">K36 ใส่ได้อย่างเดียว อ่านกลับไม่ได้ มีแต่บอทบน Railway ที่ไขได้ · ลายนิ้วมือกุญแจ <code>${esc(pubKey.fp || '-')}</code> · สร้างโดย ${esc(pubKey.created_by || '-')} ${esc(fmt(pubKey.created_at))}</div>
      </div>
      ${manage ? `<button class="bb-btn sm" onclick="boBotGenKey()"><span class="material-icons">autorenew</span>สร้างกุญแจใหม่</button>` : ''}
    </div>`;
  }

  function statusOf(s) {
    if (!s.enabled) return { cls: '', text: 'ปิดใช้งาน' };
    if (!s.cred_hint) return { cls: 'wn', text: 'ยังไม่ได้ตั้งบัญชี' };
    if (pubKey && s.cipher_fp && s.cipher_fp !== pubKey.fp) return { cls: 'bad', text: 'ต้องตั้งบัญชีใหม่' };
    switch (s.status) {
      case 'ok': {
        const stale = !s.last_seen || Date.now() - new Date(s.last_seen).getTime() > STALE_MS;
        return stale ? { cls: 'wn', text: 'บอทไม่ตอบ' } : { cls: 'ok', text: 'ล็อกอินได้' };
      }
      case 'login_failed': return { cls: 'bad', text: 'ล็อกอินไม่ผ่าน' };
      case 'error': return { cls: 'bad', text: 'ผิดพลาด' };
      default: return { cls: 'wn', text: 'รอบอทลองล็อกอิน' };
    }
  }

  function renderList() {
    const box = $('boBotList');
    if (!box) return;
    const manage = canManage();
    if (!sites.length) {
      box.innerHTML = `<div class="bb-empty">
        <span class="material-icons" style="font-size:40px;display:block;margin-bottom:6px">language</span>
        ยังไม่มีเว็บ${manage ? ' — กด "เพิ่มเว็บ" ด้านบน' : ''}
      </div>`;
      return;
    }
    box.innerHTML = sites.map(s => {
      const st = statusOf(s);
      const id = esc(s.id);
      const credSet = !!s.cred_hint;
      const wrongKey = credSet && pubKey && s.cipher_fp && s.cipher_fp !== pubKey.fp;
      return `<div class="bb-card${s.enabled ? '' : ' off'}">
        <div class="bb-card-h">
          <div style="min-width:0">
            <div class="bb-card-n">${esc(s.name)}</div>
            <div class="bb-card-id">${id}</div>
          </div>
          <span class="bb-st ${st.cls}"><i></i>${esc(st.text)}</span>
        </div>
        <div class="bb-rows">
          <div class="bb-row"><b>หน้าหลังบ้าน</b><span class="mono">${esc(s.web_url || '-')}</span></div>
          <div class="bb-row"><b>API</b><span class="mono">${esc(s.api_base || '-')}</span></div>
          <div class="bb-row"><b>ล็อกอินล่าสุด</b><span>${esc(fmt(s.last_login_at))}</span></div>
        </div>
        <div class="bb-cred${credSet && !wrongKey ? ' set' : ''}">
          <span class="material-icons">${credSet && !wrongKey ? 'verified_user' : 'person_off'}</span>
          <div style="min-width:0">
            <div class="bb-cred-t">${credSet ? 'บัญชีบอท: ' + esc(s.cred_hint) : 'ยังไม่ได้ตั้งบัญชีบอท'}</div>
            <div class="bb-cred-s">${credSet ? (wrongKey ? 'ตั้งไว้กับกุญแจเก่า ต้องใส่รหัสใหม่' : 'ตั้งโดย ' + esc(s.cred_set_by || '-') + ' · ' + esc(fmt(s.cred_set_at))) : 'บอทจะยังไม่ทำงานกับเว็บนี้'}</div>
          </div>
        </div>
        ${s.last_error && s.enabled ? `<div class="bb-err">${esc(s.last_error)}</div>` : ''}
        ${manage ? `<div class="bb-card-f">
          <button class="bb-btn pri sm" onclick="boBotSetCred('${id}')"><span class="material-icons">key</span>${credSet ? 'เปลี่ยนบัญชี' : 'ตั้งบัญชีบอท'}</button>
          <button class="bb-btn sm" onclick="boBotEditSite('${id}')"><span class="material-icons">edit</span>แก้ไข</button>
          <button class="bb-btn sm" onclick="boBotToggle('${id}')"><span class="material-icons">${s.enabled ? 'pause' : 'play_arrow'}</span>${s.enabled ? 'ปิด' : 'เปิด'}</button>
          ${credSet ? `<button class="bb-btn sm" onclick="boBotClearCred('${id}')" title="ลบบัญชีบอท"><span class="material-icons">person_remove</span></button>` : ''}
          <button class="bb-btn sm dng" onclick="boBotDeleteSite('${id}')" title="ลบเว็บ"><span class="material-icons">delete</span></button>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  // ---------- key ----------
  window.boBotGenKey = async function() {
    if (!canManage()) return;
    if (!window.crypto || !crypto.subtle) return Swal.fire('ทำไม่ได้', 'เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส (ต้องเปิดผ่าน https)', 'error');
    const hasCreds = sites.some(s => s.cred_hint);
    const ok = await Swal.fire({
      icon: pubKey ? 'warning' : 'question',
      title: pubKey ? 'สร้างกุญแจใหม่?' : 'สร้างกุญแจล็อกรหัส',
      html: pubKey
        ? `กุญแจเก่าจะใช้ไม่ได้ทันที${hasCreds ? '<br><b>ทุกเว็บต้องใส่บัญชีบอทใหม่</b>' : ''}<br>และต้องเอากุญแจลับใหม่ไปใส่ใน Railway`
        : 'ระบบจะสร้างกุญแจ 1 คู่<br>กุญแจลับจะแสดง <b>ครั้งเดียว</b> ให้คัดลอกไปใส่ใน Railway',
      showCancelButton: true,
      confirmButtonText: 'สร้าง',
      cancelButtonText: 'ยกเลิก'
    });
    if (!ok.isConfirmed) return;

    let pair, spki, pkcs8;
    try {
      pair = await crypto.subtle.generateKey({ ...RSA, modulusLength: 3072, publicExponent: new Uint8Array([ 1, 0, 1 ]) }, true, [ 'encrypt', 'decrypt' ]);
      spki = await crypto.subtle.exportKey('spki', pair.publicKey);
      pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    } catch (e) {
      return Swal.fire('สร้างกุญแจไม่สำเร็จ', e.message || String(e), 'error');
    }
    const fp = await fingerprint(spki);
    const privPem = toPem(pkcs8, 'PRIVATE KEY');
    const record = { pem: toPem(spki, 'PUBLIC KEY'), fp, created_at: new Date().toISOString(), created_by: me() };

    // แสดงกุญแจลับก่อนบันทึก — ถ้าผู้ใช้ไม่ยืนยันว่าคัดลอกแล้ว จะไม่เปลี่ยนอะไร
    const shown = await Swal.fire({
      title: 'คัดลอกกุญแจลับไปใส่ Railway',
      width: 640,
      html: `<div style="text-align:left;font-size:13px;line-height:1.6">
          Railway → โปรเจกต์บอท → <b>Variables</b> → เพิ่มชื่อ <code>BO_PRIVATE_KEY</code> แล้ววางทั้งก้อนนี้<br>
          <span style="color:#dc2626;font-weight:700">ปิดหน้าต่างนี้แล้วจะดูอีกไม่ได้ อย่าส่งในแชต</span>
        </div>
        <textarea id="boPrivPem" readonly style="width:100%;height:180px;margin-top:10px;font-family:Consolas,monospace;font-size:11px;padding:8px;border-radius:8px;border:1px solid #cbd5e1">${esc(privPem)}</textarea>
        <button type="button" id="boCopyPriv" class="swal2-styled" style="margin:8px 0 0;background:#334155">คัดลอก</button>
        <div style="text-align:left;font-size:12px;margin-top:10px">ลายนิ้วมือ: <code>${esc(fp)}</code> (บอทจะแสดงเลขเดียวกันเมื่อใส่ถูก)</div>`,
      input: 'checkbox',
      inputPlaceholder: 'ใส่ใน Railway เรียบร้อยแล้ว',
      confirmButtonText: 'บันทึกกุญแจ',
      showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      allowOutsideClick: false,
      didOpen: () => {
        const b = $('boCopyPriv');
        if (b) b.onclick = async () => {
          try {
            await navigator.clipboard.writeText(privPem);
            b.textContent = 'คัดลอกแล้ว ✓';
          } catch (e) {
            $('boPrivPem').select();
            b.textContent = 'กด Ctrl+C';
          }
        };
      },
      inputValidator: v => (v ? undefined : 'ติ๊กยืนยันก่อนว่าใส่ใน Railway แล้ว')
    });
    if (!shown.isConfirmed) return;

    const { error } = await appDB.from('settings').upsert([ { key: KEY_SETTING, value: JSON.stringify(record) } ]);
    if (error) return Swal.fire('บันทึกกุญแจไม่สำเร็จ', error.message, 'error');
    log('BO_KEY_ROTATE', 'สร้างกุญแจล็อกรหัสบอทหลังบ้าน ' + fp);
    Swal.fire({ icon: 'success', title: 'บันทึกกุญแจแล้ว', text: hasCreds ? 'อย่าลืมตั้งบัญชีบอทของทุกเว็บใหม่' : '', timer: 1800, showConfirmButton: false });
    boBotReload();
  };

  async function encryptCred(siteId, username, password) {
    if (!pubKey) throw new Error('ยังไม่มีกุญแจ');
    const der = fromPem(pubKey.pem);
    const key = await crypto.subtle.importKey('spki', der, RSA, false, [ 'encrypt' ]);
    const plain = new TextEncoder().encode(JSON.stringify({ s: siteId, u: username, p: password, t: Date.now() }));
    if (plain.length > 300) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านยาวเกินไป');
    return b64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, plain));
  }

  // ---------- site CRUD ----------
  function deriveApi(webUrl) {
    try {
      const u = new URL(webUrl);
      const host = u.host.replace(/^bo\./i, '');
      return `https://boapi.${host}/tf6prod-ims/api/v1`;
    } catch (e) {
      return '';
    }
  }

  function validHttps(u) {
    try {
      return new URL(u).protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  window.boBotEditSite = async function(id) {
    if (!canManage()) return;
    const cur = id ? sites.find(x => x.id === id) : null;
    const { value } = await Swal.fire({
      title: cur ? 'แก้ไขเว็บ' : 'เพิ่มเว็บ',
      width: 560,
      html: `<div style="display:flex;flex-direction:column;gap:8px;text-align:left">
          <label style="font-size:12px;font-weight:700">รหัสเว็บ (ภาษาอังกฤษตัวเล็ก ใช้อ้างอิงในระบบ)</label>
          <input id="bbId" class="swal2-input" style="margin:0;font-family:monospace" placeholder="เช่น bt678" value="${esc(cur ? cur.id : '')}" ${cur ? 'disabled' : ''}>
          <label style="font-size:12px;font-weight:700">ชื่อที่แสดง</label>
          <input id="bbName" class="swal2-input" style="margin:0" placeholder="เช่น BT678" value="${esc(cur ? cur.name : '')}">
          <label style="font-size:12px;font-weight:700">ลิงก์หน้าหลังบ้าน</label>
          <input id="bbWeb" class="swal2-input" style="margin:0;font-family:monospace;font-size:13px" placeholder="https://bo.xxxx.net" value="${esc(cur ? cur.web_url || '' : '')}">
          <label style="font-size:12px;font-weight:700">API (เติมให้เองจากลิงก์หลังบ้าน แก้ได้)</label>
          <input id="bbApi" class="swal2-input" style="margin:0;font-family:monospace;font-size:12px" placeholder="https://boapi.xxxx.net/tf6prod-ims/api/v1" value="${esc(cur ? cur.api_base || '' : '')}">
          <label style="font-size:12px;font-weight:700">หมายเหตุ</label>
          <input id="bbNote" class="swal2-input" style="margin:0" value="${esc(cur ? cur.note || '' : '')}">
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      didOpen: () => {
        const web = $('bbWeb'), api = $('bbApi');
        let apiTouched = !!(cur && cur.api_base);
        api.addEventListener('input', () => { apiTouched = true; });
        web.addEventListener('input', () => {
          if (!apiTouched) api.value = deriveApi(web.value.trim());
        });
      },
      preConfirm: () => {
        const v = {
          id: (cur ? cur.id : $('bbId').value.trim().toLowerCase()),
          name: $('bbName').value.trim(),
          web_url: $('bbWeb').value.trim().replace(/\/+$/, ''),
          api_base: $('bbApi').value.trim().replace(/\/+$/, ''),
          note: $('bbNote').value.trim() || null
        };
        if (!/^[a-z0-9_\-]{2,30}$/.test(v.id)) return Swal.showValidationMessage('รหัสเว็บใช้ได้เฉพาะ a-z 0-9 _ - (2–30 ตัว)');
        if (!cur && sites.some(x => x.id === v.id)) return Swal.showValidationMessage('มีรหัสนี้แล้ว');
        if (!v.name) return Swal.showValidationMessage('ใส่ชื่อที่แสดง');
        if (!validHttps(v.web_url)) return Swal.showValidationMessage('ลิงก์หลังบ้านต้องขึ้นต้นด้วย https://');
        if (!validHttps(v.api_base)) return Swal.showValidationMessage('API ต้องขึ้นต้นด้วย https://');
        return v;
      }
    });
    if (!value) return;
    let res;
    if (cur) {
      res = await appDB.from('bo_sites').update({ name: value.name, web_url: value.web_url, api_base: value.api_base, note: value.note }).eq('id', cur.id);
    } else {
      res = await appDB.from('bo_sites').insert([ Object.assign({ enabled: true }, value) ]);
    }
    if (res.error) return Swal.fire('บันทึกไม่สำเร็จ', res.error.message, 'error');
    log(cur ? 'BO_SITE_EDIT' : 'BO_SITE_ADD', `${value.name} (${value.id})`);
    boBotReload();
  };

  window.boBotSetCred = async function(id) {
    if (!canManage()) return;
    const s = sites.find(x => x.id === id);
    if (!s) return;
    if (!pubKey) return Swal.fire('ยังไม่มีกุญแจ', 'กด "สร้างกุญแจ" ด้านบนก่อน', 'warning');
    const { value } = await Swal.fire({
      title: 'บัญชีบอท — ' + s.name,
      html: `<div style="display:flex;flex-direction:column;gap:8px;text-align:left">
          <label style="font-size:12px;font-weight:700">ชื่อผู้ใช้หลังบ้าน</label>
          <input id="bbU" class="swal2-input" style="margin:0" autocomplete="off" spellcheck="false">
          <label style="font-size:12px;font-weight:700">รหัสผ่าน</label>
          <input id="bbP" type="password" class="swal2-input" style="margin:0" autocomplete="new-password">
          <div style="font-size:12px;opacity:.75;line-height:1.5;margin-top:4px">รหัสจะถูกล็อกในเครื่องนี้ก่อนส่ง ไม่มีใครใน K36 ดูได้ แนะนำให้ใช้บัญชีแยกสำหรับบอทโดยเฉพาะ</div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'ล็อกแล้วบันทึก',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      didOpen: () => $('bbU').focus(),
      preConfirm: async () => {
        const u = $('bbU').value.trim();
        const p = $('bbP').value;
        if (!u || !p) return Swal.showValidationMessage('ใส่ให้ครบทั้งชื่อผู้ใช้และรหัสผ่าน');
        try {
          const cipher = await encryptCred(s.id, u, p);
          return { cipher, hint: maskUser(u) };
        } catch (e) {
          return Swal.showValidationMessage('ล็อกรหัสไม่สำเร็จ: ' + (e.message || e));
        } finally {
          $('bbP').value = '';
        }
      }
    });
    if (!value) return;
    const { error } = await appDB.from('bo_sites').update({
      cred_cipher: value.cipher,
      cred_hint: value.hint,
      cipher_fp: pubKey.fp,
      cred_set_at: new Date().toISOString(),
      cred_set_by: me(),
      status: 'pending',
      last_error: null
    }).eq('id', s.id);
    if (error) return Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
    log('BO_CRED_SET', `${s.name}: ตั้งบัญชีบอท ${value.hint}`);
    Swal.fire({ icon: 'success', title: 'บันทึกบัญชีบอทแล้ว', text: 'บอทจะลองล็อกอินภายใน 1 นาที', timer: 1600, showConfirmButton: false });
    boBotReload();
  };

  window.boBotClearCred = async function(id) {
    if (!canManage()) return;
    const s = sites.find(x => x.id === id);
    if (!s) return;
    const r = await Swal.fire({ icon: 'warning', title: 'ลบบัญชีบอทของ ' + s.name + '?', text: 'บอทจะหยุดทำงานกับเว็บนี้', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!r.isConfirmed) return;
    const { error } = await appDB.from('bo_sites').update({ cred_cipher: null, cred_hint: null, cipher_fp: null, cred_set_at: null, cred_set_by: null, status: null }).eq('id', id);
    if (error) return Swal.fire('ลบไม่สำเร็จ', error.message, 'error');
    log('BO_CRED_CLEAR', s.name);
    boBotReload();
  };

  window.boBotToggle = async function(id) {
    if (!canManage()) return;
    const s = sites.find(x => x.id === id);
    if (!s) return;
    const { error } = await appDB.from('bo_sites').update({ enabled: !s.enabled }).eq('id', id);
    if (error) return Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
    log('BO_SITE_TOGGLE', `${s.name}: ${s.enabled ? 'ปิด' : 'เปิด'}`);
    boBotReload();
  };

  window.boBotDeleteSite = async function(id) {
    if (!canManage()) return;
    const s = sites.find(x => x.id === id);
    if (!s) return;
    const r = await Swal.fire({
      icon: 'warning',
      title: 'ลบเว็บ ' + s.name + '?',
      html: `พิมพ์ <b>${esc(s.id)}</b> เพื่อยืนยัน`,
      input: 'text',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      inputValidator: v => (v === s.id ? undefined : 'พิมพ์รหัสเว็บให้ตรง')
    });
    if (!r.isConfirmed) return;
    const { error } = await appDB.from('bo_sites').delete().eq('id', id);
    if (error) return Swal.fire('ลบไม่สำเร็จ', error.message, 'error');
    log('BO_SITE_DELETE', `${s.name} (${s.id})`);
    boBotReload();
  };

  // ---------- realtime ----------
  function subscribe() {
    try {
      rtChannel = appDB.channel('bo-sites-' + Date.now())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bo_sites' }, () => {
          clearTimeout(subscribe._t);
          subscribe._t = setTimeout(() => {
            loadSites().then(renderList).catch(() => {});
          }, 400);
        })
        .subscribe();
      if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(rtChannel);
    } catch (e) {}
  }

  // ---------- init ----------
  window.initBoBotApp = async function() {
    const app = $('boBotApp'), noPerm = $('boBotNoPerm'), head = $('boBotHeadBtns');
    if (!can('bo_bot')) {
      if (noPerm) noPerm.classList.remove('hidden');
      if (app) { app.classList.add('hidden'); app.style.display = 'none'; }
      if (head) head.style.display = 'none';
      return;
    }
    if (noPerm) noPerm.classList.add('hidden');
    if (app) { app.classList.remove('hidden'); app.style.display = 'flex'; }
    await boBotReload();
    subscribe();
    // อัปเดตป้าย "บอทไม่ตอบ" ตามเวลา
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(setInterval(renderList, 60000));
  };
})();
