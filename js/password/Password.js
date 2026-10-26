const PWD_PAGE_SIZE = 12;

let _pwdPage = 1;

let _pwdSearchQ = '';

let _pwdSearchTimer = null;

window._pwdVals = {};

window._pwdRows = {};

const _pwdEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const _pwdCanViewAll = () => (typeof canPerm === 'function' && canPerm('password_view_all')) || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('password_view_all'));

const _pwdIsGlobalAdmin = () => typeof canPerm === 'function' && canPerm('password_view_all');

const _pwdSafeUrl = u => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s;
  return '';
};

const _pwdHost = u => {
  try {
    return new URL(u).host.replace(/^www\./, '');
  } catch (e) {
    return u;
  }
};

const PWD_COLORS = [ '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#6366f1', '#f97316', '#0ea5e9' ];

const _pwdColor = name => {
  let h = 0;
  String(name || '').split('').forEach(c => { h = h * 31 + c.charCodeAt(0) >>> 0; });
  return PWD_COLORS[h % PWD_COLORS.length];
};

async function initPasswordApp() {
  if (!currentUser) return;
  const viewAll = _pwdCanViewAll();
  const ctl = document.getElementById('pwdManagerControls');
  if (ctl) ctl.classList.toggle('hidden', !viewAll);
  if (viewAll) {
    try {
      _pwdPopulateUserDropdown(await window.getUsersCached());
    } catch (e) {
      _pwdPopulateUserDropdown([]);
    }
  }
  _pwdPage = 1;
  _pwdSearchQ = '';
  const si = document.getElementById('pwdSearchInput');
  if (si) si.value = '';
  fetchPasswords();
}

function _pwdPopulateUserDropdown(users) {
  const sel = document.getElementById('pwdUserFilter');
  if (!sel) return;
  const list = users || window.GLOBAL_USER_LIST || [];
  const oldVal = sel.value;
  sel.innerHTML = '<option value="all">ทุกคน</option>' + list.filter(u => u && u.username).sort((a, b) => String(a.username).localeCompare(String(b.username))).map(u => `<option value="${_pwdEsc(u.id)}">${_pwdEsc(u.username)}</option>`).join('');
  if (oldVal) sel.value = oldVal;
  if (!sel.value) sel.value = 'all';
}

window.fetchPasswords = async function(resetPage) {
  if (resetPage) _pwdPage = 1;
  const grid = document.getElementById('pwdGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="pw-empty"><span class="material-icons animate-spin">sync</span><b>กำลังโหลด…</b></div>';
  const viewAll = _pwdCanViewAll();
  let query = appDB.from('user_passwords').select('*, users(username)', { count: 'exact' });
  if (!viewAll) query = query.eq('user_id', currentUser.id); else {
    const filterId = document.getElementById('pwdUserFilter')?.value;
    if (filterId && filterId !== 'all') query = query.eq('user_id', filterId);
  }
  if (_pwdSearchQ) {
    const q = _pwdSearchQ.replace(/[%,()*\\]/g, '');
    if (q) query = query.or(`site_name.ilike.%${q}%,login_user.ilike.%${q}%,site_url.ilike.%${q}%`);
  }
  const from = (_pwdPage - 1) * PWD_PAGE_SIZE;
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + PWD_PAGE_SIZE - 1);
  const stat = document.getElementById('pwdStatLine');
  if (error) {
    grid.innerHTML = `<div class="pw-empty"><span class="material-icons">error_outline</span><b>โหลดข้อมูลไม่สำเร็จ</b><span>${_pwdEsc(error.message)}</span></div>`;
    renderPwdPagination(0);
    return;
  }
  if (stat) stat.innerHTML = `<span class="material-icons">shield</span>${viewAll ? 'รหัสผ่านที่บันทึกไว้' : 'รหัสผ่านของคุณ'} <b style="color:var(--k-tx2)">${(count || 0).toLocaleString()}</b> รายการ · รหัสจะแสดงเมื่อกดดูเท่านั้น`;
  window._pwdVals = {};
  window._pwdRows = {};
  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="pw-empty"><span class="material-icons">no_encryption</span><b>${_pwdSearchQ ? `ไม่พบ "${_pwdEsc(_pwdSearchQ)}"` : 'ยังไม่มีรหัสผ่านที่บันทึกไว้'}</b>${_pwdSearchQ ? '' : '<span>กด "เพิ่มรหัสผ่าน" เพื่อเริ่ม</span>'}</div>`;
    renderPwdPagination(count || 0);
    return;
  }
  const isAdmin = _pwdIsGlobalAdmin();
  grid.innerHTML = data.map(item => {
    window._pwdVals[item.id] = { u: item.login_user || '', p: item.login_pass || '' };
    window._pwdRows[item.id] = item;
    const owner = item.users ? item.users.username : 'Unknown';
    const mine = String(item.user_id) === String(currentUser.id);
    const canEdit = isAdmin || mine;
    const url = _pwdSafeUrl(item.site_url);
    const name = item.site_name || 'ไม่มีชื่อ';
    const when = item.updated_at || item.created_at;
    const whenTxt = when ? new Date(when).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
    const id = _pwdEsc(item.id);
    return `<article class="pw-card">
      <div class="pw-top">
        <span class="pw-av" style="--c:${_pwdColor(name)}">${_pwdEsc(String(name).trim().charAt(0).toUpperCase() || '?')}</span>
        <div class="pw-tt">
          <div class="pw-name" title="${_pwdEsc(name)}">${_pwdEsc(name)}</div>
          ${url ? `<a class="pw-url" href="${_pwdEsc(url)}" target="_blank" rel="noopener noreferrer"><span class="material-icons">open_in_new</span>${_pwdEsc(_pwdHost(url))}</a>` : '<span class="pw-nourl">ไม่มีลิงก์</span>'}
          ${viewAll ? `<div><span class="pw-owner"><span class="material-icons">person</span>${_pwdEsc(owner)}</span></div>` : ''}
        </div>
      </div>
      <div class="pw-fields">
        <div class="pw-f"><small>User</small><span class="pw-v">${_pwdEsc(item.login_user || '-')}</span><button type="button" class="pw-ib" data-id="${id}" data-k="u" onclick="pwdCopy(this)" title="คัดลอก Username" aria-label="คัดลอก Username"><span class="material-icons">content_copy</span></button></div>
        <div class="pw-f"><small>Pass</small><span class="pw-v pass masked" id="pass_${id}">••••••••</span><button type="button" class="pw-ib" data-id="${id}" onclick="togglePwdVisible(this.dataset.id, this)" title="แสดง (ซ่อนเองใน 5 วิ)" aria-label="แสดงรหัสผ่าน"><span class="material-icons">visibility</span></button><button type="button" class="pw-ib" data-id="${id}" data-k="p" onclick="pwdCopy(this)" title="คัดลอกรหัสผ่าน" aria-label="คัดลอกรหัสผ่าน"><span class="material-icons">content_copy</span></button></div>
      </div>
      <div class="pw-foot">
        <span class="pw-date">${_pwdEsc(whenTxt)}</span>
        ${canEdit ? `<button type="button" class="pw-act" data-id="${id}" onclick="openEditPwdModal(this.dataset.id)"><span class="material-icons">edit</span>แก้ไข</button><button type="button" class="pw-act del" data-id="${id}" onclick="deletePassword(this.dataset.id)"><span class="material-icons">delete</span>ลบ</button>` : ''}
      </div>
    </article>`;
  }).join('');
  renderPwdPagination(count || 0);
};

function renderPwdPagination(total) {
  const bar = document.getElementById('pwdPagination');
  if (!bar) return;
  const pages = Math.max(1, Math.ceil(total / PWD_PAGE_SIZE));
  if (pages <= 1) {
    bar.innerHTML = total ? `<span class="pw-pginfo">ทั้งหมด ${total} รายการ</span>` : '';
    return;
  }
  if (_pwdPage > pages) _pwdPage = pages;
  const btn = (label, page, active, disabled) => `<button class="pw-pg${active ? ' on' : ''}" ${disabled ? 'disabled' : `onclick="pwdGotoPage(${page})"`}>${label}</button>`;
  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - _pwdPage) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '...') nums.push('...');
  }
  bar.innerHTML = `<span class="pw-pginfo">ทั้งหมด ${total} รายการ · หน้า ${_pwdPage}/${pages}</span>${btn('‹', _pwdPage - 1, false, _pwdPage === 1)}${nums.map(p => p === '...' ? '<span style="color:var(--k-mute2);padding:0 2px">…</span>' : btn(p, p, p === _pwdPage, false)).join('')}${btn('›', _pwdPage + 1, false, _pwdPage === pages)}`;
}

window.pwdGotoPage = function(p) {
  _pwdPage = p;
  fetchPasswords();
  document.getElementById('pwdGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function _pwdFillModal(row) {
  document.getElementById('pwdEditId').value = row ? row.id : '';
  document.getElementById('pwdSite').value = row ? row.site_name || '' : '';
  document.getElementById('pwdUrl').value = row ? row.site_url || '' : '';
  document.getElementById('pwdUser').value = row ? row.login_user || '' : '';
  document.getElementById('pwdPass').value = row ? row.login_pass || '' : '';
  window.checkPwdStrength(row ? row.login_pass || '' : '');
  const t = document.getElementById('pwdModalTitle');
  if (t) t.innerHTML = `<span class="material-icons">${row ? 'edit' : 'vpn_key'}</span>${row ? 'แก้ไขรหัสผ่าน' : 'บันทึกรหัสผ่าน'}`;
  const b = document.getElementById('pwdSaveBtn');
  if (b) b.textContent = row ? 'บันทึกการแก้ไข' : 'บันทึก';
  document.getElementById('pwdModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('pwdSite')?.focus(), 50);
}

window.openAddPwdModal = function() {
  _pwdFillModal(null);
};

window.openEditPwdModal = function(id) {
  const row = window._pwdRows[id];
  if (!row) return;
  _pwdFillModal(row);
};

window.closePwdModal = function() {
  document.getElementById('pwdModal').classList.add('hidden');
  document.getElementById('pwdPass').value = '';
};

window.savePassword = async function(e) {
  e.preventDefault();
  if (window._pwdSaving) return;
  const id = document.getElementById('pwdEditId').value;
  const site = document.getElementById('pwdSite').value.trim();
  const url = document.getElementById('pwdUrl').value.trim();
  const user = document.getElementById('pwdUser').value.trim();
  const pass = document.getElementById('pwdPass').value;
  if (!site || !pass) return;
  if (url && !_pwdSafeUrl(url)) return Swal.fire('ลิงก์ไม่ถูกต้อง', 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', 'warning');
  window._pwdSaving = true;
  Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
  try {
    const payload = { site_name: site, site_url: url, login_user: user, login_pass: pass };
    let res;
    if (id) res = await appDB.from('user_passwords').update(payload).eq('id', id).select('id');
    else res = await appDB.from('user_passwords').insert([ { user_id: currentUser.id, ...payload } ]).select('id');
    if (res.error) throw res.error;
    if (id && Array.isArray(res.data) && res.data.length === 0) throw new Error('ฐานข้อมูลไม่ยอมแก้รายการนี้ (อาจไม่มีสิทธิ์)');
    window.closePwdModal();
    fetchPasswords(!id);
    Swal.fire({ icon: 'success', title: id ? 'แก้ไขเรียบร้อย' : 'บันทึกเรียบร้อย', timer: 1400, showConfirmButton: false });
  } catch (err) {
    Swal.fire('บันทึกไม่สำเร็จ', err.message || String(err), 'error');
  } finally {
    window._pwdSaving = false;
  }
};

window.deletePassword = async function(id) {
  const row = window._pwdRows[id];
  const r = await Swal.fire({ title: 'ลบรหัสผ่านนี้?', text: row ? `"${row.site_name}" · กู้คืนไม่ได้` : 'กู้คืนไม่ได้', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก' });
  if (!r.isConfirmed) return;
  const { data, error } = await appDB.from('user_passwords').delete().eq('id', id).select('id');
  if (error) return Swal.fire('ลบไม่สำเร็จ', error.message, 'error');
  if (Array.isArray(data) && data.length === 0) return Swal.fire('ลบไม่สำเร็จ', 'ฐานข้อมูลไม่ยอมลบรายการนี้ (อาจไม่มีสิทธิ์)', 'error');
  fetchPasswords();
  Swal.fire({ icon: 'success', title: 'ลบแล้ว', timer: 1200, showConfirmButton: false });
};

window.filterPwdCards = function() {
  clearTimeout(_pwdSearchTimer);
  _pwdSearchTimer = setTimeout(() => {
    _pwdSearchQ = (document.getElementById('pwdSearchInput')?.value || '').trim();
    fetchPasswords(true);
  }, 350);
};

async function _pwdClip(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e2) {}
    ta.remove();
    return ok;
  }
}

window.copyText = async function(txt) {
  if (!txt) return;
  await _pwdClip(txt);
  Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 }).fire({ icon: 'success', title: 'คัดลอกแล้ว' });
};

window.pwdCopy = async function(btn) {
  const v = window._pwdVals[btn.dataset.id];
  const txt = v ? v[btn.dataset.k] : '';
  if (!txt) return;
  const ok = await _pwdClip(txt);
  if (!ok) return;
  const orig = btn.innerHTML;
  btn.classList.add('ok');
  btn.innerHTML = '<span class="material-icons">check</span>';
  setTimeout(() => {
    btn.classList.remove('ok');
    btn.innerHTML = orig;
  }, 1300);
};

window._pwdAutoHideTimers = {};

window.togglePwdVisible = function(id, el) {
  const span = document.getElementById('pass_' + id);
  if (!span) return;
  const hide = () => {
    span.textContent = '••••••••';
    span.classList.add('masked');
    if (el) el.innerHTML = '<span class="material-icons">visibility</span>';
    clearTimeout(window._pwdAutoHideTimers[id]);
  };
  if (span.classList.contains('masked')) {
    const v = window._pwdVals[id];
    span.textContent = v ? v.p : '';
    span.classList.remove('masked');
    if (el) el.innerHTML = '<span class="material-icons">visibility_off</span>';
    clearTimeout(window._pwdAutoHideTimers[id]);
    window._pwdAutoHideTimers[id] = setTimeout(hide, 5e3);
  } else hide();
};

window.checkPwdStrength = function(val) {
  const bar = document.getElementById('pwdStrengthBar');
  const label = document.getElementById('pwdStrengthLabel');
  if (!bar || !label) return;
  if (!val) {
    bar.style.width = '0%';
    label.textContent = '';
    return;
  }
  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [ { pct: '20%', color: '#ef4444', text: '🔴 อ่อนมาก' }, { pct: '40%', color: '#f97316', text: '🟠 อ่อน' }, { pct: '60%', color: '#eab308', text: '🟡 ปานกลาง' }, { pct: '80%', color: '#22c55e', text: '🟢 แข็งแรง' }, { pct: '100%', color: '#10b981', text: '✅ แข็งแรงมาก' } ];
  const lv = levels[Math.min(score, 4)];
  bar.style.width = lv.pct;
  bar.style.background = lv.color;
  label.textContent = lv.text;
};

window.generatePassword = function() {
  const rnd = n => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  const sets = [ 'ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*_-+=' ];
  const all = sets.join('');
  const chars = sets.map(s => s[rnd(s.length)]);
  while (chars.length < 16) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [ chars[i], chars[j] ] = [ chars[j], chars[i] ];
  }
  const pwd = chars.join('');
  const inp = document.getElementById('pwdPass');
  if (inp) {
    inp.value = pwd;
    window.checkPwdStrength(pwd);
  }
  _pwdClip(pwd);
  Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1800 }).fire({ icon: 'success', title: '🎲 สร้างรหัสผ่านแล้ว', text: 'คัดลอกไปแล้วด้วย' });
};
