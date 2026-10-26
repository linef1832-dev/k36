function _galleryCopyFailPopup(err) {
  Swal.fire({
    html: `<div style="padding:12px 8px">\n            <div style="width:52px;height:52px;margin:0 auto 12px;background:rgba(239,68,68,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(239,68,68,0.3)">\n            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>\n            </div>\n            <div style="font-size:16px;font-weight:800;color:var(--k-tx-strong);margin-bottom:6px">คัดลอกไม่สำเร็จ</div>\n            <div style="font-size:11px;color:var(--k-tx3)">${err.message}</div>\n            </div>`,
    backdrop: 'rgba(0,0,0,0.6)',
    showConfirmButton: true,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#dc2626',
    customClass: {
      popup: 'rounded-2xl border border-red-900/40',
      confirmButton: 'rounded-xl font-bold px-5'
    }
  });
}

const _gxPngCache = new Map;

const GX_PNG_MAX = 40;

async function _gxToPng(blob) {
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(bmp.width, bmp.height);
      oc.getContext('2d').drawImage(bmp, 0, 0);
      return await oc.convertToBlob({
        type: 'image/png'
      });
    }
    const cv = document.createElement('canvas');
    cv.width = bmp.width;
    cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return await new Promise(((res, rej) => cv.toBlob((b => b ? res(b) : rej(new Error('แปลงรูปไม่สำเร็จ'))), 'image/png')));
  } finally {
    bmp.close && bmp.close();
  }
}

async function _gxPngViaImg(url) {
  const img = new Image;
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  await new Promise(((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('ไม่สามารถโหลดรูปภาพจากเซิร์ฟเวอร์ได้'));
  }));
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  cv.getContext('2d').drawImage(img, 0, 0);
  return await new Promise(((res, rej) => cv.toBlob((b => b ? res(b) : rej(new Error('แปลงรูปไม่สำเร็จ'))), 'image/png')));
}

window.galleryPrepPng = function(url) {
  if (!url) return Promise.reject(new Error('ไม่มีลิงก์รูป'));
  if (_gxPngCache.has(url)) {
    const p = _gxPngCache.get(url);
    _gxPngCache.delete(url);
    _gxPngCache.set(url, p);
    return p;
  }
  const p = (async () => {
    try {
      const r = await fetch(url, {
        cache: 'force-cache',
        mode: 'cors'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await _gxToPng(await r.blob());
    } catch (e) {
      return await _gxPngViaImg(url);
    }
  })();
  p.catch((() => _gxPngCache.delete(url)));
  _gxPngCache.set(url, p);
  while (_gxPngCache.size > GX_PNG_MAX) _gxPngCache.delete(_gxPngCache.keys().next().value);
  return p;
};

window.galleryWarmPng = function(urls) {
  const list = (urls || []).filter((u => u && !_gxPngCache.has(u))).slice(0, 6);
  if (!list.length) return;
  let i = 0;
  const next = () => {
    if (i >= list.length || document.hidden) return;
    const u = list[i++];
    window.galleryPrepPng(u).catch((() => {})).finally((() => {
      if (window.requestIdleCallback) requestIdleCallback(next, {
        timeout: 1500
      }); else setTimeout(next, 120);
    }));
  };
  if (window.requestIdleCallback) requestIdleCallback(next, {
    timeout: 2e3
  }); else setTimeout(next, 400);
};

if (!window._gxWarmBound) {
  window._gxWarmBound = true;
  const warm = e => {
    const el = e.target && e.target.closest && e.target.closest('#galleryGrid .gx-card');
    if (!el) return;
    const src = el.querySelector('[data-u]');
    if (src && src.dataset.u) window.galleryPrepPng(src.dataset.u).catch((() => {}));
  };
  document.addEventListener('pointerover', warm, {
    passive: true
  });
  document.addEventListener('focusin', warm);
  document.addEventListener('touchstart', warm, {
    passive: true
  });
}

function _gxToast(icon, title, ms) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: icon,
    title: title,
    showConfirmButton: false,
    timer: ms || 1600
  });
}

window.copyImageToClipboard = async function(imageUrl) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    _galleryCopyFailPopup(new Error('เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพโดยตรง (แนะนำให้ใช้ Chrome หรือ Edge)'));
    return;
  }
  if (window._gxCopying === imageUrl) return;
  window._gxCopying = imageUrl;
  const pngP = window.galleryPrepPng(imageUrl);
  let slowTimer = setTimeout((() => _gxToast('info', 'กำลังเตรียมรูป…', 6e3)), 350);
  try {
    let written = false;
    try {
      await navigator.clipboard.write([ new ClipboardItem({
        'image/png': pngP
      }) ]);
      written = true;
    } catch (e1) {
      if (e1 && e1.name === 'NotAllowedError' && !/promise|Promise/.test(String(e1.message))) throw e1;
    }
    if (!written) {
      const blob = await pngP;
      await navigator.clipboard.write([ new ClipboardItem({
        'image/png': blob
      }) ]);
    }
    clearTimeout(slowTimer);
    if (typeof _galleryRipple === 'function') _galleryRipple(imageUrl);
    _gxToast('success', 'คัดลอกรูปแล้ว · กด Ctrl+V วางได้เลย', 1500);
  } catch (err) {
    clearTimeout(slowTimer);
    console.error('Copy image failed:', err);
    let msg = err && err.message || String(err);
    if (err && err.name === 'NotAllowedError') msg = 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก ลองคลิกที่หน้าเว็บก่อน แล้วกดคัดลอกอีกครั้ง';
    _galleryCopyFailPopup(new Error(msg));
  } finally {
    window._gxCopying = null;
  }
};

window.filterGalleryImages = function() {
  clearTimeout(window.gallerySearchTimer);
  window.gallerySearchTimer = setTimeout((() => {
    fetchGalleryImages(true);
  }), 300);
};

let _lbIndex = 0;

let _lbData = [];

const _isAdminGallery = () => canPerm('gallery_rename');

const _lbPreloaded = {};

let _preloadToken = 0;

window.preloadGalleryFulls = async function(list, startIndex = 0) {
  const myToken = ++_preloadToken;
  const arr = (list || []).filter((i => i && i.url));
  const ordered = [];
  for (let d = 0; d < arr.length; d++) {
    const a = (startIndex + d) % arr.length;
    if (!ordered.includes(arr[a].url)) ordered.push(arr[a].url);
    const b = ((startIndex - d) % arr.length + arr.length) % arr.length;
    if (!ordered.includes(arr[b].url)) ordered.push(arr[b].url);
  }
  const urls = ordered.filter((u => !(_lbPreloaded[u] && _lbPreloaded[u].complete && _lbPreloaded[u].naturalWidth)));
  const CONCURRENCY = 3;
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      if (myToken !== _preloadToken) return;
      if (!document.getElementById('lightboxImg')) return;
      const u = urls[i++];
      await new Promise((res => {
        const im = new Image;
        im.onload = () => {
          _lbPreloaded[u] = im;
          res();
        };
        im.onerror = res;
        im.src = u;
      }));
    }
  };
  await Promise.all(Array.from({
    length: CONCURRENCY
  }, worker));
};

window.openLightbox = function(index) {
  _lbData = currentGalleryData;
  _lbIndex = index;
  _updateLightbox();
  document.getElementById('galleryLightbox').classList.remove('hidden');
  document.addEventListener('keydown', _lbKeyHandler);
};

function _updateLightbox() {
  const img = _lbData[_lbIndex];
  if (!img) return;
  if (typeof window.galleryPrepPng === 'function') window.galleryPrepPng(img.url).catch((() => {}));
  const el = document.getElementById('lightboxImg');
  const thumb = img.thumb_url || '';
  const myIdx = _lbIndex;
  const cached = _lbPreloaded[img.url];
  if (cached && cached.complete && cached.naturalWidth) {
    el.style.filter = '';
    el.src = img.url;
    preloadGalleryFulls(_lbData, _lbIndex);
  } else if (thumb && thumb !== img.url) {
    _preloadToken++;
    el.src = thumb;
    el.style.filter = 'blur(6px)';
    el.style.transition = 'filter .25s';
    const full = new Image;
    full.fetchPriority = 'high';
    full.decoding = 'async';
    const _resume = () => preloadGalleryFulls(_lbData, myIdx);
    full.onload = () => {
      _lbPreloaded[img.url] = full;
      _resume();
      if (_lbIndex !== myIdx) return;
      el.src = img.url;
      el.style.filter = '';
    };
    full.onerror = () => {
      _resume();
      if (_lbIndex !== myIdx) return;
      el.src = img.url;
      el.style.filter = '';
    };
    full.src = img.url;
  } else {
    _preloadToken++;
    el.style.filter = '';
    el.src = img.url;
    preloadGalleryFulls(_lbData, _lbIndex);
  }
  const _skipOldSrc = true;
  if (!_skipOldSrc) document.getElementById('lightboxImg').src = img.url;
  document.getElementById('lightboxName').textContent = img.name || '';
  document.getElementById('lightboxCounter').textContent = `${_lbIndex + 1} / ${_lbData.length}`;
  document.getElementById('lightboxDownload').href = img.url;
  document.getElementById('lightboxDownload').download = img.name || 'image';
  const dateEl = document.getElementById('lightboxDate');
  if (dateEl && img.created_at) {
    const d = new Date(img.created_at);
    dateEl.textContent = `📅 ${d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
  const renameBtn = document.getElementById('lightboxRename');
  if (renameBtn) {
    if (_isAdminGallery()) renameBtn.classList.remove('hidden'); else renameBtn.classList.add('hidden');
  }
}

window.moveLightbox = function(dir) {
  _lbIndex = (_lbIndex + dir + _lbData.length) % _lbData.length;
  _updateLightbox();
};

window.closeLightbox = function() {
  document.getElementById('galleryLightbox').classList.add('hidden');
  document.removeEventListener('keydown', _lbKeyHandler);
};

function _lbKeyHandler(e) {
  if (e.key === 'ArrowRight') moveLightbox(1); else if (e.key === 'ArrowLeft') moveLightbox(-1); else if (e.key === 'Escape') closeLightbox();
}

window._copyLightboxUrl = function() {
  const img = _lbData[_lbIndex];
  if (!img) return;
  navigator.clipboard.writeText(img.url).then((() => {
    Swal.fire({
      icon: 'success',
      title: 'Copy URL แล้ว!',
      timer: 1200,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  }));
};

window._renameLightboxImg = async function() {
  const img = _lbData[_lbIndex];
  if (!img) return;
  const {value: newName} = await Swal.fire({
    html: `\n            <div style="padding:8px 4px 4px">\n                <div style="width:48px;height:48px;margin:0 auto 14px;background:rgba(251,191,36,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(251,191,36,0.3)">\n                    <span class="material-icons" style="color:var(--k-amber-tx);font-size:22px">edit</span>\n                </div>\n                <div style="font-size:15px;font-weight:800;color:var(--k-tx-strong);margin-bottom:14px">แก้ชื่อรูป</div>\n                <input id="_renameInput" type="text" maxlength="100" placeholder="ชื่อรูปใหม่..."\n                    style="width:100%;padding:10px 14px;background:color-mix(in srgb,var(--k-tx-strong) 6.0%,transparent);border:1.5px solid color-mix(in srgb,var(--k-tx-strong) 12.0%,transparent);border-radius:10px;color:var(--k-tx-strong);font-size:14px;font-weight:600;outline:none;transition:border 0.2s"\n                    onfocus="this.style.borderColor='rgba(251,191,36,0.6)'"\n                    onblur="this.style.borderColor='rgba(255,255,255,0.12)'"\n                >\n            </div>\n        `,
    background: '#0f172a',
    backdrop: 'rgba(0,0,0,0.7)',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#374151',
    customClass: {
      popup: 'rounded-2xl border border-amber-900/40',
      confirmButton: 'rounded-xl font-bold px-5',
      cancelButton: 'rounded-xl font-bold px-5'
    },
    didOpen: () => {
      const inp = document.getElementById('_renameInput');
      if (inp) {
        inp.value = typeof img !== 'undefined' ? img.name || '' : currentName || '';
        inp.focus();
        inp.select();
      }
    },
    preConfirm: () => {
      const val = document.getElementById('_renameInput')?.value?.trim();
      if (!val) {
        Swal.showValidationMessage('กรุณากรอกชื่อ');
        return false;
      }
      return val;
    }
  });
  if (!newName || newName.trim() === img.name) return;
  try {
    const {error: error} = await appDB.from('image_gallery').update({
      name: newName.trim()
    }).eq('id', img.id);
    if (error) throw error;
    img.name = newName.trim();
    document.getElementById('lightboxName').textContent = img.name;
    Swal.fire({
      html: `<div style="display:flex;align-items:center;gap:10px;padding:4px 2px">\n                <div style="width:28px;height:28px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">\n                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>\n                </div>\n                <span style="font-size:13px;font-weight:700;color:var(--k-tx-strong)">แก้ชื่อสำเร็จ!</span>\n            </div>`,
      background: '#0f172a',
      toast: true,
      position: 'top-end',
      timer: 1500,
      showConfirmButton: false,
      customClass: {
        popup: 'rounded-xl border border-green-900/50 shadow-xl'
      }
    });
    if (window._galleryMarkDirty) window._galleryMarkDirty();
    fetchGalleryImages();
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.initGalleryDragDrop = function() {
  const zone = document.getElementById('galleryDropZone');
  const adminControls = document.getElementById('adminUploadControls');
  if (!zone || !adminControls || adminControls.classList.contains('hidden')) return;
  zone.classList.remove('hidden');
  const galleryApp = document.getElementById('galleryApp');
  if (!galleryApp) return;
  galleryApp.addEventListener('dragover', (e => {
    e.preventDefault();
    zone.classList.add('gx-drag');
  }));
  galleryApp.addEventListener('dragleave', (e => {
    if (!galleryApp.contains(e.relatedTarget)) {
      zone.classList.remove('gx-drag');
    }
  }));
  galleryApp.addEventListener('drop', (async e => {
    e.preventDefault();
    zone.classList.remove('gx-drag');
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const fakeInput = {
      files: files
    };
    await window.handleImageUpload(fakeInput);
  }));
};

function _renderWebBadges(data) {
  const badgeEl = document.getElementById('galleryWebBadges');
  if (!badgeEl) return;
  const counts = {};
  data.forEach((img => {
    const cat = img.category || 'ทั่วไป';
    const webName = cat.replace(/_BONUS|_REACH|_CARD|_LOGO/g, '') || 'ทั่วไป';
    counts[webName] = (counts[webName] || 0) + 1;
  }));
  const sorted = Object.entries(counts).sort(((a, b) => b[1] - a[1]));
  const currentFilter = document.getElementById('galleryFilter')?.value || 'all';
  badgeEl.innerHTML = sorted.map((([web, count]) => {
    const isActive = currentFilter === web;
    const activeClass = isActive ? 'bg-pink-600 text-white border-pink-400' : 'bg-slate-700 text-gray-300 border-slate-600 hover:bg-pink-700 hover:text-white';
    return `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${activeClass} border cursor-pointer transition"\n              onclick="document.getElementById('galleryFilter').value='${web}'; fetchGalleryImages()">\n            ${web} <span class="${isActive ? 'text-pink-200' : 'text-pink-400'}">${count}</span>\n        </span>`;
  })).join('');
}

window.renameGalleryImage = async function(imgId, currentName) {
  const isAdminG = canPerm('gallery_rename');
  if (!isAdminG) return;
  const {value: newName} = await Swal.fire({
    html: `\n            <div style="padding:8px 4px 4px">\n                <div style="width:48px;height:48px;margin:0 auto 14px;background:rgba(251,191,36,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(251,191,36,0.3)">\n                    <span class="material-icons" style="color:var(--k-amber-tx);font-size:22px">edit</span>\n                </div>\n                <div style="font-size:15px;font-weight:800;color:var(--k-tx-strong);margin-bottom:14px">แก้ชื่อรูป</div>\n                <input id="_renameInput" type="text" maxlength="100" placeholder="ชื่อรูปใหม่..."\n                    style="width:100%;padding:10px 14px;background:color-mix(in srgb,var(--k-tx-strong) 6.0%,transparent);border:1.5px solid color-mix(in srgb,var(--k-tx-strong) 12.0%,transparent);border-radius:10px;color:var(--k-tx-strong);font-size:14px;font-weight:600;outline:none;transition:border 0.2s"\n                    onfocus="this.style.borderColor='rgba(251,191,36,0.6)'"\n                    onblur="this.style.borderColor='rgba(255,255,255,0.12)'"\n                >\n            </div>\n        `,
    background: '#0f172a',
    backdrop: 'rgba(0,0,0,0.7)',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#374151',
    customClass: {
      popup: 'rounded-2xl border border-amber-900/40',
      confirmButton: 'rounded-xl font-bold px-5',
      cancelButton: 'rounded-xl font-bold px-5'
    },
    didOpen: () => {
      const inp = document.getElementById('_renameInput');
      if (inp) {
        inp.value = typeof img !== 'undefined' ? img.name || '' : currentName || '';
        inp.focus();
        inp.select();
      }
    },
    preConfirm: () => {
      const val = document.getElementById('_renameInput')?.value?.trim();
      if (!val) {
        Swal.showValidationMessage('กรุณากรอกชื่อ');
        return false;
      }
      return val;
    }
  });
  if (!newName || newName.trim() === currentName) return;
  try {
    const {error: error} = await appDB.from('image_gallery').update({
      name: newName.trim()
    }).eq('id', imgId);
    if (error) throw error;
    const idx = currentGalleryData.findIndex((d => String(d.id) === String(imgId)));
    if (idx !== -1) currentGalleryData[idx].name = newName.trim();
    Swal.fire({
      html: `<div style="display:flex;align-items:center;gap:10px;padding:4px 2px">\n                <div style="width:28px;height:28px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">\n                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>\n                </div>\n                <span style="font-size:13px;font-weight:700;color:var(--k-tx-strong)">แก้ชื่อสำเร็จ!</span>\n            </div>`,
      background: '#0f172a',
      toast: true,
      position: 'top-end',
      timer: 1500,
      showConfirmButton: false,
      customClass: {
        popup: 'rounded-xl border border-green-900/50 shadow-xl'
      }
    });
    if (window._galleryMarkDirty) window._galleryMarkDirty();
    fetchGalleryImages();
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

function _galleryRipple(imageUrl) {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.gx-card');
  cards.forEach((btn => {
    const src = btn.querySelector('[data-u]');
    if (!src || src.dataset.u !== imageUrl) return;
    const ripple = document.createElement('div');
    ripple.style.cssText = `\n            position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:40;\n            background:radial-gradient(circle at center,rgba(34,197,94,0.35),rgba(34,197,94,0.08) 60%,transparent 80%);\n            animation:_gRipple 0.7s ease-out forwards;\n        `;
    btn.style.position = 'relative';
    btn.appendChild(ripple);
    const badge = document.createElement('div');
    badge.style.cssText = `\n            position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);\n            background:rgba(34,197,94,0.95);color:#fff;font-size:12px;font-weight:800;\n            padding:6px 14px;border-radius:20px;z-index:41;pointer-events:none;\n            box-shadow:0 4px 15px rgba(34,197,94,0.4);\n            animation:_gBadge 0.7s ease-out forwards;\n        `;
    badge.textContent = '✓ คัดลอกแล้ว';
    btn.appendChild(badge);
    setTimeout((() => {
      ripple.remove();
      badge.remove();
    }), 700);
  }));
}

(function() {
  if (document.getElementById('_galleryStyles')) return;
  const s = document.createElement('style');
  s.id = '_galleryStyles';
  s.textContent = `\n        @keyframes _gRipple{0%{opacity:1;transform:scale(0.8)}100%{opacity:0;transform:scale(1.05)}}\n        @keyframes _gBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(0.7)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(0.9)}}\n        @keyframes _gSkeleton{0%,100%{opacity:0.5}50%{opacity:1}}\n        ._gallery-ctx-menu{position:fixed;z-index:9999;background:var(--k-card);border:1px solid color-mix(in srgb,var(--k-tx-strong) 10.0%,transparent);border-radius:12px;padding:4px;box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05);min-width:180px;animation:_gBadge2 0.15s ease-out}\n        @keyframes _gBadge2{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}\n        ._gallery-ctx-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:var(--k-tx);transition:background 0.15s}\n        ._gallery-ctx-item:hover{background:color-mix(in srgb,var(--k-tx-strong) 8.0%,transparent)}\n        ._gallery-ctx-item .material-icons{font-size:16px;opacity:0.7}\n        ._gallery-ctx-sep{height:1px;background:color-mix(in srgb,var(--k-tx-strong) 7.0%,transparent);margin:3px 0}\n    `;
  document.head.appendChild(s);
})();

(function setupGalleryContextMenu() {
  let _ctxMenu = null;
  function removeCtx() {
    if (_ctxMenu) {
      _ctxMenu.remove();
      _ctxMenu = null;
    }
  }
  document.addEventListener('click', removeCtx);
  document.addEventListener('contextmenu', (e => {
    removeCtx();
    const card = e.target.closest('#galleryGrid .gx-card');
    if (!card) return;
    const src = card.querySelector('[data-u]');
    const nameEl = card.querySelector('.gx-card-name');
    if (!src) return;
    e.preventDefault();
    const url = src.dataset.u;
    const name = nameEl ? nameEl.textContent.trim() : 'image';
    const menu = document.createElement('div');
    menu.className = '_gallery-ctx-menu';
    menu.innerHTML = `\n            <div class="_gallery-ctx-item" id="_ctxCopy"><span class="material-icons">content_copy</span> คัดลอกรูป</div>\n            <div class="_gallery-ctx-item" id="_ctxDl"><span class="material-icons">download</span> ดาวน์โหลด</div>\n            <div class="_gallery-ctx-sep"></div>\n            <div class="_gallery-ctx-item" id="_ctxOpen"><span class="material-icons">open_in_new</span> เปิดในแท็บใหม่</div>\n            <div class="_gallery-ctx-item" id="_ctxUrl"><span class="material-icons">link</span> Copy URL</div>\n        `;
    const mx = Math.min(e.clientX, window.innerWidth - 200);
    const my = Math.min(e.clientY, window.innerHeight - 180);
    menu.style.left = mx + 'px';
    menu.style.top = my + 'px';
    document.body.appendChild(menu);
    _ctxMenu = menu;
    menu.querySelector('#_ctxCopy').onclick = ev => {
      ev.stopPropagation();
      removeCtx();
      copyImageToClipboard(url);
    };
    menu.querySelector('#_ctxDl').onclick = ev => {
      ev.stopPropagation();
      removeCtx();
      downloadGalleryUrl(url, name);
    };
    menu.querySelector('#_ctxOpen').onclick = ev => {
      ev.stopPropagation();
      removeCtx();
      window.open(url, '_blank');
    };
    menu.querySelector('#_ctxUrl').onclick = ev => {
      ev.stopPropagation();
      removeCtx();
      navigator.clipboard.writeText(url).then((() => Swal.fire({
        icon: 'success',
        title: 'Copy URL แล้ว!',
        timer: 1200,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      })));
    };
  }));
})();

(function setupGalleryImageSkeleton() {
  const observer = new MutationObserver((() => {
    document.querySelectorAll('#galleryGrid img:not([data-sk])').forEach((img => {
      img.setAttribute('data-sk', '1');
      const wrap = img.parentElement;
      if (!wrap) return;
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.4s ease';
      wrap.style.background = 'linear-gradient(90deg,#1e293b 25%,#273449 50%,#1e293b 75%)';
      wrap.style.backgroundSize = '200% 100%';
      wrap.style.animation = '_gSkeleton 1.5s ease-in-out infinite';
      img.onload = () => {
        img.style.opacity = '1';
        wrap.style.background = '';
        wrap.style.animation = '';
      };
    }));
  }));
  const grid = document.getElementById('galleryGrid');
  if (grid) observer.observe(grid, {
    childList: true,
    subtree: true
  });
})();
