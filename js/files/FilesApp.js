let globalAppFiles = [];
let globalFilesDownloads = {};
let globalFilesLogs = [];
let filesActiveCategory = 'ALL';
let filesSortMode = 'new';
const FILES_SNAP_KEY = 'files_page_cache_v1';
let _filesFetchSeq = 0;

const _fEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _fIsAdmin = () => typeof window.hasUserPerm === 'function' && window.hasUserPerm('files_manage');
const _fSafeUrl = u => /^https?:\/\//i.test(String(u || '').trim());
const _fUrlOf = x => typeof x === 'object' && x ? (x.url || '') : String(x || '');
const _fUrls = f => (Array.isArray(f.url) ? f.url : [ f.url ]).filter(x => _fUrlOf(x));

window.initFilesApp = async function() {
  const adminControls = document.getElementById('filesAdminControls');
  if (adminControls) adminControls.classList.toggle('hidden', !_fIsAdmin());
  filesActiveCategory = 'ALL';
  await fetchFilesData();
  try {
    let _filesRtTimer = null;
    const ch = appDB.channel('files_realtime_' + Date.now()).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'settings'
    }, payload => {
      const k = payload.new && payload.new.key || payload.old && payload.old.key;
      if (k !== 'app_files_data' && k !== 'app_files_downloads') return;
      clearTimeout(_filesRtTimer);
      _filesRtTimer = setTimeout(() => fetchFilesData(), 400);
    }).subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(ch);
  } catch (e) {
    console.error('files realtime:', e);
  }
};

function _filesLoadSnapshot() {
  try {
    const raw = typeof window.safeGetItem === 'function' ? window.safeGetItem(FILES_SNAP_KEY) : localStorage.getItem(FILES_SNAP_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.files)) return false;
    globalAppFiles = s.files;
    globalFilesDownloads = s.downloads || {};
    globalFilesLogs = s.logs || [];
    return globalAppFiles.length > 0;
  } catch (e) {
    return false;
  }
}

function _filesSaveSnapshot() {
  try {
    const raw = JSON.stringify({ files: globalAppFiles, downloads: globalFilesDownloads, logs: globalFilesLogs, ts: Date.now() });
    if (typeof window.safeSetItem === 'function') window.safeSetItem(FILES_SNAP_KEY, raw); else localStorage.setItem(FILES_SNAP_KEY, raw);
  } catch (e) {}
}

async function _filesReadKey(key, fallback) {
  const { data, error } = await appDB.from('settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  if (!data || !data.value) return fallback;
  try {
    return JSON.parse(data.value);
  } catch (e) {
    return fallback;
  }
}

window.fetchFilesData = async function() {
  const grid = document.getElementById('filesGrid');
  if (!grid) return;
  const hasData = globalAppFiles.length > 0 || _filesLoadSnapshot();
  if (hasData) {
    renderCategoryTabs();
    renderFilesGrid();
  } else {
    grid.innerHTML = '<div class="fa-empty"><span class="material-icons animate-spin">sync</span><b>กำลังโหลดไฟล์…</b></div>';
  }
  const mySeq = ++_filesFetchSeq;
  try {
    const [ newFiles, newDl, newLogs ] = await Promise.all([ _filesReadKey('app_files_data', []), _filesReadKey('app_files_downloads', {}), _filesReadKey('app_files_logs', []) ]);
    if (mySeq !== _filesFetchSeq) return;
    const changed = JSON.stringify(newFiles) !== JSON.stringify(globalAppFiles) || JSON.stringify(newDl) !== JSON.stringify(globalFilesDownloads);
    globalAppFiles = Array.isArray(newFiles) ? newFiles : [];
    globalFilesDownloads = newDl && typeof newDl === 'object' ? newDl : {};
    globalFilesLogs = Array.isArray(newLogs) ? newLogs : [];
    _filesSaveSnapshot();
    if (!hasData || changed) {
      renderCategoryTabs();
      renderFilesGrid();
    }
  } catch (e) {
    console.error('Fetch files error:', e);
    if (!hasData) {
      globalAppFiles = [];
      globalFilesDownloads = {};
      globalFilesLogs = [];
      renderCategoryTabs();
      renderFilesGrid();
    }
  }
};

const FILES_CAT_ICONS = { ALL: 'apps', 'โปรแกรม': 'terminal', VPN: 'vpn_key', Discord: 'forum', Telegram: 'near_me', 'เอกสาร': 'description', 'อื่นๆ': 'more_horiz' };

window.renderCategoryTabs = function() {
  const container = document.getElementById('filesCategoryTabs');
  if (!container) return;
  const cats = [ 'ALL', ...new Set(globalAppFiles.map(f => f.category || 'อื่นๆ')) ];
  if (!cats.includes(filesActiveCategory)) filesActiveCategory = 'ALL';
  container.innerHTML = cats.map(c => {
    const count = c === 'ALL' ? globalAppFiles.length : globalAppFiles.filter(f => (f.category || 'อื่นๆ') === c).length;
    return `<button type="button" class="fa-chip${filesActiveCategory === c ? ' on' : ''}" data-c="${_fEsc(c)}" onclick="setFilesCategory(this.dataset.c)"><span class="material-icons">${FILES_CAT_ICONS[c] || 'label'}</span>${c === 'ALL' ? 'ทั้งหมด' : _fEsc(c)}<b>${count}</b></button>`;
  }).join('');
  const stat = document.getElementById('filesStatLine');
  if (stat) {
    const total = Object.values(globalFilesDownloads).reduce((a, n) => a + (Number(n) || 0), 0);
    stat.textContent = `${globalAppFiles.length} รายการ · ${cats.length - 1} หมวด · ดาวน์โหลดรวม ${total.toLocaleString()} ครั้ง`;
  }
};

window.setFilesCategory = function(cat) {
  filesActiveCategory = cat;
  renderCategoryTabs();
  renderFilesGrid();
};

window.setFilesSort = function(mode) {
  filesSortMode = mode;
  document.querySelectorAll('#filesSortBar button').forEach(b => b.classList.toggle('on', b.dataset.s === mode));
  renderFilesGrid();
};

function _fKind(f) {
  const urls = _fUrls(f);
  const u = _fUrlOf(urls[0]).toLowerCase();
  if (urls.length > 1 || /\.(zip|rar|7z)(\?|$)/.test(u)) return { icon: 'folder_zip', c: '#f59e0b', label: urls.length > 1 ? `${urls.length} ไฟล์` : 'ไฟล์บีบอัด' };
  if (/\.(exe|msi|apk|dmg)(\?|$)/.test(u)) return { icon: 'terminal', c: '#ef4444', label: 'ตัวติดตั้ง' };
  if (u.includes('drive.google')) return { icon: 'add_to_drive', c: '#10b981', label: 'Google Drive' };
  if (/\.(pdf|docx?|xlsx?|pptx?)(\?|$)/.test(u)) return { icon: 'description', c: '#3b82f6', label: 'เอกสาร' };
  if (u.includes('supabase.co')) return { icon: 'insert_drive_file', c: '#6366f1', label: 'ไฟล์' };
  return { icon: 'link', c: '#64748b', label: 'ลิงก์' };
}

window.renderFilesGrid = function() {
  const grid = document.getElementById('filesGrid');
  if (!grid) return;
  const term = (document.getElementById('searchFilesInput')?.value || '').trim().toLowerCase();
  const isAdmin = _fIsAdmin();
  const now = Date.now(), week = 7 * 864e5;
  let list = globalAppFiles.filter(f => {
    const okSearch = !term || String(f.title || '').toLowerCase().includes(term) || String(f.desc || '').toLowerCase().includes(term);
    const okCat = filesActiveCategory === 'ALL' || (f.category || 'อื่นๆ') === filesActiveCategory;
    return okSearch && okCat;
  });
  if (filesSortMode === 'pop') list = list.slice().sort((a, b) => (globalFilesDownloads[b.id] || 0) - (globalFilesDownloads[a.id] || 0));
  else if (filesSortMode === 'name') list = list.slice().sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'th'));
  else list = list.slice().sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0));
  if (!list.length) {
    grid.innerHTML = `<div class="fa-empty"><span class="material-icons">folder_off</span><b>${term ? `ไม่พบ "${_fEsc(term)}"` : 'ยังไม่มีไฟล์ในหมวดนี้'}</b>${isAdmin && !term ? '<span>กด "เพิ่มไฟล์" เพื่อเริ่ม</span>' : ''}</div>`;
    return;
  }
  grid.innerHTML = list.map(f => {
    const k = _fKind(f);
    const id = _fEsc(f.id);
    const cover = f.cover_url && _fSafeUrl(f.cover_url) ? `<img src="${_fEsc(f.cover_url)}" loading="lazy" decoding="async" alt="" onerror="this.remove()">` : '';
    const isUpd = f.updated_at && f.updated_at !== f.created_at && now - f.updated_at < week;
    const isNew = !isUpd && now - (f.created_at || 0) < week;
    const dl = globalFilesDownloads[f.id] || 0;
    const when = f.updated_at || f.created_at;
    const whenTxt = when ? new Date(when).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
    const desc = String(f.desc || '').trim();
    return `<article class="fa-card">
      ${isAdmin ? `<div class="fa-adm"><button type="button" data-id="${id}" onclick="editFileLink(this.dataset.id)" title="แก้ไข" aria-label="แก้ไข"><span class="material-icons">edit</span></button><button type="button" class="del" data-id="${id}" onclick="deleteFileLink(this.dataset.id)" title="ลบ" aria-label="ลบ"><span class="material-icons">delete</span></button></div>` : ''}
      <div class="fa-top">
        <span class="fa-ic" style="--c:${k.c}">${cover || `<span class="material-icons">${k.icon}</span>`}</span>
        <div class="fa-tt">
          <div class="fa-name" title="${_fEsc(f.title)}">${_fEsc(f.title || 'ไม่มีชื่อ')}</div>
          <div class="fa-tags"><span class="fa-tag">${_fEsc(f.category || 'อื่นๆ')}</span>${k.label !== (f.category || 'อื่นๆ') ? `<span class="fa-tag">${_fEsc(k.label)}</span>` : ''}${isUpd ? '<span class="fa-tag upd">อัปเดต</span>' : isNew ? '<span class="fa-tag new">ใหม่</span>' : ''}</div>
        </div>
      </div>
      <div class="fa-desc${desc ? '' : ' empty'}"><span>${desc ? _fEsc(desc) : 'ไม่มีรายละเอียด'}</span>${desc ? `<button type="button" class="fa-copy" data-t="${_fEsc(desc)}" onclick="filesCopyText(this.dataset.t)" title="คัดลอก" aria-label="คัดลอกรายละเอียด"><span class="material-icons">content_copy</span></button>` : ''}</div>
      <div class="fa-foot">
        <div class="fa-meta"><span><b>${dl.toLocaleString()}</b> ครั้ง</span><span>${_fEsc(whenTxt)}</span></div>
        <button type="button" class="fa-dl" data-id="${id}" onclick="forceDownloadFile(this.dataset.id)"><span class="material-icons">download</span>ดาวน์โหลด</button>
      </div>
    </article>`;
  }).join('');
};

window.filesCopyText = async function(t) {
  try {
    await navigator.clipboard.writeText(t);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e2) {}
    ta.remove();
  }
  Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'คัดลอกแล้ว', showConfirmButton: false, timer: 1200 });
};

function _fSetSubmit(edit) {
  const btn = document.getElementById('fileSubmitBtn');
  btn.innerText = edit ? 'บันทึกการแก้ไข' : 'บันทึกไฟล์';
  btn.classList.toggle('edit', !!edit);
  document.getElementById('fileModalTitle').innerHTML = edit ? '<span class="material-icons" style="color:#f59e0b">edit</span> แก้ไขข้อมูลไฟล์' : '<span class="material-icons" style="color:#10b981">add_box</span> เพิ่มไฟล์ใหม่';
}

window.openAddFileModal = function() {
  if (!_fIsAdmin()) return;
  document.getElementById('fileModal').classList.remove('hidden');
  [ 'fileEditId', 'fileTitle', 'fileDesc', 'fileExternalUrl', 'fileInput', 'fileCoverInput' ].forEach(id => {
    if (document.getElementById(id)) document.getElementById(id).value = '';
  });
  const catEl = document.getElementById('fileCategory');
  if (catEl) catEl.value = '';
  document.getElementById('currentFileUrl')?.classList.add('hidden');
  document.getElementById('currentCoverContainer')?.classList.add('hidden');
  _fSetSubmit(false);
};

window.editFileLink = function(id) {
  if (!_fIsAdmin()) return;
  const f = globalAppFiles.find(x => String(x.id) === String(id));
  if (!f) return Swal.fire('Error', 'ไม่พบข้อมูลไฟล์', 'error');
  document.getElementById('fileModal').classList.remove('hidden');
  document.getElementById('fileEditId').value = f.id;
  document.getElementById('fileTitle').value = f.title || '';
  document.getElementById('fileDesc').value = f.desc || '';
  const catEl = document.getElementById('fileCategory');
  if (catEl) catEl.value = f.category || '';
  const urls = _fUrls(f);
  const firstUrlStr = _fUrlOf(urls[0]);
  document.getElementById('fileExternalUrl').value = firstUrlStr && !firstUrlStr.includes('supabase.co') ? firstUrlStr : '';
  document.getElementById('fileInput').value = '';
  document.getElementById('fileCoverInput').value = '';
  const urlEl = document.getElementById('currentFileUrl');
  if (urlEl) {
    if (firstUrlStr.includes('supabase.co')) {
      urlEl.innerText = `มีไฟล์ที่อัปไว้แล้ว ${urls.length} ไฟล์ · เลือกไฟล์ใหม่ = แทนที่ทั้งหมด`;
      urlEl.classList.remove('hidden');
    } else urlEl.classList.add('hidden');
  }
  const cc = document.getElementById('currentCoverContainer'), ci = document.getElementById('currentFileCover');
  if (cc && ci) {
    if (f.cover_url) {
      ci.src = f.cover_url;
      cc.classList.remove('hidden');
    } else cc.classList.add('hidden');
  }
  _fSetSubmit(true);
};

function _fStoragePath(u) {
  const s = _fUrlOf(u);
  const m = s.match(/\/storage\/v1\/object\/public\/staff_images\/(files\/[^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function _fRemoveStorage(urls) {
  const paths = (urls || []).map(_fStoragePath).filter(Boolean);
  if (!paths.length) return;
  try {
    await appDB.storage.from('staff_images').remove(paths);
  } catch (e) {}
}

window.saveFileData = async function(e) {
  e.preventDefault();
  if (!_fIsAdmin()) return Swal.fire('ไม่มีสิทธิ์', 'จัดการไฟล์ได้เฉพาะผู้มีสิทธิ์', 'error');
  const id = document.getElementById('fileEditId').value;
  const title = document.getElementById('fileTitle').value.trim();
  const desc = document.getElementById('fileDesc').value.trim();
  const category = document.getElementById('fileCategory')?.value.trim() || '';
  const externalUrl = document.getElementById('fileExternalUrl').value.trim();
  const fileInput = document.getElementById('fileInput');
  const coverInput = document.getElementById('fileCoverInput');
  if (!title) return;
  if (externalUrl && !_fSafeUrl(externalUrl)) return Swal.fire('ลิงก์ไม่ถูกต้อง', 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', 'warning');
  if (!id && !externalUrl && (!fileInput.files || fileInput.files.length === 0)) return Swal.fire('เตือน', 'กรุณาวางลิงก์ดาวน์โหลด หรือ เลือกไฟล์อัปโหลดอย่างน้อย 1 รายการครับ', 'warning');
  const withTimeout = (promise, ms, label) => Promise.race([ promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} ใช้เวลานานเกินไป (เกิน ${Math.round(ms / 1e3)} วินาที)\n\n• ไฟล์อาจใหญ่เกินไป หรือเน็ตช้า\n• ลองย่อไฟล์ให้เล็กลง แล้วอัปใหม่`)), ms)) ]);
  const MAX_MB = 480;
  const allFiles = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
  const coverFiles = coverInput && coverInput.files ? Array.from(coverInput.files) : [];
  const tooBig = [ ...allFiles, ...coverFiles ].find(f => f.size > MAX_MB * 1024 * 1024);
  if (tooBig) return Swal.fire('ไฟล์ใหญ่เกินไป', `"${tooBig.name}" ขนาด ${(tooBig.size / 1024 / 1024).toFixed(1)} MB\nระบบรับได้ไม่เกิน ${MAX_MB} MB ต่อไฟล์ครับ`, 'warning');
  Swal.fire({
    title: 'กำลังอัปโหลด...',
    html: `<div class="text-sm text-gray-400">ระบบกำลังส่งไฟล์...</div><div id="upProgress" class="mt-2 text-xs font-bold text-amber-400"></div>`,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  const setUp = t => {
    const el = document.getElementById('upProgress');
    if (el) el.innerText = t;
  };
  const uploaded = [];
  try {
    let finalFileUrls = null;
    if (externalUrl) finalFileUrls = [ externalUrl ]; else if (allFiles.length > 0) {
      finalFileUrls = [];
      for (const [index, file] of allFiles.entries()) {
        const mb = file.size / 1024 / 1024;
        setUp(`ไฟล์ ${index + 1}/${allFiles.length}: ${file.name} (${mb.toFixed(1)} MB)${mb > 30 ? '\nไฟล์ใหญ่ อาจใช้เวลาสักครู่ อย่าปิดหน้านี้นะครับ' : ''}`);
        const fileExt = file.name.split('.').pop();
        const fileName = `app_${Date.now()}_${Math.floor(Math.random() * 1e3)}_${index}.${fileExt}`;
        const limitMs = Math.min(18e5, Math.max(18e4, mb * 1e4));
        const { error: uploadError } = await withTimeout(appDB.storage.from('staff_images').upload(`files/${fileName}`, await window.compressImageFile(file, { maxDim: 2e3, quality: .85 }), { cacheControl: '3600', upsert: false }), limitMs, `อัปโหลด "${file.name}"`);
        if (uploadError) throw new Error(`อัปโหลดไฟล์ ${file.name} ไม่สำเร็จ: ${uploadError.message || ''}`);
        const { data: pub } = appDB.storage.from('staff_images').getPublicUrl(`files/${fileName}`);
        uploaded.push(pub.publicUrl);
        finalFileUrls.push({ url: pub.publicUrl, originalName: file.name });
      }
    }
    let finalCoverUrl = null;
    if (coverFiles.length > 0) {
      let coverFile = coverFiles[0];
      setUp(`กำลังอัปรูปปก: ${coverFile.name}`);
      if (typeof window.compressImage === 'function') coverFile = await window.compressImage(coverFile, { maxWidth: 256, maxHeight: 256, quality: .85, skipUnderKB: 40 });
      const coverExt = (coverFile.name || 'cover.webp').split('.').pop();
      const coverName = `cover_${Date.now()}_${Math.floor(Math.random() * 1e3)}.${coverExt}`;
      const { error: coverError } = await withTimeout(appDB.storage.from('staff_images').upload(`files/covers/${coverName}`, coverFile, { cacheControl: '3600', upsert: false }), 18e4, 'อัปโหลดรูปปก');
      if (coverError) throw new Error('อัปโหลดรูปปกไม่สำเร็จ: ' + coverError.message);
      const { data: cpub } = appDB.storage.from('staff_images').getPublicUrl(`files/covers/${coverName}`);
      uploaded.push(cpub.publicUrl);
      finalCoverUrl = cpub.publicUrl;
    }
    setUp('กำลังบันทึกข้อมูล...');
    const latest = await _filesReadKey('app_files_data', []);
    const list = Array.isArray(latest) ? latest : [];
    let oldUrls = [], oldCover = null;
    if (id) {
      const idx = list.findIndex(x => String(x.id) === String(id));
      if (idx === -1) throw new Error('ไฟล์นี้ถูกลบไปแล้วโดยผู้ใช้อื่น');
      const cur = list[idx];
      if (finalFileUrls) oldUrls = _fUrls(cur);
      if (finalCoverUrl) oldCover = cur.cover_url;
      list[idx] = { ...cur, title, desc, category, url: finalFileUrls || cur.url, cover_url: finalCoverUrl || cur.cover_url || '', updated_at: Date.now() };
    } else {
      list.unshift({ id: 'file_' + Date.now(), title, url: finalFileUrls || [], cover_url: finalCoverUrl || '', desc, category, created_at: Date.now() });
    }
    const { error: saveErr } = await withTimeout(appDB.from('settings').upsert([ { key: 'app_files_data', value: JSON.stringify(list) } ]), 45e3, 'บันทึกข้อมูล');
    if (saveErr) throw new Error('บันทึกข้อมูลไม่สำเร็จ: ' + (saveErr.message || ''));
    globalAppFiles = list;
    _filesSaveSnapshot();
    const stillUsed = new Set(list.flatMap(x => _fUrls(x).map(_fUrlOf).concat(x.cover_url || '')));
    _fRemoveStorage(oldUrls.concat(oldCover ? [ oldCover ] : []).filter(u => !stillUsed.has(_fUrlOf(u))));
    document.getElementById('fileModal').classList.add('hidden');
    renderCategoryTabs();
    renderFilesGrid();
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
  } catch (err) {
    console.error('[อัปโหลดไฟล์] ล้มเหลว:', err);
    _fRemoveStorage(uploaded);
    Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', html: `<div style="white-space:pre-wrap;text-align:left;font-size:13px">${_fEsc(err.message || 'ไม่ทราบสาเหตุ')}</div>` });
  }
};

window.deleteFileLink = async function(id) {
  if (!_fIsAdmin()) return;
  const f0 = globalAppFiles.find(x => String(x.id) === String(id));
  const r = await Swal.fire({ title: 'ลบไฟล์นี้?', text: f0 ? `"${f0.title}" · ลบแล้วกู้คืนไม่ได้` : 'ลบแล้วกู้คืนไม่ได้', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#475569', confirmButtonText: 'ลบทิ้งเลย', cancelButtonText: 'ยกเลิก' });
  if (!r.isConfirmed) return;
  Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
  try {
    const latest = await _filesReadKey('app_files_data', []);
    const list = (Array.isArray(latest) ? latest : []).filter(f => String(f.id) !== String(id));
    const target = (Array.isArray(latest) ? latest : []).find(f => String(f.id) === String(id));
    const { error } = await appDB.from('settings').upsert([ { key: 'app_files_data', value: JSON.stringify(list) } ]);
    if (error) throw error;
    globalAppFiles = list;
    _filesSaveSnapshot();
    if (target) {
      const stillUsed = new Set(list.flatMap(x => _fUrls(x).map(_fUrlOf).concat(x.cover_url || '')));
      _fRemoveStorage(_fUrls(target).concat(target.cover_url ? [ target.cover_url ] : []).filter(u => !stillUsed.has(_fUrlOf(u))));
    }
    renderCategoryTabs();
    renderFilesGrid();
    Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', timer: 1500, showConfirmButton: false });
  } catch (e) {
    Swal.fire('ลบไม่สำเร็จ', e.message || String(e), 'error');
  }
};

async function _filesTrackDownload(f) {
  const user = typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'unknown';
  globalFilesDownloads[f.id] = (globalFilesDownloads[f.id] || 0) + 1;
  globalFilesLogs.unshift({ file_id: f.id, file_title: f.title, user, ts: Date.now() });
  renderCategoryTabs();
  renderFilesGrid();
  try {
    const [ dl, logs ] = await Promise.all([ _filesReadKey('app_files_downloads', {}), _filesReadKey('app_files_logs', []) ]);
    const d = dl && typeof dl === 'object' ? dl : {};
    d[f.id] = (Number(d[f.id]) || 0) + 1;
    const l = [ { file_id: f.id, file_title: f.title, user, ts: Date.now() }, ...(Array.isArray(logs) ? logs : []) ].slice(0, 500);
    await Promise.all([ appDB.from('settings').upsert([ { key: 'app_files_downloads', value: JSON.stringify(d) } ]), appDB.from('settings').upsert([ { key: 'app_files_logs', value: JSON.stringify(l) } ]) ]);
    globalFilesDownloads = d;
    globalFilesLogs = l;
    _filesSaveSnapshot();
  } catch (e) {
    console.error('log error:', e);
  }
}

function _fDlUrl(u, name) {
  let x = _fUrlOf(u);
  if (x.includes('supabase.co/storage/v1/object/public/')) x += (x.includes('?') ? '&' : '?') + `download=${encodeURIComponent(name)}`;
  return x;
}

window.forceDownloadFile = async function(id) {
  const f = globalAppFiles.find(x => String(x.id) === String(id));
  const urls = f ? _fUrls(f) : [];
  if (!f || !urls.length) return Swal.fire('Error', 'ไม่มีลิงก์สำหรับดาวน์โหลด', 'error');
  if (urls.some(u => !_fSafeUrl(_fUrlOf(u)))) return Swal.fire('ลิงก์ไม่ถูกต้อง', 'ลิงก์ของไฟล์นี้ไม่ปลอดภัย กรุณาแจ้งผู้ดูแลแก้ไข', 'error');
  _filesTrackDownload(f);
  if (urls.length === 1) {
    const single = _fUrlOf(urls[0]);
    const defName = `${f.title}.${single.split('.').pop().split('?')[0] || 'file'}`;
    const name = typeof urls[0] === 'object' && urls[0].originalName ? urls[0].originalName : defName;
    if (!single.includes('supabase.co')) {
      window.open(single, '_blank', 'noopener');
      return;
    }
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true }).fire({ icon: 'success', title: 'เริ่มดาวน์โหลดแล้ว' });
    const a = document.createElement('a');
    a.href = _fDlUrl(single, name);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const btns = urls.map((u, i) => {
    const single = _fUrlOf(u);
    const defName = `${f.title}_part${i + 1}.${single.split('.').pop().split('?')[0] || 'file'}`;
    const name = typeof u === 'object' && u.originalName ? u.originalName : defName;
    return `<a href="${_fEsc(_fDlUrl(single, name))}" download="${_fEsc(name)}" target="_blank" rel="noopener" onclick="this.style.borderColor='#10b981';this.querySelector('.material-icons').innerText='check_circle'" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;background:var(--k-sunk);border:1px solid var(--k-line3);color:var(--k-tx-strong);text-decoration:none"><span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;background:var(--k-panel);color:var(--k-mute)">${i + 1}</span><span style="flex:1;min-width:0;font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_fEsc(name)}</span><span class="material-icons" style="color:#10b981">download</span></a>`;
  }).join('');
  Swal.fire({ title: `รายการนี้มี ${urls.length} ไฟล์`, html: `<p style="font-size:12.5px;color:var(--k-mute);margin:0 0 12px">กดดาวน์โหลดทีละไฟล์</p><div style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;text-align:left">${btns}</div>`, showConfirmButton: false, showCloseButton: true });
};

window.openFilesDownloadLog = function() {
  if (!_fIsAdmin()) return;
  if (!globalFilesLogs.length) return Swal.fire('ยังไม่มีประวัติ', 'ยังไม่มีใครดาวน์โหลดไฟล์', 'info');
  const summary = {};
  globalFilesLogs.forEach(l => {
    summary[l.file_title] = (summary[l.file_title] || 0) + 1;
  });
  const top = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const medal = [ '#E8C15A', '#cbd5e1', '#d08a4e' ];
  const topHtml = top.map(([ t, n ], i) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:var(--k-sunk);border:1px solid var(--k-line);margin-bottom:6px"><span style="width:24px;height:24px;border-radius:99px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;background:${medal[i] || 'var(--k-panel)'};color:${i < 3 ? '#1b1406' : 'var(--k-mute)'}">${i + 1}</span><span style="flex:1;min-width:0;font-weight:800;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_fEsc(t)}</span><b style="color:var(--k-green-tx)">${n} ครั้ง</b></div>`).join('');
  const logHtml = globalFilesLogs.slice(0, 100).map(l => {
    const t = new Date(l.ts).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--k-line)"><span class="material-icons" style="font-size:16px;color:#10b981">download</span><span style="flex:1;min-width:0;font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_fEsc(l.file_title)}</span><span style="font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:99px;background:rgba(59,130,246,.14);color:#3b82f6">${_fEsc(l.user)}</span><span style="font-size:11px;color:var(--k-mute);white-space:nowrap">${_fEsc(t)}</span></div>`;
  }).join('');
  Swal.fire({ html: `<div style="text-align:left"><div style="font-weight:900;font-size:16px;margin-bottom:10px">ไฟล์ยอดนิยม</div>${topHtml}<div style="font-weight:900;font-size:15px;margin:16px 0 6px">ประวัติล่าสุด 100 รายการ</div><div style="max-height:45vh;overflow-y:auto">${logHtml}</div></div>`, showConfirmButton: false, showCloseButton: true, width: '620px' });
};
