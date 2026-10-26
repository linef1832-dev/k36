let globalTeleLinks = [];

let currentTeleFilter = 'all';

let currentTeleStatus = 'all';

const TELE_COLORS = { blue: '#3b82f6', green: '#10b981', red: '#ef4444', orange: '#f97316', purple: '#8b5cf6', gray: '#64748b' };

const TELE_STATUS = { active: '🟢 ใช้งาน', paused: '🟡 ปิดชั่วคราว', archived: '⚫ เก็บถาวร' };

const _tgEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const _tgCatLabel = c => c === 'General' ? '🌐 กลุ่มกลาง' : c || '-';

const _tgSafeUrl = u => {
  const s = String(u || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(t\.me|telegram\.me)\//i.test(s)) return 'https://' + s;
  return '';
};

const _tgCanManage = () => typeof canPerm === 'function' && canPerm('telegram_manage');

async function initTelegramApp() {
  const catSelect = document.getElementById('teleCategory');
  if (catSelect) catSelect.innerHTML = (typeof TEAM_LIST !== 'undefined' ? TEAM_LIST : []).map(t => `<option value="${_tgEsc(t)}">${_tgEsc(t)}</option>`).join('') + '<option value="General">🌐 กลุ่มกลาง</option>';
  document.getElementById('teleAdminControls')?.classList.toggle('hidden', !_tgCanManage());
  currentTeleFilter = 'all';
  currentTeleStatus = 'all';
  const si = document.getElementById('teleSearch');
  if (si) si.value = '';
  await fetchTeleLinks();
}

async function fetchTeleLinks() {
  const grid = document.getElementById('teleGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="tg-empty"><span class="material-icons animate-spin">sync</span><b>กำลังโหลด…</b></div>';
  const { data, error } = await appDB.from('telegram_links').select('*').order('created_at', { ascending: false });
  if (error) {
    grid.innerHTML = `<div class="tg-empty"><span class="material-icons">error_outline</span><b>โหลดข้อมูลไม่สำเร็จ</b><span>${_tgEsc(error.message)}</span></div>`;
    return;
  }
  globalTeleLinks = data || [];
  renderTeleFilter();
  renderTeleGrid();
}

function renderTeleFilter() {
  const container = document.getElementById('teleFilterContainer');
  if (!container) return;
  const cnt = {};
  globalTeleLinks.forEach(l => { cnt[l.category] = (cnt[l.category] || 0) + 1; });
  const webs = Object.keys(cnt).filter(w => w !== 'General').sort();
  if (cnt.General) webs.unshift('General');
  if (currentTeleFilter !== 'all' && !cnt[currentTeleFilter]) currentTeleFilter = 'all';
  const chip = (val, label, n) => `<button type="button" class="tg-chip${currentTeleFilter === val ? ' on' : ''}" data-v="${_tgEsc(val)}" onclick="filterTele(this.dataset.v)">${label}<b>${n}</b></button>`;
  container.innerHTML = chip('all', 'ทุกเว็บ', globalTeleLinks.length) + webs.map(w => chip(w, _tgEsc(_tgCatLabel(w)), cnt[w])).join('');
  const st = document.getElementById('teleStatLine');
  if (st) {
    const act = globalTeleLinks.filter(l => (l.status || 'active') === 'active').length;
    st.innerHTML = `ทั้งหมด <b>${globalTeleLinks.length}</b> กลุ่ม · ใช้งานอยู่ <b>${act}</b> · ${webs.length} เว็บ`;
  }
}

window.filterTele = function(category) {
  currentTeleFilter = category;
  renderTeleFilter();
  renderTeleGrid();
};

window.setTeleStatus = function(s) {
  currentTeleStatus = s;
  const h = document.getElementById('teleStatusFilter');
  if (h) h.value = s;
  document.querySelectorAll('#teleStatusSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === s));
  renderTeleGrid();
};

function _tgCard(link, canManage) {
  const st = link.status || 'active';
  const off = st !== 'active';
  const url = _tgSafeUrl(link.url);
  const id = _tgEsc(link.id);
  const color = TELE_COLORS[link.icon_color] || TELE_COLORS.blue;
  return `<article class="tg-card${off ? ' off' : ''}">
    ${canManage ? `<div class="tg-adm"><button type="button" class="tg-ib" data-id="${id}" onclick="editTeleLink(this.dataset.id)" title="แก้ไข" aria-label="แก้ไข"><span class="material-icons">edit</span></button><button type="button" class="tg-ib del" data-id="${id}" onclick="deleteTeleLink(this.dataset.id)" title="ลบ" aria-label="ลบ"><span class="material-icons">delete</span></button></div>` : ''}
    <div class="tg-top">
      <span class="tg-ic" style="--c:${color}"><span class="material-icons">send</span></span>
      <div class="tg-tt">
        <div class="tg-name" title="${_tgEsc(link.name)}">${_tgEsc(link.name || 'ไม่มีชื่อ')}</div>
        <div class="tg-meta"><span class="tg-tag">${_tgEsc(_tgCatLabel(link.category))}</span><span class="tg-st ${_tgEsc(st)}">${_tgEsc(TELE_STATUS[st] || st)}</span></div>
      </div>
    </div>
    <div class="tg-acts">
      ${url ? `<a class="tg-open${st === 'archived' ? ' dis' : ''}" href="${_tgEsc(url)}" target="_blank" rel="noopener noreferrer"><span class="material-icons">open_in_new</span>เปิดกลุ่ม</a>` : '<span class="tg-open dis">ลิงก์ไม่ถูกต้อง</span>'}
      ${url ? `<button type="button" class="tg-ib" data-u="${_tgEsc(url)}" onclick="copyToClip(this.dataset.u, this)" title="คัดลอกลิงก์" aria-label="คัดลอกลิงก์"><span class="material-icons">content_copy</span></button>` : ''}
    </div>
  </article>`;
}

function renderTeleGrid() {
  const grid = document.getElementById('teleGrid');
  if (!grid) return;
  let links = globalTeleLinks;
  if (currentTeleFilter !== 'all') links = links.filter(l => l.category === currentTeleFilter);
  const q = (document.getElementById('teleSearch')?.value || '').toLowerCase().trim();
  if (q) links = links.filter(l => String(l.name || '').toLowerCase().includes(q) || String(l.category || '').toLowerCase().includes(q) || _tgCatLabel(l.category).toLowerCase().includes(q));
  if (currentTeleStatus !== 'all') links = links.filter(l => (l.status || 'active') === currentTeleStatus);
  if (!links.length) {
    grid.innerHTML = `<div class="tg-empty"><span class="material-icons">forum</span><b>${q ? `ไม่พบ "${_tgEsc(q)}"` : 'ไม่มีกลุ่มงานในหมวดนี้'}</b></div>`;
    return;
  }
  const canManage = _tgCanManage();
  const rank = s => ({ active: 0, paused: 1, archived: 2 }[s || 'active'] ?? 3);
  const sorted = links.slice().sort((a, b) => rank(a.status) - rank(b.status));
  if (currentTeleFilter !== 'all') {
    grid.innerHTML = `<div class="tg-grid">${sorted.map(l => _tgCard(l, canManage)).join('')}</div>`;
    return;
  }
  const groups = {};
  sorted.forEach(l => { (groups[l.category] = groups[l.category] || []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b));
  grid.innerHTML = keys.map(k => `<section class="tg-sec"><div class="tg-sec-h">${_tgEsc(_tgCatLabel(k))}<span>${groups[k].length}</span></div><div class="tg-grid">${groups[k].map(l => _tgCard(l, canManage)).join('')}</div></section>`).join('');
}

window.pickTeleColor = function(c) {
  const h = document.getElementById('teleColor');
  if (h) h.value = c;
  document.querySelectorAll('#teleColorPick button').forEach(b => b.classList.toggle('on', b.dataset.c === c));
};

function _tgSetModalMode(edit) {
  document.getElementById('teleModalTitle').innerHTML = edit ? '<span class="material-icons">edit</span>แก้ไขกลุ่ม' : '<span class="material-icons">add_link</span>เพิ่มกลุ่มใหม่';
  const b = document.getElementById('teleSubmitBtn');
  b.innerText = edit ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล';
  b.classList.toggle('edit', !!edit);
}

window.openAddTeleModal = function() {
  if (!_tgCanManage()) return;
  document.getElementById('teleId').value = '';
  document.getElementById('teleName').value = '';
  document.getElementById('teleUrl').value = '';
  const cat = document.getElementById('teleCategory');
  if (cat && currentTeleFilter !== 'all') cat.value = currentTeleFilter;
  document.getElementById('teleStatus').value = 'active';
  window.pickTeleColor('blue');
  _tgSetModalMode(false);
  document.getElementById('teleModal').classList.remove('hidden');
};

window.editTeleLink = function(id) {
  if (!_tgCanManage()) return;
  const link = globalTeleLinks.find(l => String(l.id) === String(id));
  if (!link) return;
  document.getElementById('teleId').value = link.id;
  document.getElementById('teleName').value = link.name || '';
  const cat = document.getElementById('teleCategory');
  if (cat && ![ ...cat.options ].some(o => o.value === link.category)) cat.insertAdjacentHTML('beforeend', `<option value="${_tgEsc(link.category)}">${_tgEsc(link.category)}</option>`);
  if (cat) cat.value = link.category;
  document.getElementById('teleUrl').value = link.url || '';
  document.getElementById('teleStatus').value = link.status || 'active';
  window.pickTeleColor(link.icon_color || 'blue');
  _tgSetModalMode(true);
  document.getElementById('teleModal').classList.remove('hidden');
};

window.closeTeleModal = function() {
  document.getElementById('teleModal').classList.add('hidden');
};

window.saveTeleLink = async function(e) {
  e.preventDefault();
  if (!_tgCanManage() || window._tgSaving) return;
  const id = document.getElementById('teleId').value;
  const payload = {
    name: document.getElementById('teleName').value.trim(),
    url: document.getElementById('teleUrl').value.trim(),
    category: document.getElementById('teleCategory').value,
    icon_color: document.getElementById('teleColor').value || 'blue',
    status: document.getElementById('teleStatus').value || 'active'
  };
  if (!payload.name || !payload.url) return;
  if (!_tgSafeUrl(payload.url)) return Swal.fire('ลิงก์ไม่ถูกต้อง', 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือ t.me/', 'warning');
  payload.url = _tgSafeUrl(payload.url);
  window._tgSaving = true;
  Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
  try {
    const res = id ? await appDB.from('telegram_links').update(payload).eq('id', id).select('id') : await appDB.from('telegram_links').insert([ payload ]).select('id');
    if (res.error) throw res.error;
    if (id && Array.isArray(res.data) && res.data.length === 0) throw new Error('ฐานข้อมูลไม่ยอมแก้รายการนี้ (อาจไม่มีสิทธิ์)');
    closeTeleModal();
    await fetchTeleLinks();
    Swal.fire({ icon: 'success', title: id ? 'อัปเดตเรียบร้อย' : 'เพิ่มเรียบร้อย', timer: 1400, showConfirmButton: false });
  } catch (err) {
    Swal.fire('บันทึกไม่สำเร็จ', err.message || String(err), 'error');
  } finally {
    window._tgSaving = false;
  }
};

window.deleteTeleLink = async function(id) {
  if (!_tgCanManage()) return;
  const link = globalTeleLinks.find(l => String(l.id) === String(id));
  const r = await Swal.fire({ title: 'ลบกลุ่มนี้?', text: link ? `"${link.name}" · กู้คืนไม่ได้` : 'กู้คืนไม่ได้', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก' });
  if (!r.isConfirmed) return;
  const { data, error } = await appDB.from('telegram_links').delete().eq('id', id).select('id');
  if (error) return Swal.fire('ลบไม่สำเร็จ', error.message, 'error');
  if (Array.isArray(data) && data.length === 0) return Swal.fire('ลบไม่สำเร็จ', 'ฐานข้อมูลไม่ยอมลบรายการนี้ (อาจไม่มีสิทธิ์)', 'error');
  await fetchTeleLinks();
  Swal.fire({ icon: 'success', title: 'ลบแล้ว', timer: 1200, showConfirmButton: false });
};

window.copyToClip = async function(text, btn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e2) {}
    ta.remove();
  }
  if (btn) {
    const o = btn.innerHTML;
    btn.classList.add('ok');
    btn.innerHTML = '<span class="material-icons">check</span>';
    setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = o; }, 1300);
  } else Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 }).fire({ icon: 'success', title: 'คัดลอกลิงก์แล้ว' });
};
