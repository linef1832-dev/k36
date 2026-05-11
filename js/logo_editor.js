// ====================================================
// 🎨 เครื่องมือแต่งรูป v4 - Smart Replace
// โหมดเร็ว: โหลดโลโก้ใหม่ก่อน → ลากคลุมโลโก้เก่า → ลบ + วางทันที
// ====================================================

window.leState = {
    canvas: null,
    ctx: null,
    baseImage: null,
    newLogo: null,
    pendingLogo: null,     // โลโก้ที่เลือกไว้ใน "โหมดเร็ว" (ยังไม่วาง)
    history: [],
    mode: 'magic',         // 'magic' = คลุมแล้วเสร็จ | 'manual' = แยกขั้น
    shape: 'rect',
    isDrawingSelection: false,
    selStart: null,
    lassoPoints: [],
    selBox: null,
    zoom: 1,
    logoOverlay: { x: 50, y: 50, w: 120, h: 120, opacity: 1 }
};

function leTotalScale() { return window.leState.zoom || 1; }

function leEnsureInit() {
    if (window.leState.canvas && window.leState.ctx) return true;
    const cvs = document.getElementById('leCanvas');
    if (!cvs) { console.error('[Logo Editor] #leCanvas not found'); return false; }
    window.leState.canvas = cvs;
    window.leState.ctx = cvs.getContext('2d', { willReadFrequently: true });
    leSetupCanvasEvents();
    leSetupLogoOverlayEvents();
    leSetupDragDropFile();
    leSetMode('magic'); // ตั้ง mode เริ่มต้น
    return true;
}

window.initLogoEditorApp = function() {
    if (!leEnsureInit()) return;
    
    const isAdminOrMgr = (typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager'));
    const can = (perm) => isAdminOrMgr || (typeof window.hasUserPerm === 'function' && window.hasUserPerm(perm));
    window.leCanErase    = can('logo_editor_erase');
    window.leCanAddLogo  = can('logo_editor_add_logo');
    window.leCanDownload = can('logo_editor_download');

    const eraseSection = document.getElementById('leEraseSection');
    const addLogoSection = document.getElementById('leAddLogoSection');
    const downloadBtn = document.getElementById('leDownloadBtn');
    if (eraseSection) eraseSection.style.display = window.leCanErase ? '' : 'none';
    if (addLogoSection) addLogoSection.style.display = window.leCanAddLogo ? '' : 'none';
    if (downloadBtn) downloadBtn.style.display = window.leCanDownload ? '' : 'none';
};

// ==========================================
// 🎯 Mode Toggle - ⚡ คลุมแล้วเสร็จ vs แยกขั้นตอน
// ==========================================
window.leSetMode = function(mode) {
    window.leState.mode = mode;
    const magicTab = document.getElementById('leModeMagic');
    const manualTab = document.getElementById('leModeManual');
    const hint = document.getElementById('leModeHint');
    const eraseSection = document.getElementById('leEraseSection');
    const logoBtnText = document.getElementById('leLogoBtnText');
    
    if (mode === 'magic') {
        magicTab?.classList.add('active');
        manualTab?.classList.remove('active');
        if (hint) hint.innerHTML = '⚡ <b>โหมดเร็ว:</b> โหลดโลโก้ใหม่ก่อน → ลากคลุมโลโก้เก่า → ระบบลบ + วางทันที';
        if (eraseSection) eraseSection.style.display = window.leCanErase ? '' : 'none';
        if (logoBtnText) logoBtnText.innerText = 'เลือกโลโก้ใหม่ (วางอัตโนมัติ)';
    } else {
        magicTab?.classList.remove('active');
        manualTab?.classList.add('active');
        if (hint) hint.innerHTML = '🔧 <b>โหมดแยกขั้น:</b> ลบโลโก้ → แล้วเพิ่มโลโก้ใหม่ทีหลัง ปรับขนาด/ตำแหน่งเองได้';
        if (eraseSection) eraseSection.style.display = window.leCanErase ? '' : 'none';
        if (logoBtnText) logoBtnText.innerText = 'เลือกโลโก้ใหม่';
    }
};

// ==========================================
// 📥 โหลดรูปต้นฉบับ
// ==========================================
window.leLoadBaseImage = function(event) {
    if (!leEnsureInit()) return;
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
            window.leState.lassoPoints = [];
            leRenderBase();
            leFitScreen();
            leRemoveLogo();
            
            document.getElementById('leEmptyState')?.classList.add('hidden');
            document.getElementById('leCanvasWrapper')?.classList.remove('hidden');
            document.getElementById('leZoomControls')?.classList.remove('hidden');
            
            if (window.leState.mode === 'magic' && window.leState.pendingLogo) {
                leShowTip('⚡ ลากคลุมโลโก้เก่า — โลโก้ใหม่จะวางลงทันที', 4000);
            } else if (window.leState.mode === 'magic') {
                leShowTip('💡 เลือกโลโก้ใหม่ก่อน แล้วค่อยลากคลุมโลโก้เก่า', 4000);
            } else {
                leShowTip('ลากเมาส์ทับโลโก้บนรูป — ปล่อยเมาส์จะลบทันที', 3500);
            }
        };
        img.onerror = () => Swal.fire('Error', 'โหลดรูปไม่ได้', 'error');
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    if (event.target && event.target.value !== undefined) event.target.value = '';
};

function leRenderBase() {
    const s = window.leState;
    if (!s.baseImage) return;
    s.canvas.width = s.baseImage.width;
    s.canvas.height = s.baseImage.height;
    s.ctx.drawImage(s.baseImage, 0, 0);
}

function leApplyCanvasScale() {
    const s = window.leState;
    const wrapper = document.getElementById('leCanvasWrapper');
    if (!wrapper || !s.canvas) return;
    const scale = leTotalScale();
    const w = s.canvas.width * scale;
    const h = s.canvas.height * scale;
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';
    s.canvas.style.width = w + 'px';
    s.canvas.style.height = h + 'px';
    const svg = document.getElementById('leSelectionSvg');
    if (svg) {
        svg.setAttribute('viewBox', `0 0 ${s.canvas.width} ${s.canvas.height}`);
        svg.style.width = w + 'px';
        svg.style.height = h + 'px';
    }
    const label = document.getElementById('leZoomLabel');
    if (label) label.innerText = Math.round(scale * 100) + '%';
    if (s.newLogo) leUpdateLogoOverlayPosition();
}

window.leZoomIn = function() {
    window.leState.zoom = Math.min(5, window.leState.zoom * 1.25);
    leApplyCanvasScale();
};
window.leZoomOut = function() {
    window.leState.zoom = Math.max(0.1, window.leState.zoom / 1.25);
    leApplyCanvasScale();
};
window.leFitScreen = function() {
    const s = window.leState;
    if (!s.baseImage) return;
    const area = document.getElementById('leCanvasArea');
    if (!area) return;
    const maxW = area.clientWidth - 48;
    const maxH = area.clientHeight - 48;
    s.zoom = Math.min(maxW / s.canvas.width, maxH / s.canvas.height, 1);
    if (s.zoom < 0.1) s.zoom = 0.1;
    leApplyCanvasScale();
};

window.addEventListener('resize', () => { 
    if (window.leState && window.leState.baseImage) leApplyCanvasScale();
});

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

window.leSetShape = function(shape) {
    window.leState.shape = shape;
    ['rect','ellipse','circle','lasso'].forEach(name => {
        const el = document.getElementById('leShape' + name.charAt(0).toUpperCase() + name.slice(1));
        if (el) {
            if (name === shape) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
};

function leSetupDragDropFile() {
    const area = document.getElementById('leCanvasArea');
    if (!area || area._dropSetup) return;
    area._dropSetup = true;
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('ring-4', 'ring-fuchsia-400/50'); });
    area.addEventListener('dragleave', () => area.classList.remove('ring-4', 'ring-fuchsia-400/50'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('ring-4', 'ring-fuchsia-400/50');
        if (e.dataTransfer.files.length > 0) leLoadBaseImage(e.dataTransfer.files[0]);
    });
}

// ==========================================
// ✂️ Selection — เติมอัตโนมัติ + วางโลโก้ใหม่อัตโนมัติ (magic mode)
// ==========================================
function leSetupCanvasEvents() {
    const cvs = window.leState.canvas;
    if (!cvs || cvs._eventsSetup) return;
    cvs._eventsSetup = true;
    const svg = document.getElementById('leSelectionSvg');
    
    const getCoords = (e) => {
        const rect = cvs.getBoundingClientRect();
        const scale = leTotalScale();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale };
    };
    
    const startSel = (e) => {
        if (!window.leState.baseImage) return;
        if (window.leCanErase === false) return;
        e.preventDefault();
        const p = getCoords(e);
        window.leState.isDrawingSelection = true;
        window.leState.selStart = p;
        window.leState.lassoPoints = [p];
        svg.classList.remove('hidden');
        leDrawSelectionShape(p, p);
    };
    
    const moveSel = (e) => {
        if (!window.leState.isDrawingSelection) return;
        e.preventDefault();
        const p = getCoords(e);
        if (window.leState.shape === 'lasso') {
            window.leState.lassoPoints.push(p);
            leDrawLassoPath(window.leState.lassoPoints);
        } else {
            leDrawSelectionShape(window.leState.selStart, p);
        }
    };
    
    const endSel = async (e) => {
        if (!window.leState.isDrawingSelection) return;
        window.leState.isDrawingSelection = false;
        
        const sel = window.leState.selBox;
        const hasValid = sel && ((sel.type === 'rect' && sel.w >= 4 && sel.h >= 4) ||
                                  (sel.type === 'ellipse' && sel.rx >= 2 && sel.ry >= 2) ||
                                  (sel.type === 'lasso' && sel.points && sel.points.length >= 5));
        
        if (hasValid) {
            // เก็บ bbox ก่อน — จะใช้วางโลโก้
            const bbox = leGetBBox(sel);
            
            // ลบ (เติมพื้นที่)
            await leApplyErase();
            
            // 🌟 โหมด magic + มีโลโก้รออยู่ → วางอัตโนมัติ
            if (window.leState.mode === 'magic' && window.leState.pendingLogo) {
                leAutoPlaceLogo(bbox);
            }
        }
        
        svg.classList.add('hidden');
        svg.innerHTML = '';
        window.leState.selBox = null;
        window.leState.lassoPoints = [];
    };
    
    cvs.addEventListener('mousedown', startSel);
    cvs.addEventListener('mousemove', moveSel);
    window.addEventListener('mouseup', endSel);
    cvs.addEventListener('touchstart', startSel, {passive: false});
    cvs.addEventListener('touchmove', moveSel, {passive: false});
    window.addEventListener('touchend', endSel);
}

function leDrawSelectionShape(start, end) {
    const svg = document.getElementById('leSelectionSvg');
    if (!svg) return;
    const x1 = Math.min(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    const shape = window.leState.shape;
    
    if (shape === 'rect') {
        svg.innerHTML = `<rect x="${x1}" y="${y1}" width="${w}" height="${h}"/>`;
        window.leState.selBox = { type: 'rect', x: x1, y: y1, w: w, h: h };
    } else if (shape === 'ellipse') {
        svg.innerHTML = `<ellipse cx="${x1 + w/2}" cy="${y1 + h/2}" rx="${w/2}" ry="${h/2}"/>`;
        window.leState.selBox = { type: 'ellipse', cx: x1 + w/2, cy: y1 + h/2, rx: w/2, ry: h/2 };
    } else if (shape === 'circle') {
        const r = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        svg.innerHTML = `<ellipse cx="${start.x}" cy="${start.y}" rx="${r}" ry="${r}"/>`;
        window.leState.selBox = { type: 'ellipse', cx: start.x, cy: start.y, rx: r, ry: r };
    }
}

function leDrawLassoPath(points) {
    const svg = document.getElementById('leSelectionSvg');
    if (!svg || points.length < 2) return;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    d += ' Z';
    svg.innerHTML = `<path d="${d}"/>`;
    window.leState.selBox = { type: 'lasso', points: [...points] };
}

// ==========================================
// 🩹 เติมพื้นที่
// ==========================================
window.leApplyErase = async function() {
    if (window.leCanErase === false) return;
    const s = window.leState;
    const sel = s.selBox;
    if (!sel) return;
    
    if (sel.type === 'rect' && (sel.w < 4 || sel.h < 4)) return;
    if (sel.type === 'ellipse' && (sel.rx < 2 || sel.ry < 2)) return;
    if (sel.type === 'lasso' && sel.points.length < 5) return;
    
    s.history.push(s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height));
    if (s.history.length > 20) s.history.shift();
    
    const mode = document.getElementById('leFillMode').value;
    const color = document.getElementById('leFillColor').value;
    const bbox = leGetBBox(sel);
    
    let fillStyle;
    if (mode === 'solid') fillStyle = color;
    else fillStyle = leComputeAvgEdgeColor(bbox);
    
    s.ctx.save();
    leClipToShape(s.ctx, sel);
    s.ctx.fillStyle = fillStyle;
    s.ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
    
    if (mode === 'blur' || mode === 'auto') {
        try {
            const imgData = s.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
            if (mode === 'blur') {
                const blurred = leBoxBlur(imgData, 3);
                s.ctx.putImageData(blurred, bbox.x, bbox.y);
            } else {
                for (let i = 0; i < imgData.data.length; i += 4) {
                    const n = (Math.random() - 0.5) * 12;
                    imgData.data[i]   = Math.max(0, Math.min(255, imgData.data[i] + n));
                    imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + n));
                    imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + n));
                }
                s.ctx.putImageData(imgData, bbox.x, bbox.y);
            }
        } catch(e) {}
    }
    s.ctx.restore();
};

function leGetBBox(sel) {
    if (sel.type === 'rect') return { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
    if (sel.type === 'ellipse') return {
        x: sel.cx - sel.rx, y: sel.cy - sel.ry, w: sel.rx * 2, h: sel.ry * 2
    };
    if (sel.type === 'lasso') {
        let xs = sel.points.map(p => p.x), ys = sel.points.map(p => p.y);
        const x1 = Math.min(...xs), y1 = Math.min(...ys);
        const x2 = Math.max(...xs), y2 = Math.max(...ys);
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
}

function leClipToShape(ctx, sel) {
    ctx.beginPath();
    if (sel.type === 'rect') ctx.rect(sel.x, sel.y, sel.w, sel.h);
    else if (sel.type === 'ellipse') ctx.ellipse(sel.cx, sel.cy, sel.rx, sel.ry, 0, 0, Math.PI * 2);
    else if (sel.type === 'lasso') {
        ctx.moveTo(sel.points[0].x, sel.points[0].y);
        for (let i = 1; i < sel.points.length; i++) ctx.lineTo(sel.points[i].x, sel.points[i].y);
        ctx.closePath();
    }
    ctx.clip();
}

function leComputeAvgEdgeColor(bbox) {
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
            for (let i = 0; i < d.data.length; i += 16) samples.push([d.data[i], d.data[i+1], d.data[i+2]]);
        } catch(e) {}
    };
    sampleEdge(bbox.x - pad, bbox.y - pad, bbox.w + pad*2, pad);
    sampleEdge(bbox.x - pad, bbox.y + bbox.h, bbox.w + pad*2, pad);
    sampleEdge(bbox.x - pad, bbox.y, pad, bbox.h);
    sampleEdge(bbox.x + bbox.w, bbox.y, pad, bbox.h);
    if (samples.length === 0) return '#ffffff';
    let r = 0, g = 0, b = 0;
    samples.forEach(s => { r += s[0]; g += s[1]; b += s[2]; });
    return `rgb(${Math.round(r/samples.length)},${Math.round(g/samples.length)},${Math.round(b/samples.length)})`;
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
            out[idx] = cr / count; out[idx+1] = cg / count;
            out[idx+2] = cb / count; out[idx+3] = ca / count;
        }
    }
    return new ImageData(out, w, h);
}

// ==========================================
// 🪄 วางโลโก้ใหม่อัตโนมัติให้พอดี bounding box
// ==========================================
function leAutoPlaceLogo(bbox) {
    const s = window.leState;
    const logo = s.pendingLogo;
    if (!logo || !bbox) return;
    
    // ใช้โลโก้ใน pendingLogo เป็น newLogo
    s.newLogo = logo;
    
    // คำนวณขนาดให้ fit ใน bbox โดยรักษาอัตราส่วน
    const logoRatio = logo.height / logo.width;
    const bboxRatio = bbox.h / bbox.w;
    
    let w, h;
    if (logoRatio > bboxRatio) {
        // โลโก้สูงกว่ากรอบ → ใช้ความสูงเป็นหลัก
        h = bbox.h;
        w = h / logoRatio;
    } else {
        // โลโก้กว้างกว่ากรอบ → ใช้ความกว้างเป็นหลัก
        w = bbox.w;
        h = w * logoRatio;
    }
    
    // วางตรงกลาง bbox
    s.logoOverlay = {
        x: bbox.x + (bbox.w - w) / 2,
        y: bbox.y + (bbox.h - h) / 2,
        w: w, h: h, opacity: 1
    };
    
    // แสดง overlay
    const overlay = document.getElementById('leLogoOverlay');
    const img = document.getElementById('leLogoImg');
    const controls = document.getElementById('leLogoControls');
    
    img.src = logo.src;
    overlay.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');
    document.getElementById('leLogoSize').value = 100;
    document.getElementById('leLogoOpacity').value = 100;
    leUpdateLogoOverlayPosition();
    
    // คำนวณ % เริ่มต้นให้ slider sync กับขนาดที่วาง
    const baseW = s.baseImage.width;
    const startPct = Math.round(w / (baseW * 0.15) * 100);
    const clamped = Math.min(300, Math.max(10, startPct));
    document.getElementById('leLogoSize').value = clamped;
    document.getElementById('leLogoSizeLabel').innerText = clamped + '%';
    
    leShowTip('⚡ วางโลโก้ใหม่เรียบร้อย! ลากย้าย/ปรับขนาดได้', 3000);
}

// ==========================================
// 🏷️ โหลดโลโก้ใหม่
// ==========================================
window.leLoadNewLogo = function(event) {
    if (window.leCanAddLogo === false) {
        if (event.target) event.target.value = '';
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใส่โลโก้ใหม่', 'warning');
    }
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
            // 🌟 [Auto-remove background] ตรวจ + ลบพื้นหลังโลโก้ก่อนใช้
            const removeBg = document.getElementById('leAutoRemoveBg');
            const shouldRemove = !removeBg || removeBg.checked; // default = true
            
            let finalImg = img;
            if (shouldRemove) {
                try {
                    finalImg = await leRemoveBgFromLogo(img);
                } catch (e) {
                    console.warn('Remove bg failed:', e);
                    finalImg = img;
                }
            }
            
            if (window.leState.mode === 'magic') {
                window.leState.pendingLogo = finalImg;
                const preview = document.getElementById('leLogoPreview');
                const previewImg = document.getElementById('leLogoPreviewImg');
                const badge = document.getElementById('leLogoReadyBadge');
                if (previewImg) previewImg.src = finalImg.src;
                if (preview) preview.classList.remove('hidden');
                if (badge) badge.classList.remove('hidden');
                
                if (window.leState.baseImage) {
                    leShowTip('⚡ พร้อมแล้ว! ลากคลุมโลโก้เก่าได้เลย', 3500);
                } else {
                    leShowTip('💡 ตอนนี้เลือกรูปต้นฉบับก่อน', 3500);
                }
            } else {
                if (!window.leState.baseImage) {
                    Swal.fire('!', 'กรุณาเลือกรูปต้นฉบับก่อน', 'warning');
                    if (event.target) event.target.value = '';
                    return;
                }
                window.leState.newLogo = finalImg;
                const baseW = window.leState.baseImage.width;
                const w0 = baseW * 0.15;
                const ratio = finalImg.height / finalImg.width;
                window.leState.logoOverlay = {
                    x: baseW * 0.05,
                    y: window.leState.baseImage.height * 0.05,
                    w: w0, h: w0 * ratio, opacity: 1
                };
                document.getElementById('leLogoImg').src = finalImg.src;
                document.getElementById('leLogoOverlay').classList.remove('hidden');
                document.getElementById('leLogoControls').classList.remove('hidden');
                document.getElementById('leLogoSize').value = 100;
                document.getElementById('leLogoOpacity').value = 100;
                leUpdateLogoOverlayPosition();
                leShowTip('ลากย้ายตำแหน่ง หรือดึงมุมเขียวเพื่อปรับขนาด', 3500);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
};

// ==========================================
// 🪄 ลบพื้นหลังโลโก้อัตโนมัติ (ตรวจสีมุม → ทำให้โปร่งใส)
// ==========================================
async function leRemoveBgFromLogo(img) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const w = canvas.width, h = canvas.height;
            
            // 1. หาสีพื้นหลังจาก 4 มุม (เฉลี่ย)
            const corners = [
                [0, 0], [w-1, 0], [0, h-1], [w-1, h-1],
                [Math.floor(w/4), 0], [Math.floor(w*3/4), 0],
                [0, Math.floor(h/4)], [0, Math.floor(h*3/4)]
            ];
            let bgR = 0, bgG = 0, bgB = 0;
            corners.forEach(([x, y]) => {
                const idx = (y * w + x) * 4;
                bgR += data[idx];
                bgG += data[idx+1];
                bgB += data[idx+2];
            });
            bgR = Math.round(bgR / corners.length);
            bgG = Math.round(bgG / corners.length);
            bgB = Math.round(bgB / corners.length);
            
            // 2. ถ้าสีมุมไม่สอดคล้องกัน (variance สูง) = โลโก้นี้พื้นหลังโปร่งใสอยู่แล้ว ไม่ต้องทำ
            let variance = 0;
            corners.forEach(([x, y]) => {
                const idx = (y * w + x) * 4;
                variance += Math.abs(data[idx] - bgR) + Math.abs(data[idx+1] - bgG) + Math.abs(data[idx+2] - bgB);
            });
            variance = variance / corners.length;
            
            if (variance > 50) {
                // สีมุมไม่เป็นพื้นเดียวกัน → คืนรูปเดิม
                return resolve(img);
            }
            
            // 3. ลบ pixel ที่ใกล้เคียงสีพื้นหลัง (threshold 60)
            const threshold = 60;
            for (let i = 0; i < data.length; i += 4) {
                const dr = data[i] - bgR;
                const dg = data[i+1] - bgG;
                const db = data[i+2] - bgB;
                const dist = Math.sqrt(dr*dr + dg*dg + db*db);
                if (dist < threshold) {
                    // ลด alpha ตามระยะ (ทำขอบนุ่ม)
                    data[i+3] = Math.round((dist / threshold) * 255);
                }
            }
            
            ctx.putImageData(imgData, 0, 0);
            
            // 4. สร้าง Image object ใหม่จาก canvas
            const newImg = new Image();
            newImg.onload = () => resolve(newImg);
            newImg.onerror = reject;
            newImg.src = canvas.toDataURL('image/png');
        } catch (e) {
            reject(e);
        }
    });
}

window.leClearPendingLogo = function() {
    window.leState.pendingLogo = null;
    document.getElementById('leLogoPreview')?.classList.add('hidden');
    document.getElementById('leLogoReadyBadge')?.classList.add('hidden');
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
    // ใช้ขนาดปัจจุบันเป็น 100% เพื่อรองรับการ scale หลังวางอัตโนมัติ
    const currentW = window.leState.logoOverlay.w;
    const ratio = window.leState.newLogo.height / window.leState.newLogo.width;
    const newW = baseW * 0.15 * (val / 100);
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
    document.getElementById('leLogoOverlay')?.classList.add('hidden');
    document.getElementById('leLogoControls')?.classList.add('hidden');
    const img = document.getElementById('leLogoImg');
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
            const pct = Math.min(300, Math.max(10, Math.round(newW / (baseW * 0.15) * 100)));
            document.getElementById('leLogoSize').value = pct;
            document.getElementById('leLogoSizeLabel').innerText = pct + '%';
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

window.leUndoLast = function() {
    const s = window.leState;
    if (s.history.length === 0) return Swal.fire('!', 'ไม่มีขั้นตอนให้ย้อนกลับ', 'info');
    const last = s.history.pop();
    s.ctx.putImageData(last, 0, 0);
};

window.leResetAll = async function() {
    const ok = await Swal.fire({
        title: 'เริ่มใหม่ทั้งหมด?', text: 'การแก้ไขทั้งหมดจะหายไป',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'ใช่', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
    });
    if (!ok.isConfirmed) return;
    const s = window.leState;
    if (s.baseImage) { s.history = []; leRenderBase(); }
    leRemoveLogo();
    leClearPendingLogo();
    s.selBox = null;
};

window.leDownload = function() {
    if (window.leCanDownload === false) return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ดาวน์โหลดรูป', 'warning');
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
        a.href = url; a.download = `edited_${Date.now()}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดแล้ว', timer: 1200, showConfirmButton: false });
    }, 'image/png');
};
