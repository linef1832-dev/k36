// ====================================================
// 🎨 เครื่องมือแต่งรูป: ลบโลโก้เดิม → ใส่โลโก้ใหม่
// ====================================================

window.leState = {
    canvas: null,
    ctx: null,
    baseImage: null,
    newLogo: null,
    history: [],
    tool: 'erase',
    isDrawingSelection: false,
    selStart: null,
    selBox: null,
    zoom: 1,              // ผู้ใช้ zoom ด้วยปุ่ม (1 = 100%)
    fitScale: 1,          // อัตราพอดีจอ (คำนวณตอนโหลดรูป)
    logoOverlay: { x: 50, y: 50, w: 120, h: 120, opacity: 1 }
};

// ตัวช่วย: scale รวม = fitScale * zoom
function leTotalScale() {
    return (window.leState.fitScale || 1) * (window.leState.zoom || 1);
}

// 🌟 ตัวช่วยตรวจให้แน่ใจว่า canvas + ctx ถูก setup แล้ว
function leEnsureInit() {
    if (window.leState.canvas && window.leState.ctx) return true;
    const cvs = document.getElementById('leCanvas');
    if (!cvs) {
        console.error('[Logo Editor] หาไม่เจอ #leCanvas');
        return false;
    }
    window.leState.canvas = cvs;
    // ใช้ willReadFrequently เพื่อ fix Canvas2D warning
    window.leState.ctx = cvs.getContext('2d', { willReadFrequently: true });
    leSetupCanvasEvents();
    leSetupLogoOverlayEvents();
    leSetupDragDropFile();
    return true;
}

window.initLogoEditorApp = function() {
    if (!leEnsureInit()) return;
    
    // 🌟 [สิทธิ์]
    const isAdminOrMgr = (currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager'));
    const can = (perm) => isAdminOrMgr || (typeof window.hasUserPerm === 'function' && window.hasUserPerm(perm));
    window.leCanErase    = can('logo_editor_erase');
    window.leCanAddLogo  = can('logo_editor_add_logo');
    window.leCanDownload = can('logo_editor_download');

    const eraseSection    = document.getElementById('leEraseSection');
    const addLogoSection  = document.getElementById('leAddLogoSection');
    const downloadBtn     = document.getElementById('leDownloadBtn');
    if (eraseSection)   eraseSection.style.display    = window.leCanErase    ? '' : 'none';
    if (addLogoSection) addLogoSection.style.display  = window.leCanAddLogo  ? '' : 'none';
    if (downloadBtn)    downloadBtn.style.display     = window.leCanDownload ? '' : 'none';
};

// ==========================================
// 📥 โหลดรูปต้นฉบับ
// ==========================================
window.leLoadBaseImage = function(event) {
    if (!leEnsureInit()) {
        Swal.fire('ผิดพลาด', 'หน้านี้ยังโหลดไม่เสร็จ ลองรีเฟรชหน้าใหม่', 'error');
        return;
    }
    
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    
    if (!file.type || !file.type.startsWith('image/')) {
        Swal.fire('ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพ', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.leState.baseImage = img;
            window.leState.history = [];
            window.leState.newLogo = null;
            window.leState.selBox = null;
            window.leState.zoom = 1;
            
            leRenderBase();
            leRemoveLogo();
            
            const empty = document.getElementById('leEmptyState');
            const wrapper = document.getElementById('leCanvasWrapper');
            const zoomCtl = document.getElementById('leZoomControls');
            if (empty) empty.classList.add('hidden');
            if (wrapper) wrapper.classList.remove('hidden');
            if (zoomCtl) zoomCtl.classList.remove('hidden');
            
            leShowTip('ลากเมาส์ทับโลโก้เพื่อเลือกพื้นที่ลบ', 3500);
        };
        img.onerror = () => Swal.fire('Error', 'โหลดรูปไม่ได้ — ไฟล์อาจเสียหาย', 'error');
        img.src = e.target.result;
    };
    reader.onerror = () => Swal.fire('Error', 'อ่านไฟล์ไม่สำเร็จ', 'error');
    reader.readAsDataURL(file);
    
    if (event.target && event.target.value !== undefined) event.target.value = '';
};

function leRenderBase() {
    const s = window.leState;
    if (!s.baseImage) return;
    
    s.canvas.width = s.baseImage.width;
    s.canvas.height = s.baseImage.height;
    s.ctx.drawImage(s.baseImage, 0, 0);
    leFitCanvasToScreen();
}

// คำนวณอัตราพอดีจอ
function leFitCanvasToScreen() {
    const s = window.leState;
    const area = document.getElementById('leCanvasArea');
    if (!area || !s.baseImage) return;
    
    const maxW = area.clientWidth - 48;
    const maxH = area.clientHeight - 48;
    const imgW = s.canvas.width;
    const imgH = s.canvas.height;
    
    s.fitScale = Math.min(maxW / imgW, maxH / imgH, 1);
    leApplyCanvasScale();
}

// ใส่ขนาดจริงให้ wrapper ตาม scale
function leApplyCanvasScale() {
    const s = window.leState;
    const wrapper = document.getElementById('leCanvasWrapper');
    if (!wrapper || !s.canvas) return;
    
    const totalScale = leTotalScale();
    const w = s.canvas.width * totalScale;
    const h = s.canvas.height * totalScale;
    
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';
    s.canvas.style.width = w + 'px';
    s.canvas.style.height = h + 'px';
    
    // อัปเดต zoom label
    const label = document.getElementById('leZoomLabel');
    if (label) label.innerText = Math.round(totalScale * 100) + '%';
    
    // อัปเดตตำแหน่งโลโก้ overlay
    if (s.newLogo) leUpdateLogoOverlayPosition();
}

// ==========================================
// 🔍 Zoom controls
// ==========================================
window.leZoomIn = function() {
    window.leState.zoom = Math.min(5, window.leState.zoom * 1.25);
    leApplyCanvasScale();
};
window.leZoomOut = function() {
    window.leState.zoom = Math.max(0.2, window.leState.zoom / 1.25);
    leApplyCanvasScale();
};
window.leFitScreen = function() {
    window.leState.zoom = 1;
    leFitCanvasToScreen();
};
window.leZoomReset = function() {
    // แสดงขนาดจริง 100%
    const s = window.leState;
    if (!s.baseImage) return;
    s.zoom = 1 / (s.fitScale || 1);  // ลบเอ็ฟเฟกต์ fit
    leApplyCanvasScale();
};

window.addEventListener('resize', () => { 
    if (window.leState && window.leState.baseImage) {
        window.leState.zoom = 1;
        leFitCanvasToScreen();
    }
});

// แสดง tip ลอย
function leShowTip(text, duration) {
    const bar = document.getElementById('leTipBar');
    const txt = document.getElementById('leTipText');
    if (!bar || !txt) return;
    txt.innerText = text;
    bar.classList.remove('hidden');
    if (duration) {
        clearTimeout(window._leTipTimer);
        window._leTipTimer = setTimeout(() => bar.classList.add('hidden'), duration);
    }
}

// ==========================================
// 🖼️ Drag & Drop ไฟล์ลง canvas area
// ==========================================
function leSetupDragDropFile() {
    const area = document.getElementById('leCanvasArea');
    if (!area || area._dropSetup) return;
    area._dropSetup = true;
    
    area.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        area.classList.add('ring-4', 'ring-fuchsia-400/50'); 
    });
    area.addEventListener('dragleave', () => area.classList.remove('ring-4', 'ring-fuchsia-400/50'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('ring-4', 'ring-fuchsia-400/50');
        if (e.dataTransfer.files.length > 0) leLoadBaseImage(e.dataTransfer.files[0]);
    });
}

// ==========================================
// ✂️ เครื่องมือเลือกพื้นที่ลบโลโก้
// ==========================================
function leSetupCanvasEvents() {
    const cvs = window.leState.canvas;
    if (!cvs || cvs._eventsSetup) return;
    cvs._eventsSetup = true;
    
    const box = document.getElementById('leSelectionBox');
    
    const getCoords = (e) => {
        const rect = cvs.getBoundingClientRect();
        const totalScale = leTotalScale();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (cx - rect.left) / totalScale,
            y: (cy - rect.top) / totalScale,
            screenX: cx - rect.left,
            screenY: cy - rect.top
        };
    };
    
    const startSel = (e) => {
        if (!window.leState.baseImage) return;
        if (window.leCanErase === false) return;
        e.preventDefault();
        const p = getCoords(e);
        window.leState.isDrawingSelection = true;
        window.leState.selStart = p;
        box.style.left = p.screenX + 'px';
        box.style.top = p.screenY + 'px';
        box.style.width = '0px';
        box.style.height = '0px';
        box.classList.remove('hidden');
    };
    
    const moveSel = (e) => {
        if (!window.leState.isDrawingSelection) return;
        e.preventDefault();
        const p = getCoords(e);
        const sx = Math.min(window.leState.selStart.screenX, p.screenX);
        const sy = Math.min(window.leState.selStart.screenY, p.screenY);
        const sw = Math.abs(p.screenX - window.leState.selStart.screenX);
        const sh = Math.abs(p.screenY - window.leState.selStart.screenY);
        box.style.left = sx + 'px';
        box.style.top = sy + 'px';
        box.style.width = sw + 'px';
        box.style.height = sh + 'px';
        
        const totalScale = leTotalScale();
        window.leState.selBox = {
            x: sx / totalScale,
            y: sy / totalScale,
            w: sw / totalScale,
            h: sh / totalScale
        };
    };
    
    const endSel = () => { window.leState.isDrawingSelection = false; };
    
    cvs.addEventListener('mousedown', startSel);
    cvs.addEventListener('mousemove', moveSel);
    window.addEventListener('mouseup', endSel);
    cvs.addEventListener('touchstart', startSel, {passive: false});
    cvs.addEventListener('touchmove', moveSel, {passive: false});
    window.addEventListener('touchend', endSel);
}

// ==========================================
// 🩹 เติมพื้นที่ที่เลือก (ลบโลโก้)
// ==========================================
window.leApplyErase = function() {
    if (window.leCanErase === false) {
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ลบโลโก้เดิม', 'warning');
    }
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    if (!s.selBox || s.selBox.w < 4 || s.selBox.h < 4) {
        return Swal.fire('!', 'ลากกรอบทับโลโก้ก่อน แล้วค่อยกดเติมพื้นที่', 'warning');
    }
    
    s.history.push(s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height));
    if (s.history.length > 20) s.history.shift();
    
    const mode = document.getElementById('leFillMode').value;
    const color = document.getElementById('leFillColor').value;
    const box = s.selBox;
    
    if (mode === 'solid') {
        s.ctx.fillStyle = color;
        s.ctx.fillRect(box.x, box.y, box.w, box.h);
    } else if (mode === 'blur') {
        leApplyBlurFill(box);
    } else {
        leApplyAutoFill(box);
    }
    
    document.getElementById('leSelectionBox').classList.add('hidden');
    s.selBox = null;
};

function leApplyAutoFill(box) {
    const s = window.leState;
    const ctx = s.ctx;
    const samples = [];
    const pad = 5;
    
    const sampleEdge = (sx, sy, w, h) => {
        try {
            const safeSx = Math.max(0, Math.floor(sx));
            const safeSy = Math.max(0, Math.floor(sy));
            const safeW = Math.min(Math.floor(w), s.canvas.width - safeSx);
            const safeH = Math.min(Math.floor(h), s.canvas.height - safeSy);
            if (safeW <= 0 || safeH <= 0) return;
            const d = ctx.getImageData(safeSx, safeSy, safeW, safeH);
            for (let i = 0; i < d.data.length; i += 16) {
                samples.push([d.data[i], d.data[i+1], d.data[i+2]]);
            }
        } catch(e) {}
    };
    
    sampleEdge(box.x - pad, box.y - pad, box.w + pad*2, pad);
    sampleEdge(box.x - pad, box.y + box.h, box.w + pad*2, pad);
    sampleEdge(box.x - pad, box.y, pad, box.h);
    sampleEdge(box.x + box.w, box.y, pad, box.h);
    
    if (samples.length === 0) {
        ctx.fillStyle = '#ffffff';
    } else {
        let r = 0, g = 0, b = 0;
        samples.forEach(s => { r += s[0]; g += s[1]; b += s[2]; });
        r = Math.round(r / samples.length);
        g = Math.round(g / samples.length);
        b = Math.round(b / samples.length);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
    }
    ctx.fillRect(box.x, box.y, box.w, box.h);
    
    try {
        const imgData = ctx.getImageData(box.x, box.y, box.w, box.h);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const n = (Math.random() - 0.5) * 12;
            imgData.data[i]   = Math.max(0, Math.min(255, imgData.data[i] + n));
            imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + n));
            imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + n));
        }
        ctx.putImageData(imgData, box.x, box.y);
    } catch(e) {}
}

function leApplyBlurFill(box) {
    const s = window.leState;
    const ctx = s.ctx;
    leApplyAutoFill(box);
    try {
        const imgData = ctx.getImageData(box.x, box.y, box.w, box.h);
        const blurred = leBoxBlur(imgData, 3);
        ctx.putImageData(blurred, box.x, box.y);
    } catch(e) {}
}

function leBoxBlur(imgData, radius) {
    const w = imgData.width, h = imgData.height;
    const src = imgData.data;
    const out = new Uint8ClampedArray(src.length);
    const r = radius;
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let cr = 0, cg = 0, cb = 0, ca = 0, count = 0;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    const idx = (ny * w + nx) * 4;
                    cr += src[idx]; cg += src[idx+1]; cb += src[idx+2]; ca += src[idx+3];
                    count++;
                }
            }
            const idx = (y * w + x) * 4;
            out[idx] = cr / count;
            out[idx+1] = cg / count;
            out[idx+2] = cb / count;
            out[idx+3] = ca / count;
        }
    }
    return new ImageData(out, w, h);
}

// ==========================================
// 🏷️ ใส่โลโก้ใหม่
// ==========================================
window.leLoadNewLogo = function(event) {
    if (window.leCanAddLogo === false) {
        if (event.target) event.target.value = '';
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใส่โลโก้ใหม่', 'warning');
    }
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    if (!window.leState.baseImage) {
        Swal.fire('!', 'กรุณาเลือกรูปต้นฉบับก่อน', 'warning');
        if (event.target) event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.leState.newLogo = img;
            const baseW = window.leState.baseImage.width;
            const w0 = baseW * 0.15;
            const ratio = img.height / img.width;
            window.leState.logoOverlay = {
                x: baseW * 0.05,
                y: window.leState.baseImage.height * 0.05,
                w: w0, h: w0 * ratio,
                opacity: 1
            };
            
            document.getElementById('leLogoImg').src = e.target.result;
            document.getElementById('leLogoOverlay').classList.remove('hidden');
            document.getElementById('leLogoControls').classList.remove('hidden');
            document.getElementById('leLogoSize').value = 100;
            document.getElementById('leLogoOpacity').value = 100;
            leUpdateLogoOverlayPosition();
            leShowTip('ลากย้ายตำแหน่ง หรือดึงมุมเขียวเพื่อปรับขนาด', 3500);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
};

function leUpdateLogoOverlayPosition() {
    const s = window.leState;
    const overlay = document.getElementById('leLogoOverlay');
    const img = document.getElementById('leLogoImg');
    if (!overlay || !img) return;
    
    const scale = leTotalScale();
    overlay.style.left = (s.logoOverlay.x * scale) + 'px';
    overlay.style.top = (s.logoOverlay.y * scale) + 'px';
    img.style.width = (s.logoOverlay.w * scale) + 'px';
    img.style.height = (s.logoOverlay.h * scale) + 'px';
    img.style.opacity = s.logoOverlay.opacity;
}

window.leUpdateLogoSize = function() {
    const val = parseInt(document.getElementById('leLogoSize').value);
    document.getElementById('leLogoSizeLabel').innerText = val + '%';
    if (!window.leState.newLogo) return;
    const baseW = window.leState.baseImage.width;
    const newW = baseW * 0.15 * (val / 100);
    const ratio = window.leState.newLogo.height / window.leState.newLogo.width;
    window.leState.logoOverlay.w = newW;
    window.leState.logoOverlay.h = newW * ratio;
    leUpdateLogoOverlayPosition();
};

window.leUpdateLogoOpacity = function() {
    const val = parseInt(document.getElementById('leLogoOpacity').value);
    document.getElementById('leLogoOpacityLabel').innerText = val + '%';
    window.leState.logoOverlay.opacity = val / 100;
    leUpdateLogoOverlayPosition();
};

window.leRemoveLogo = function() {
    window.leState.newLogo = null;
    const overlay = document.getElementById('leLogoOverlay');
    const controls = document.getElementById('leLogoControls');
    const img = document.getElementById('leLogoImg');
    if (overlay) overlay.classList.add('hidden');
    if (controls) controls.classList.add('hidden');
    if (img) img.src = '';
};

function leSetupLogoOverlayEvents() {
    const overlay = document.getElementById('leLogoOverlay');
    const handle = document.getElementById('leLogoHandle');
    if (!overlay || overlay._eventsSetup) return;
    overlay._eventsSetup = true;
    
    let isDragging = false, isResizing = false;
    let dragStart = null;
    
    const onDown = (e) => {
        if (e.target === handle) isResizing = true;
        else isDragging = true;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        dragStart = { x: cx, y: cy, lo: { ...window.leState.logoOverlay } };
        e.preventDefault();
        e.stopPropagation();
    };
    
    const onMove = (e) => {
        if (!isDragging && !isResizing) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = cx - dragStart.x;
        const dy = cy - dragStart.y;
        const scale = leTotalScale();
        
        if (isDragging) {
            window.leState.logoOverlay.x = dragStart.lo.x + dx / scale;
            window.leState.logoOverlay.y = dragStart.lo.y + dy / scale;
        } else if (isResizing) {
            const ratio = window.leState.newLogo ? window.leState.newLogo.height / window.leState.newLogo.width : 1;
            const newW = Math.max(10, dragStart.lo.w + dx / scale);
            window.leState.logoOverlay.w = newW;
            window.leState.logoOverlay.h = newW * ratio;
            const baseW = window.leState.baseImage.width;
            const pct = Math.round(newW / (baseW * 0.15) * 100);
            const clamped = Math.min(300, Math.max(10, pct));
            document.getElementById('leLogoSize').value = clamped;
            document.getElementById('leLogoSizeLabel').innerText = clamped + '%';
        }
        
        leUpdateLogoOverlayPosition();
        e.preventDefault();
    };
    
    const onUp = () => { isDragging = false; isResizing = false; };
    
    overlay.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    overlay.addEventListener('touchstart', onDown, {passive: false});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onUp);
}

// ==========================================
// ⏪ Undo + Reset
// ==========================================
window.leUndoLast = function() {
    const s = window.leState;
    if (s.history.length === 0) {
        return Swal.fire('!', 'ไม่มีขั้นตอนให้ย้อนกลับ', 'info');
    }
    const last = s.history.pop();
    s.ctx.putImageData(last, 0, 0);
};

window.leResetAll = async function() {
    const ok = await Swal.fire({
        title: 'เริ่มใหม่ทั้งหมด?',
        text: 'การแก้ไขทั้งหมดจะหายไป',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'ใช่', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
    });
    if (!ok.isConfirmed) return;
    
    const s = window.leState;
    if (s.baseImage) {
        s.history = [];
        leRenderBase();
    }
    leRemoveLogo();
    document.getElementById('leSelectionBox').classList.add('hidden');
    s.selBox = null;
};

// ==========================================
// 💾 ดาวน์โหลด
// ==========================================
window.leDownload = function() {
    if (window.leCanDownload === false) {
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ดาวน์โหลดรูป', 'warning');
    }
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    
    const out = document.createElement('canvas');
    out.width = s.canvas.width;
    out.height = s.canvas.height;
    const octx = out.getContext('2d');
    octx.drawImage(s.canvas, 0, 0);
    
    if (s.newLogo) {
        octx.globalAlpha = s.logoOverlay.opacity;
        octx.drawImage(s.newLogo, s.logoOverlay.x, s.logoOverlay.y, s.logoOverlay.w, s.logoOverlay.h);
        octx.globalAlpha = 1;
    }
    
    out.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดแล้ว', timer: 1200, showConfirmButton: false });
    }, 'image/png');
};
