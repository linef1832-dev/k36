let currentGalleryData = [];

let currentGalleryMode = 'general';

let _galleryPage = 1;

const GALLERY_TPL_HTML_KEYS = [ 'renameBtn', 'newBadge', 'adminCheckbox', 'catBadge', 'lightboxClick' ];

function getGalleryTpl(templateId, data = {}) {
  const tpl = document.getElementById(templateId);
  if (!tpl) return '';
  let html = tpl.innerHTML;
  for (const key in data) {
    const raw = data[key] !== undefined && data[key] !== null ? data[key] : '';
    const val = GALLERY_TPL_HTML_KEYS.includes(key) ? raw : String(raw).replace(/[&<>"']/g, (c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]));
    html = html.split(`{{${key}}}`).join(val);
  }
  return html;
}

const GALLERY_MODE_SUFFIX = {
  general: '',
  bonus: '_BONUS',
  reach: '_REACH',
  card: '_CARD',
  logo: '_LOGO'
};

const GALLERY_MODE_LABEL = {
  general: 'ไม่พบรูปภาพ',
  bonus: 'ยังไม่มีรูปโบนัสไทม์',
  reach: 'ยังไม่มีรูปรีชเมนู',
  card: 'ยังไม่มีรูปการ์ดเมนู',
  logo: 'ยังไม่มีรูป LOGO'
};

const GALLERY_MODE_UPLOAD_TEXT = {
  general: '',
  bonus: '🎁 โบนัสไทม์ ',
  reach: '📣 รีชเมนู ',
  card: '🃏 การ์ดเมนู ',
  logo: '🏷️ LOGO '
};

window.initGalleryApp = function() {
  const tabPermMap = {
    tabBonus: 'gallery_tab_bonus',
    tabReach: 'gallery_tab_reach',
    tabCard: 'gallery_tab_card',
    tabLogo: 'gallery_tab_logo'
  };
  Object.keys(tabPermMap).forEach((btnId => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const permId = tabPermMap[btnId];
    const canSee = canPerm(permId);
    if (canSee) btn.classList.remove('hidden'); else btn.classList.add('hidden');
  }));
  switchGalleryMode('general');
  const adminControls = document.getElementById('adminUploadControls');
  const bulkDeleteBtn = document.getElementById('btnBulkDelete');
  if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
  document.querySelectorAll('.gallery-check').forEach((cb => cb.checked = false));
  const canUpload = canPerm('gallery_upload');
  if (adminControls) {
    if (canUpload) adminControls.classList.remove('hidden'); else adminControls.classList.add('hidden');
  }
  const filterSelect = document.getElementById('galleryFilter');
  const uploadSelect = document.getElementById('uploadCategory');
  if (filterSelect && uploadSelect) {
    let optionsHTML = TEAM_LIST.map((t => `<option value="${t}">${t}</option>`)).join('');
    if (!filterSelect.innerHTML.includes(TEAM_LIST[0])) {
      filterSelect.innerHTML = `<option value="all">-- ทุกเว็บ --</option><option value="ทั่วไป">ทั่วไป</option>` + optionsHTML;
      uploadSelect.innerHTML = `<option value="ทั่วไป">ทั่วไป</option>` + optionsHTML;
    }
    const currentTeam = document.getElementById('dailyTeam') ? document.getElementById('dailyTeam').value : 'ทั่วไป';
    if (TEAM_LIST.includes(currentTeam)) {
      filterSelect.value = currentTeam;
      uploadSelect.value = currentTeam;
    } else {
      filterSelect.value = 'all';
    }
  }
  const searchInput = document.getElementById('gallerySearch');
  if (searchInput) searchInput.value = '';
  setTimeout((() => initGalleryDragDrop()), 300);
};

window.switchGalleryMode = function(mode) {
  const modePerm = {
    bonus: 'gallery_tab_bonus',
    reach: 'gallery_tab_reach',
    card: 'gallery_tab_card',
    logo: 'gallery_tab_logo'
  };
  if (modePerm[mode]) {
    const allowed = typeof window.hasUserPerm === 'function' && window.hasUserPerm(modePerm[mode]);
    if (!allowed) {
      Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์เข้าดูแท็บนี้ครับ', 'warning');
      return;
    }
  }
  currentGalleryMode = mode;
  const tabBtn = {
    general: 'tabGeneral',
    bonus: 'tabBonus',
    reach: 'tabReach',
    card: 'tabCard',
    logo: 'tabLogo'
  };
  Object.keys(tabBtn).forEach((k => {
    const el = document.getElementById(tabBtn[k]);
    if (el) el.classList.toggle('on', k === mode);
  }));
  fetchGalleryImages();
};

window.syncUploadCategory = function() {
  const viewVal = document.getElementById('galleryFilter').value;
  const uploadSelect = document.getElementById('uploadCategory');
  if (viewVal !== 'all' && uploadSelect) {
    uploadSelect.value = viewVal;
  }
};

let _galleryAllData = [];

let _galleryLastFetch = 0;

const GALLERY_SNAP_KEY = 'gallery_page_cache_v1';

const GALLERY_REFRESH_MS = 15e3;

window._galleryMarkDirty = function() {
  _galleryLastFetch = 0;
};

function _gallerySlim(rows) {
  return (rows || []).map((r => ({
    id: r.id,
    name: r.name,
    url: r.url,
    thumb_url: r.thumb_url || '',
    category: r.category,
    created_at: r.created_at,
    uploaded_by: r.uploaded_by || r.uploader || '',
    uploader: r.uploader || ''
  })));
}

function _gallerySnapLoad() {
  try {
    const raw = typeof window.safeGetItem === 'function' ? window.safeGetItem(GALLERY_SNAP_KEY) : localStorage.getItem(GALLERY_SNAP_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.rows) || !s.rows.length) return false;
    _galleryAllData = s.rows;
    return true;
  } catch (e) {
    return false;
  }
}

function _gallerySnapSave() {
  try {
    const raw = JSON.stringify({
      rows: _galleryAllData,
      ts: Date.now()
    });
    if (typeof window.safeSetItem === 'function') window.safeSetItem(GALLERY_SNAP_KEY, raw); else localStorage.setItem(GALLERY_SNAP_KEY, raw);
  } catch (e) {}
}

window.fetchGalleryImages = async function() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const hasData = _galleryAllData.length > 0 || _gallerySnapLoad();
  if (hasData) _renderGalleryGrid(); else grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10 flex flex-col items-center"><span class="material-icons animate-spin text-4xl mb-2">sync</span>กำลังโหลด...</div>';
  if (hasData && Date.now() - _galleryLastFetch < GALLERY_REFRESH_MS) return;
  _galleryLastFetch = Date.now();
  try {
    const {data: data, error: error} = await window.selectAllRows((() => appDB.from('image_gallery').select('*').order('created_at', {
      ascending: false
    })));
    if (error || !data) {
      if (!hasData) grid.innerHTML = '<div class="col-span-full text-center text-red-400">โหลดไม่สำเร็จ</div>';
      return;
    }
    const slim = _gallerySlim(data);
    const changed = JSON.stringify(slim) !== JSON.stringify(_galleryAllData);
    _galleryAllData = slim;
    _gallerySnapSave();
    if (!hasData || changed) _renderGalleryGrid();
  } catch (e) {
    console.error('gallery fetch:', e);
    if (!hasData) grid.innerHTML = '<div class="col-span-full text-center text-red-400">โหลดไม่สำเร็จ</div>';
  }
};

function _renderGalleryGrid() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const filterVal = document.getElementById('galleryFilter').value;
  const searchVal = document.getElementById('gallerySearch').value.toLowerCase();
  const countSpan = document.getElementById('galleryCount');
  const data = _galleryAllData;
  const currentSuffix = GALLERY_MODE_SUFFIX[currentGalleryMode] || '';
  const allSuffixes = Object.values(GALLERY_MODE_SUFFIX).filter((s => s !== ''));
  let filteredData = data.filter((img => {
    const cat = img.category || '';
    if (currentGalleryMode === 'general') {
      for (const suf of allSuffixes) {
        if (cat.endsWith(suf)) return false;
      }
    } else {
      if (!cat.endsWith(currentSuffix)) return false;
    }
    if (filterVal !== 'all') {
      const targetCat = filterVal + currentSuffix;
      if (cat !== targetCat) return false;
    }
    if (searchVal && !String(img.name || '').toLowerCase().includes(searchVal)) return false;
    return true;
  }));
  currentGalleryData = filteredData;
  if (countSpan) countSpan.innerText = filteredData.length;
  _renderWebBadges(filteredData);
  if (filteredData.length === 0) {
    const msg = GALLERY_MODE_LABEL[currentGalleryMode] || 'ไม่พบรูปภาพ';
    grid.innerHTML = `<div class="gx-empty"><span class="material-icons">image_not_supported</span>${searchVal ? 'ไม่พบรูปที่ตรงกับ "' + window.escapeHtml(searchVal) + '"' : msg}</div>`;
    return;
  }
  const sortVal = document.getElementById('gallerySort')?.value || 'newest';
  if (sortVal === 'newest') filteredData.sort(((a, b) => new Date(b.created_at) - new Date(a.created_at))); else if (sortVal === 'oldest') filteredData.sort(((a, b) => new Date(a.created_at) - new Date(b.created_at))); else if (sortVal === 'name_asc') filteredData.sort(((a, b) => (a.name || '').localeCompare(b.name || ''))); else if (sortVal === 'name_desc') filteredData.sort(((a, b) => (b.name || '').localeCompare(a.name || '')));
  const perPage = parseInt(document.getElementById('galleryPerPage')?.value || '50');
  const maxPage = Math.ceil(filteredData.length / perPage);
  if (_galleryPage > maxPage) _galleryPage = 1;
  const start = (_galleryPage - 1) * perPage;
  const pageData = filteredData.slice(start, start + perPage);
  const pagEl = document.getElementById('galleryPagination');
  if (pagEl) {
    if (maxPage > 1) {
      const nums = [];
      for (let p = 1; p <= maxPage; p++) {
        if (p === 1 || p === maxPage || Math.abs(p - _galleryPage) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
      }
      const b = (lbl, p, on, dis) => `<button type="button" class="gx-pg${on ? ' on' : ''}" ${dis ? 'disabled' : `onclick="_galleryPage=${p}; fetchGalleryImages()"`}>${lbl}</button>`;
      pagEl.innerHTML = `<span style="font-size:11.5px;font-weight:700;color:var(--k-mute);margin-right:4px">หน้า ${_galleryPage}/${maxPage}</span>` + b('‹', _galleryPage - 1, false, _galleryPage === 1) + nums.map((p => p === '…' ? '<span style="color:var(--k-mute2)">…</span>' : b(p, p, p === _galleryPage, false))).join('') + b('›', _galleryPage + 1, false, _galleryPage === maxPage);
    } else {
      pagEl.innerHTML = '';
    }
  }
  const isAdminG = canPerm('gallery_delete');
  const canDelG = isAdminG || typeof window.hasUserPerm === 'function' && window.hasUserPerm('gallery_delete');
  const lastViewG = new Date(localStorage.getItem(`gallery_last_view_${currentUser.username}`) || '2000-01-01');
  grid.innerHTML = pageData.map(((img, i) => {
    const realIdx = start + i;
    const imgDate = new Date(img.created_at);
    const isNewG = imgDate > lastViewG;
    const uploadDate = imgDate.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const uploadBy = img.uploaded_by ? `· ${img.uploaded_by}` : '';
    const newBadgeG = isNewG ? `<span class="gx-new">ใหม่</span>` : '';
    const adminCbG = canDelG ? `<div class="absolute top-2 left-2 z-30" onclick="event.stopPropagation()"><input type="checkbox" class="gallery-check w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shadow-sm bg-white" value="${img.id}" onchange="updateBulkDeleteButton()"></div>` : '';
    let catNameG = img.category || '';
    let catBg = 'rgba(15,23,42,.72)';
    const sufMap = {
      _BONUS: 'rgba(217,119,6,.9)',
      _REACH: 'rgba(162,28,175,.9)',
      _CARD: 'rgba(5,150,105,.9)',
      _LOGO: 'rgba(225,29,72,.9)'
    };
    Object.keys(sufMap).forEach((suf => {
      if (catNameG.endsWith(suf)) {
        catNameG = catNameG.slice(0, -suf.length);
        catBg = sufMap[suf];
      }
    }));
    const catBadgeG = catNameG ? `<span class="gx-badge-cat" style="--bc:${catBg}">${window.escapeHtml(catNameG)}</span>` : '';
    const isAdminRename = canPerm('gallery_rename');
    const renameBtn = isAdminRename ? `<button data-img-id="${window.escapeHtml(img.id)}" data-img-name="${window.escapeHtml(img.name || '')}" onclick="event.stopPropagation(); renameGalleryImage(this.dataset.imgId, this.dataset.imgName)" class="text-amber-400 hover:text-amber-300 shrink-0 transition opacity-0 group-hover:opacity-100"><span class="material-icons text-[14px]">edit</span></button>` : '';
    return getGalleryTpl('tpl-gallery-card', {
      url: img.url,
      name: img.name,
      thumb: img.thumb_url || img.url,
      imgId: img.id,
      renameBtn: renameBtn,
      newBadge: newBadgeG,
      adminCheckbox: adminCbG,
      catBadge: catBadgeG,
      uploadDate: uploadDate,
      uploadBy: uploadBy,
      lbIndex: realIdx,
      lightboxClick: ''
    });
  })).join('');
  updateBulkDeleteButton();
  if (typeof window.preloadGalleryFulls === 'function') setTimeout((() => window.preloadGalleryFulls(currentGalleryData)), 800);
  if (typeof window.galleryWarmPng === 'function') window.galleryWarmPng(pageData.map((x => x.url)));
}

window.handleImageUpload = async function(input) {
  const files = input.files;
  let category = document.getElementById('galleryFilter').value;
  if (category === 'all' || !category) category = 'ทั่วไป';
  const currentSuffix = GALLERY_MODE_SUFFIX[currentGalleryMode] || '';
  category += currentSuffix;
  const displayCategory = category.replace(currentSuffix, '');
  const modeText = GALLERY_MODE_UPLOAD_TEXT[currentGalleryMode] || '';
  if (!files || files.length === 0) return;
  Swal.fire({
    title: 'กำลังอัปโหลด...',
    text: `กำลังนำรูปไปใส่ในหมวด: ${modeText}${displayCategory}`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    Swal.update({
      text: `กำลังอัปโหลดไฟล์: ${file.name} (${i + 1}/${files.length})`
    });
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1e4)}.${fileExt}`;
      const {error: uploadError} = await appDB.storage.from('staff_images').upload(fileName, await window.compressImageFile(file, {
        maxDim: 1920,
        quality: .85
      }), {
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) throw new Error(uploadError.message);
      const {data: publicUrlData} = appDB.storage.from('staff_images').getPublicUrl(fileName);
      let thumbUrl = '';
      try {
        if (typeof window.compressImage === 'function') {
          const thumbFile = await window.compressImage(file, {
            maxWidth: 480,
            maxHeight: 480,
            quality: .8,
            skipUnderKB: 60
          });
          if (thumbFile !== file) {
            const thumbName = `thumb_${fileName.replace(/\.[^.]+$/, '')}.webp`;
            const {error: thumbErr} = await appDB.storage.from('staff_images').upload(thumbName, thumbFile, {
              cacheControl: '3600',
              upsert: false
            });
            if (!thumbErr) thumbUrl = appDB.storage.from('staff_images').getPublicUrl(thumbName).data.publicUrl;
          }
        }
      } catch (te) {}
      const row = {
        name: file.name,
        url: publicUrlData.publicUrl,
        uploader: currentUser.username || 'unknown',
        category: category
      };
      if (thumbUrl) row.thumb_url = thumbUrl;
      let {error: dbError} = await appDB.from('image_gallery').insert([ row ]);
      if (dbError && thumbUrl && String(dbError.message || '').includes('thumb_url')) {
        delete row.thumb_url;
        ({error: dbError} = await appDB.from('image_gallery').insert([ row ]));
      }
      if (dbError) throw new Error(dbError.message);
      successCount++;
    } catch (err) {
      failCount++;
    }
  }
  input.value = '';
  document.getElementById('galleryFilter').value = category.replace(currentSuffix, '');
  if (window._galleryMarkDirty) window._galleryMarkDirty();
  fetchGalleryImages();
  if (failCount === 0) Swal.fire({
    icon: 'success',
    title: 'เสร็จสิ้น',
    text: `อัปโหลด ${successCount} รูป เข้าหมวด ${modeText}${displayCategory} เรียบร้อย`,
    timer: 1500,
    showConfirmButton: false
  }); else Swal.fire('แจ้งเตือน', `สำเร็จ ${successCount}, ล้มเหลว ${failCount}`, 'warning');
};

window.updateBulkDeleteButton = function() {
  const checkboxes = document.querySelectorAll('.gallery-check:checked');
  const btn = document.getElementById('btnBulkDelete');
  const countSpan = document.getElementById('selectedCount');
  if (btn) {
    if (checkboxes.length > 0) {
      btn.classList.remove('hidden');
      countSpan.innerText = checkboxes.length;
    } else {
      btn.classList.add('hidden');
    }
  }
};

window.toggleSelectAllImages = function(source) {
  document.querySelectorAll('.gallery-check').forEach((cb => cb.checked = source.checked));
  updateBulkDeleteButton();
};

window.deleteSelectedImages = async function() {
  const ids = Array.from(document.querySelectorAll('.gallery-check:checked')).map((cb => cb.value));
  if (ids.length === 0) return;
  const result = await Swal.fire({
    title: `ลบ ${ids.length} รูป?`,
    text: "ลบแล้วกู้คืนไม่ได้นะครับ",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'ลบเลย!',
    cancelButtonText: 'ยกเลิก'
  });
  if (result.isConfirmed) {
    Swal.fire({
      title: 'กำลังลบ...',
      didOpen: () => Swal.showLoading()
    });
    const {error: error} = await appDB.from('image_gallery').delete().in('id', ids);
    if (error) Swal.fire('Error', error.message, 'error'); else {
      if (window._galleryMarkDirty) window._galleryMarkDirty();
      fetchGalleryImages();
      Swal.fire({
        icon: 'success',
        title: 'ลบเรียบร้อย',
        timer: 1500,
        showConfirmButton: false
      });
    }
  }
};

window.downloadGalleryUrl = async function(url, fileName) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName || `img_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  } catch (e) {
    window.open(url, '_blank');
  }
};

window.downloadAllInFilter = async function() {
  if (!currentGalleryData || currentGalleryData.length === 0) return Swal.fire('ไม่มีรูป', '', 'warning');
  if (typeof JSZip === 'undefined') {
    try {
      Swal.fire({
        title: 'กำลังเตรียมระบบ...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      await new Promise(((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('โหลด JSZip ไม่สำเร็จ'));
        document.head.appendChild(script);
      }));
    } catch (e) {
      return Swal.fire('Error', 'ไม่สามารถโหลดระบบสร้างโฟลเดอร์ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'error');
    }
  }
  if (typeof JSZip === 'undefined') return Swal.fire('Error', 'ไม่พบระบบสร้างโฟลเดอร์ กรุณาแจ้งผู้ดูแลระบบ', 'error');
  let categoryName = document.getElementById('galleryFilter').value;
  let folderName = categoryName === 'all' ? 'รวมรูปภาพทั้งหมด' : categoryName;
  const folderSuffixMap = {
    general: '',
    bonus: '_BonusTime',
    reach: '_ReachMenu',
    card: '_CardMenu'
  };
  folderName += folderSuffixMap[currentGalleryMode] || '';
  const confirm = await Swal.fire({
    title: `โหลด ${currentGalleryData.length} รูป?`,
    text: `ระบบจะรวบรวมไฟล์ใส่โฟลเดอร์ชื่อ "${folderName}.zip"`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'เริ่มดาวน์โหลด',
    confirmButtonColor: '#2563eb'
  });
  if (confirm.isConfirmed) {
    Swal.fire({
      title: 'กำลังเตรียมไฟล์...',
      text: 'กรุณารอสักครู่ ห้ามปิดหน้าต่างนี้',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    try {
      const zip = new JSZip;
      const imgFolder = zip.folder(folderName);
      let count = 0;
      for (const img of currentGalleryData) {
        try {
          const response = await fetch(img.url);
          const blob = await response.blob();
          const fileName = img.name || `image_${Date.now()}_${count}.jpg`;
          imgFolder.file(fileName, blob);
          count++;
          Swal.update({
            text: `กำลังดึงรูป... (${count}/${currentGalleryData.length})`
          });
        } catch (fetchErr) {
          console.error("ดึงรูปไม่สำเร็จ:", img.url, fetchErr);
        }
      }
      Swal.update({
        text: `กำลังบีบอัดเป็นไฟล์ ZIP...`
      });
      const content = await zip.generateAsync({
        type: "blob"
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      Swal.fire({
        icon: 'success',
        title: 'ดาวน์โหลดเสร็จสิ้น!',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างไฟล์ ZIP ได้', 'error');
    }
  }
};
