// ====================================================
// 🎨 เครื่องมือแต่งรูป v5 - ครบเครื่อง
// แท็บ: ลบโลโก้ | ข้อความ | ปรับสี | จัดการ | Watermark
// ====================================================

window.leState = {
    canvas: null, ctx: null,
    baseImage: null, newLogo: null, pendingLogo: null,
    originalLogo: null,      // 🌟 เก็บโลโก้ต้นฉบับ (สำหรับ recolor)
    history: [],
    mode: 'magic',
    currentTab: 'replace',
    shape: 'rect',
    isDrawingSelection: false,
    selStart: null, lassoPoints: [],
    selBox: null,
    zoom: 1,
    logoOverlay: { x: 50, y: 50, w: 120, h: 120, opacity: 1 },
    logoRecolor: { enabled: false, color: '#ec4899' },  // 🌟 ใหม่
    
    textObjects: [],
    selectedTextId: null,
    filtersBaked: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0 },
    cropMode: false,
    cropBox: null,
    cropRatio: 'free'
};

function leTotalScale() { return window.leState.zoom || 1; }

function leEnsureInit() {
    if (window.leState.canvas && window.leState.ctx) return true;
    const cvs = document.getElementById('leCanvas');
    if (!cvs) return false;
    window.leState.canvas = cvs;
    window.leState.ctx = cvs.getContext('2d', { willReadFrequently: true });
    leSetupCanvasEvents();
    leSetupLogoOverlayEvents();
    leSetupDragDropFile();
    leSetMode('magic');
    leSetupTextDragging();
    return true;
}

window.initLogoEditorApp = function() {
    if (!leEnsureInit()) return;
    const isAdminOrMgr = (typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager'));
    const can = (perm) => isAdminOrMgr || (typeof window.hasUserPerm === 'function' && window.hasUserPerm(perm));
    window.leCanErase = can('logo_editor_erase');
    window.leCanAddLogo = can('logo_editor_add_logo');
    window.leCanDownload = can('logo_editor_download');
    const eraseSection = document.getElementById('leEraseSection');
    const addLogoSection = document.getElementById('leAddLogoSection');
    const downloadBtn = document.getElementById('leDownloadBtn');
    if (eraseSection) eraseSection.style.display = window.leCanErase ? '' : 'none';
    if (addLogoSection) addLogoSection.style.display = window.leCanAddLogo ? '' : 'none';
    if (downloadBtn) downloadBtn.style.display = window.leCanDownload ? '' : 'none';
    
    // 🌟 Keyboard shortcuts
    leSetupKeyboardShortcuts();
};

// ==========================================
// ⌨️ Keyboard shortcuts (Ctrl+Z = undo, Ctrl+S = download, Esc = ยกเลิก crop)
// ==========================================
function leSetupKeyboardShortcuts() {
    if (window._leShortcutsSetup) return;
    window._leShortcutsSetup = true;
    
    document.addEventListener('keydown', (e) => {
        // ถ้าหน้านี้ไม่ active ไม่ทำอะไร
        const app = document.getElementById('logoEditorApp');
        if (!app || app.classList.contains('hidden')) return;
        
        // ถ้ากำลังพิมพ์ใน textarea/input ปล่อยให้ทำงานปกติ
        const target = e.target;
        const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        
        // Ctrl+Z = Undo (ใช้ได้แม้กำลังพิมพ์อยู่ก็ตาม แต่ถ้าใน text input ปล่อยให้ default ทำ undo ของ input เอง)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            if (!isTyping) {
                e.preventDefault();
                if (typeof window.leUndoLast === 'function') window.leUndoLast();
            }
        }
        // Ctrl+S = Download
        else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (typeof window.leDownload === 'function') window.leDownload();
        }
        // Esc = ยกเลิก crop
        else if (e.key === 'Escape') {
            if (window.leState.cropMode) {
                e.preventDefault();
                if (typeof window.leCancelCrop === 'function') window.leCancelCrop();
            }
        }
        // Delete = ลบข้อความที่ selected
        else if (e.key === 'Delete' && window.leState.selectedTextId && !isTyping) {
            e.preventDefault();
            window.leDeleteText(window.leState.selectedTextId);
            window.leState.selectedTextId = null;
        }
    });
}

// ==========================================
// 🗂️ Tab Navigation
// ==========================================
window.leSwitchTab = function(tab) {
    window.leState.currentTab = tab;
    ['replace','text','color','adjust','watermark'].forEach(t => {
        const btn = document.getElementById('leTab' + t.charAt(0).toUpperCase() + t.slice(1));
        const content = document.getElementById('leTabContent_' + t);
        if (btn) btn.classList.toggle('active', t === tab);
        if (content) content.classList.toggle('hidden', t !== tab);
    });
};

window.leSetMode = function(mode) {
    window.leState.mode = mode;
    document.getElementById('leModeMagic')?.classList.toggle('active', mode === 'magic');
    document.getElementById('leModeManual')?.classList.toggle('active', mode === 'manual');
    const logoBtnText = document.getElementById('leLogoBtnText');
    if (logoBtnText) {
        logoBtnText.innerText = mode === 'magic' ? 'เลือกโลโก้ใหม่ (วางอัตโนมัติ)' : 'เลือกโลโก้ใหม่';
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
            window.leState.textObjects = [];
            leResetFilters(false);
            leRenderBase();
            leFitScreen();
            leRemoveLogo();
            leClearAllText();
            document.getElementById('leEmptyState')?.classList.add('hidden');
            document.getElementById('leCanvasWrapper')?.classList.remove('hidden');
            document.getElementById('leZoomControls')?.classList.remove('hidden');
            leShowTip('💡 เริ่มแต่งรูปได้แล้ว เลือกแท็บที่ต้องการบน sidebar', 3500);
        };
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
    leApplyFilters(); // ใส่ filter ถ้ามี
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
    leRenderAllTextOverlays();
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
        if (el) el.classList.toggle('active', name === shape);
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
// ✂️ Selection — ทำงานในแท็บ replace เท่านั้น
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
        // ทำงานในแท็บ replace, watermark หรือ crop mode
        if (window.leState.cropMode) return leStartCropDraw(e);
        if (window.leState.currentTab !== 'replace') return;
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
        if (window.leState.cropMode) return leMoveCropDraw(e);
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
        if (window.leState.cropMode) return leEndCropDraw(e);
        if (!window.leState.isDrawingSelection) return;
        window.leState.isDrawingSelection = false;
        const sel = window.leState.selBox;
        const hasValid = sel && ((sel.type === 'rect' && sel.w >= 4 && sel.h >= 4) ||
                                  (sel.type === 'ellipse' && sel.rx >= 2 && sel.ry >= 2) ||
                                  (sel.type === 'lasso' && sel.points && sel.points.length >= 5));
        if (hasValid) {
            const bbox = leGetBBox(sel);
            await leApplyErase();
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
        window.leState.selBox = { type: 'rect', x: x1, y: y1, w, h };
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

window.leApplyErase = async function() {
    if (window.leCanErase === false) return;
    const s = window.leState;
    const sel = s.selBox;
    if (!sel) return;
    if (sel.type === 'rect' && (sel.w < 4 || sel.h < 4)) return;
    if (sel.type === 'ellipse' && (sel.rx < 2 || sel.ry < 2)) return;
    if (sel.type === 'lasso' && sel.points.length < 5) return;
    
    leSaveHistory();
    const mode = document.getElementById('leFillMode').value;
    const color = document.getElementById('leFillColor').value;
    const bbox = leGetBBox(sel);
    let fillStyle = mode === 'solid' ? color : leComputeAvgEdgeColor(bbox);
    
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
    if (sel.type === 'ellipse') return { x: sel.cx - sel.rx, y: sel.cy - sel.ry, w: sel.rx * 2, h: sel.ry * 2 };
    if (sel.type === 'lasso') {
        let xs = sel.points.map(p => p.x), ys = sel.points.map(p => p.y);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
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
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let cr = 0, cg = 0, cb = 0, ca = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
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
// 🪄 Auto place + remove bg
// ==========================================
function leAutoPlaceLogo(bbox) {
    const s = window.leState;
    const logo = s.pendingLogo;
    if (!logo || !bbox) return;
    s.newLogo = logo;
    s.originalLogo = logo;  // 🌟 เก็บไว้ recolor
    const logoRatio = logo.height / logo.width;
    const bboxRatio = bbox.h / bbox.w;
    let w, h;
    if (logoRatio > bboxRatio) {
        h = bbox.h; w = h / logoRatio;
    } else {
        w = bbox.w; h = w * logoRatio;
    }
    s.logoOverlay = {
        x: bbox.x + (bbox.w - w) / 2,
        y: bbox.y + (bbox.h - h) / 2,
        w, h, opacity: 1
    };
    document.getElementById('leLogoImg').src = logo.src;
    document.getElementById('leLogoOverlay').classList.remove('hidden');
    document.getElementById('leLogoControls').classList.remove('hidden');
    document.getElementById('leLogoSize').value = 100;
    document.getElementById('leLogoOpacity').value = 100;
    leUpdateLogoOverlayPosition();
    // ถ้าเปิด recolor อยู่ → apply เลย
    if (s.logoRecolor.enabled) leApplyLogoRecolor();
    leShowTip('⚡ วางโลโก้ใหม่เรียบร้อย! ใช้ "เปลี่ยนสี" ได้ในแผงควบคุม', 3000);
}

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
            const corners = [
                [0, 0], [w-1, 0], [0, h-1], [w-1, h-1],
                [Math.floor(w/4), 0], [Math.floor(w*3/4), 0],
                [0, Math.floor(h/4)], [0, Math.floor(h*3/4)]
            ];
            let bgR = 0, bgG = 0, bgB = 0;
            corners.forEach(([x, y]) => {
                const idx = (y * w + x) * 4;
                bgR += data[idx]; bgG += data[idx+1]; bgB += data[idx+2];
            });
            bgR = Math.round(bgR / corners.length);
            bgG = Math.round(bgG / corners.length);
            bgB = Math.round(bgB / corners.length);
            let variance = 0;
            corners.forEach(([x, y]) => {
                const idx = (y * w + x) * 4;
                variance += Math.abs(data[idx] - bgR) + Math.abs(data[idx+1] - bgG) + Math.abs(data[idx+2] - bgB);
            });
            variance = variance / corners.length;
            if (variance > 50) return resolve(img);
            const threshold = 60;
            for (let i = 0; i < data.length; i += 4) {
                const dr = data[i] - bgR;
                const dg = data[i+1] - bgG;
                const db = data[i+2] - bgB;
                const dist = Math.sqrt(dr*dr + dg*dg + db*db);
                if (dist < threshold) {
                    data[i+3] = Math.round((dist / threshold) * 255);
                }
            }
            ctx.putImageData(imgData, 0, 0);
            const newImg = new Image();
            newImg.onload = () => resolve(newImg);
            newImg.onerror = reject;
            newImg.src = canvas.toDataURL('image/png');
        } catch (e) { reject(e); }
    });
}

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
            const removeBg = document.getElementById('leAutoRemoveBg');
            const shouldRemove = !removeBg || removeBg.checked;
            let finalImg = img;
            if (shouldRemove) {
                try { finalImg = await leRemoveBgFromLogo(img); } catch (e) { finalImg = img; }
            }
            if (window.leState.mode === 'magic') {
                window.leState.pendingLogo = finalImg;
                window.leState.originalLogo = finalImg;  // 🌟 เก็บไว้ recolor
                const preview = document.getElementById('leLogoPreview');
                const previewImg = document.getElementById('leLogoPreviewImg');
                const badge = document.getElementById('leLogoReadyBadge');
                if (previewImg) previewImg.src = finalImg.src;
                if (preview) preview.classList.remove('hidden');
                if (badge) badge.classList.remove('hidden');
                leShowTip(window.leState.baseImage ? '⚡ พร้อมแล้ว! ลากคลุมโลโก้เก่าได้เลย' : '💡 เลือกรูปต้นฉบับก่อน', 3500);
            } else {
                if (!window.leState.baseImage) {
                    Swal.fire('!', 'กรุณาเลือกรูปต้นฉบับก่อน', 'warning');
                    if (event.target) event.target.value = '';
                    return;
                }
                window.leState.newLogo = finalImg;
                window.leState.originalLogo = finalImg;  // 🌟 เก็บไว้ recolor
                const baseW = window.leState.baseImage.width;
                const w0 = baseW * 0.15;
                const ratio = finalImg.height / finalImg.width;
                window.leState.logoOverlay = { x: baseW * 0.05, y: window.leState.baseImage.height * 0.05, w: w0, h: w0 * ratio, opacity: 1 };
                document.getElementById('leLogoImg').src = finalImg.src;
                document.getElementById('leLogoOverlay').classList.remove('hidden');
                document.getElementById('leLogoControls').classList.remove('hidden');
                leUpdateLogoOverlayPosition();
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
};

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
    window.leState.originalLogo = null;
    document.getElementById('leLogoOverlay')?.classList.add('hidden');
    document.getElementById('leLogoControls')?.classList.add('hidden');
    const img = document.getElementById('leLogoImg');
    if (img) img.src = '';
    // reset recolor
    const recolorCb = document.getElementById('leLogoRecolor');
    if (recolorCb) recolorCb.checked = false;
    document.getElementById('leLogoRecolorControls')?.classList.add('hidden');
    window.leState.logoRecolor.enabled = false;
};

// ==========================================
// 🎨 เปลี่ยนสีตัวอักษรในโลโก้
// ==========================================
window.leSetLogoColor = function(color) {
    // คลิกที่ preset → ใส่ในช่อง color picker แล้ว apply
    const colorInput = document.getElementById('leLogoNewColor');
    if (colorInput) colorInput.value = color;
    // เปิด checkbox อัตโนมัติ
    const cb = document.getElementById('leLogoRecolor');
    if (cb && !cb.checked) cb.checked = true;
    leUpdateLogoRecolor();
};

window.leUpdateLogoRecolor = function() {
    const cb = document.getElementById('leLogoRecolor');
    const enabled = cb && cb.checked;
    const controls = document.getElementById('leLogoRecolorControls');
    
    if (enabled) controls?.classList.remove('hidden');
    else controls?.classList.add('hidden');
    
    window.leState.logoRecolor.enabled = enabled;
    window.leState.logoRecolor.color = document.getElementById('leLogoNewColor')?.value || '#ec4899';
    
    leApplyLogoRecolor();
};

// ทำการเปลี่ยนสีโลโก้
function leApplyLogoRecolor() {
    const s = window.leState;
    if (!s.originalLogo) return;
    
    // ถ้าปิด recolor → ใช้ originalLogo เลย
    if (!s.logoRecolor.enabled) {
        s.newLogo = s.originalLogo;
        document.getElementById('leLogoImg').src = s.originalLogo.src;
        return;
    }
    
    // ถ้าเปิด → ระบายสีใหม่ทับ
    const tmp = document.createElement('canvas');
    tmp.width = s.originalLogo.width;
    tmp.height = s.originalLogo.height;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(s.originalLogo, 0, 0);
    
    // ใช้ globalCompositeOperation 'source-in' = ระบายสีทับเฉพาะส่วนที่ทึบ (ไม่โปร่งใส)
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = s.logoRecolor.color;
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.globalCompositeOperation = 'source-over';
    
    // สร้าง Image ใหม่
    const recolored = new Image();
    recolored.onload = () => {
        s.newLogo = recolored;
        document.getElementById('leLogoImg').src = recolored.src;
        // update preview ใน sidebar ด้วย
        if (s.mode === 'magic') {
            const prev = document.getElementById('leLogoPreviewImg');
            if (prev) prev.src = recolored.src;
        }
    };
    recolored.src = tmp.toDataURL('image/png');
}

function leSetupLogoOverlayEvents() {
    const overlay = document.getElementById('leLogoOverlay');
    const handle = document.getElementById('leLogoHandle');
    if (!overlay || overlay._eventsSetup) return;
    overlay._eventsSetup = true;
    let isDragging = false, isResizing = false;
    let dragStart = null;
    const onDown = (e) => {
        if (e.target === handle) isResizing = true; else isDragging = true;
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
        const dx = cx - dragStart.x, dy = cy - dragStart.y;
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

// ==========================================
// ✨ TEXT — ใส่ข้อความบนรูป
// ==========================================
window.leAddText = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'กรุณาเลือกรูปก่อน', 'warning');
    const text = document.getElementById('leTextInput').value.trim();
    if (!text) return Swal.fire('!', 'กรุณาพิมพ์ข้อความ', 'warning');
    
    const fontSize = parseInt(document.getElementById('leTextSize').value);
    const obj = {
        id: 't_' + Date.now(),
        text,
        x: s.canvas.width / 2,
        y: s.canvas.height / 2,
        fontSize,
        font: document.getElementById('leTextFont').value,
        color: document.getElementById('leTextColor').value,
        weight: document.getElementById('leTextWeight').value,
        stroke: parseInt(document.getElementById('leTextStroke').value),
        strokeColor: document.getElementById('leTextStrokeColor').value,
        shadow: document.getElementById('leTextShadow').checked
    };
    s.textObjects.push(obj);
    leRenderAllTextOverlays();
    leUpdateTextList();
    leShowTip('✏️ ลากย้ายข้อความได้ คลิกในรายการเพื่อแก้ไข', 3000);
};

function leRenderAllTextOverlays() {
    const container = document.getElementById('leTextOverlayContainer');
    if (!container) return;
    container.innerHTML = '';
    container.style.pointerEvents = 'none';
    const scale = leTotalScale();
    window.leState.textObjects.forEach(obj => {
        const div = document.createElement('div');
        div.className = 'le-text-overlay' + (obj.id === window.leState.selectedTextId ? ' selected' : '');
        div.dataset.id = obj.id;
        div.style.left = (obj.x * scale) + 'px';
        div.style.top = (obj.y * scale) + 'px';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.color = obj.color;
        div.style.fontFamily = obj.font;
        div.style.fontWeight = obj.weight;
        div.style.fontSize = (obj.fontSize * scale) + 'px';
        div.style.pointerEvents = 'auto';
        if (obj.stroke > 0) {
            div.style.webkitTextStroke = `${obj.stroke * scale}px ${obj.strokeColor}`;
        }
        if (obj.shadow) {
            div.style.textShadow = `${3 * scale}px ${3 * scale}px ${4 * scale}px rgba(0,0,0,0.7)`;
        }
        div.innerText = obj.text;
        container.appendChild(div);
    });
}

function leSetupTextDragging() {
    const container = document.getElementById('leTextOverlayContainer');
    if (!container || container._setup) return;
    container._setup = true;
    let dragId = null, dragStart = null, startPos = null;
    
    const onDown = (e) => {
        const t = e.target.closest('.le-text-overlay');
        if (!t) return;
        dragId = t.dataset.id;
        window.leState.selectedTextId = dragId;
        const obj = window.leState.textObjects.find(o => o.id === dragId);
        if (!obj) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        dragStart = { x: cx, y: cy };
        startPos = { x: obj.x, y: obj.y };
        leRenderAllTextOverlays();
        leUpdateTextList();
        e.preventDefault();
        e.stopPropagation();
    };
    const onMove = (e) => {
        if (!dragId) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const scale = leTotalScale();
        const obj = window.leState.textObjects.find(o => o.id === dragId);
        if (!obj) return;
        obj.x = startPos.x + (cx - dragStart.x) / scale;
        obj.y = startPos.y + (cy - dragStart.y) / scale;
        leRenderAllTextOverlays();
        e.preventDefault();
    };
    const onUp = () => { dragId = null; };
    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('touchstart', onDown, {passive: false});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onUp);
}

function leUpdateTextList() {
    const wrap = document.getElementById('leTextList');
    const list = document.getElementById('leTextItems');
    const count = document.getElementById('leTextCount');
    if (!wrap || !list) return;
    const items = window.leState.textObjects;
    if (items.length === 0) {
        wrap.classList.add('hidden');
        return;
    }
    wrap.classList.remove('hidden');
    if (count) count.innerText = items.length;
    list.innerHTML = items.map(o => `
        <div class="flex items-center gap-1 bg-cyan-950/30 border border-cyan-900/40 rounded p-1.5 hover:bg-cyan-950/50 transition">
            <span class="material-icons text-xs text-cyan-400">text_fields</span>
            <span class="flex-1 text-[11px] text-cyan-200 truncate">${o.text}</span>
            <button onclick="leDeleteText('${o.id}')" class="text-rose-400 hover:bg-rose-500/20 p-0.5 rounded">
                <span class="material-icons text-xs">close</span>
            </button>
        </div>
    `).join('');
}

window.leDeleteText = function(id) {
    window.leState.textObjects = window.leState.textObjects.filter(o => o.id !== id);
    leRenderAllTextOverlays();
    leUpdateTextList();
};

function leClearAllText() {
    window.leState.textObjects = [];
    leRenderAllTextOverlays();
    leUpdateTextList();
}

// แสดงค่า slider live
document.addEventListener('input', (e) => {
    if (e.target.id === 'leTextSize') document.getElementById('leTextSizeLabel').innerText = e.target.value + 'px';
    if (e.target.id === 'leTextStroke') document.getElementById('leTextStrokeLabel').innerText = e.target.value;
    if (e.target.id === 'leWmOpacity') document.getElementById('leWmOpacityLabel').innerText = e.target.value + '%';
    if (e.target.id === 'leWmSize') document.getElementById('leWmSizeLabel').innerText = e.target.value;
});

// ==========================================
// 🎨 FILTER — ปรับสี
// ==========================================
function leGetFilterCss() {
    const b = document.getElementById('leBrightness')?.value || 100;
    const c = document.getElementById('leContrast')?.value || 100;
    const s = document.getElementById('leSaturate')?.value || 100;
    const h = document.getElementById('leHue')?.value || 0;
    const bl = document.getElementById('leBlur')?.value || 0;
    document.getElementById('leBrightnessLabel') && (document.getElementById('leBrightnessLabel').innerText = b + '%');
    document.getElementById('leContrastLabel') && (document.getElementById('leContrastLabel').innerText = c + '%');
    document.getElementById('leSaturateLabel') && (document.getElementById('leSaturateLabel').innerText = s + '%');
    document.getElementById('leHueLabel') && (document.getElementById('leHueLabel').innerText = h + '°');
    document.getElementById('leBlurLabel') && (document.getElementById('leBlurLabel').innerText = bl);
    return `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) blur(${bl}px)`;
}

window.leApplyFilters = function() {
    const s = window.leState;
    if (!s.baseImage) return;
    s.ctx.filter = leGetFilterCss();
    s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    s.ctx.drawImage(s.baseImage, 0, 0);
    s.ctx.filter = 'none';
    // ถ้ามีการแก้ไขอื่นๆ (เช่น erase) — ทำหลัง commit เท่านั้น
};

window.leResetFilters = function(apply = true) {
    ['leBrightness','leContrast','leSaturate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 100; });
    const hue = document.getElementById('leHue'); if (hue) hue.value = 0;
    const blur = document.getElementById('leBlur'); if (blur) blur.value = 0;
    if (apply) leApplyFilters();
};

window.leApplyPreset = function(preset) {
    const presets = {
        none:     { b: 100, c: 100, s: 100, h: 0, bl: 0 },
        warm:     { b: 105, c: 110, s: 115, h: 10, bl: 0 },
        cool:     { b: 95, c: 105, s: 90, h: -15, bl: 0 },
        vivid:    { b: 105, c: 120, s: 140, h: 0, bl: 0 },
        vintage:  { b: 105, c: 95, s: 70, h: 15, bl: 0 },
        bw:       { b: 100, c: 110, s: 0, h: 0, bl: 0 },
        sepia:    { b: 110, c: 100, s: 50, h: 20, bl: 0 },
        bright:   { b: 120, c: 105, s: 110, h: 0, bl: 0 },
        dramatic: { b: 95, c: 140, s: 110, h: 0, bl: 0 }
    };
    const p = presets[preset] || presets.none;
    document.getElementById('leBrightness').value = p.b;
    document.getElementById('leContrast').value = p.c;
    document.getElementById('leSaturate').value = p.s;
    document.getElementById('leHue').value = p.h;
    document.getElementById('leBlur').value = p.bl;
    leApplyFilters();
};

// commit filter — เขียนผลถาวรลง baseImage
window.leCommitFilters = function() {
    const s = window.leState;
    if (!s.baseImage) return;
    leSaveHistory();
    // วาดใหม่ด้วย filter แล้วเซฟเป็น baseImage ใหม่
    const tmp = document.createElement('canvas');
    tmp.width = s.canvas.width;
    tmp.height = s.canvas.height;
    const tctx = tmp.getContext('2d');
    tctx.filter = leGetFilterCss();
    tctx.drawImage(s.canvas, 0, 0);
    
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
        s.ctx.drawImage(newImg, 0, 0);
        leResetFilters(false);
        leApplyFilters();
        Swal.fire({ icon: 'success', title: 'บันทึกการปรับสีแล้ว', timer: 1000, showConfirmButton: false });
    };
    newImg.src = tmp.toDataURL('image/png');
};

// ==========================================
// 🔄 ROTATE / FLIP / CROP
// ==========================================
window.leRotate = function(degrees) {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    leSaveHistory();
    const oldW = s.canvas.width, oldH = s.canvas.height;
    const newW = oldH, newH = oldW;
    const tmp = document.createElement('canvas');
    tmp.width = newW; tmp.height = newH;
    const tctx = tmp.getContext('2d');
    tctx.translate(newW / 2, newH / 2);
    tctx.rotate(degrees * Math.PI / 180);
    tctx.drawImage(s.canvas, -oldW / 2, -oldH / 2);
    
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.canvas.width = newW;
        s.canvas.height = newH;
        s.ctx.drawImage(newImg, 0, 0);
        leFitScreen();
    };
    newImg.src = tmp.toDataURL('image/png');
};

window.leFlipImage = function(dir) {
    const s = window.leState;
    if (!s.baseImage) return;
    leSaveHistory();
    const tmp = document.createElement('canvas');
    tmp.width = s.canvas.width; tmp.height = s.canvas.height;
    const tctx = tmp.getContext('2d');
    if (dir === 'h') { tctx.translate(s.canvas.width, 0); tctx.scale(-1, 1); }
    else { tctx.translate(0, s.canvas.height); tctx.scale(1, -1); }
    tctx.drawImage(s.canvas, 0, 0);
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
        s.ctx.drawImage(newImg, 0, 0);
    };
    newImg.src = tmp.toDataURL('image/png');
};

window.leStartCrop = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    s.cropMode = true;
    s.cropRatio = document.getElementById('leCropRatio').value;
    document.getElementById('leStartCropBtn').classList.add('hidden');
    document.getElementById('leCropControls').classList.remove('hidden');
    document.getElementById('leCropControls').classList.add('grid');
    document.getElementById('leCanvas').style.cursor = 'crosshair';
    // เริ่มต้นด้วยกรอบกลาง 80%
    const w = s.canvas.width * 0.8;
    const h = s.canvas.height * 0.8;
    s.cropBox = { x: (s.canvas.width - w) / 2, y: (s.canvas.height - h) / 2, w, h };
    leDrawCropOverlay();
    leShowTip('🖱️ ลากใหม่บนรูปเพื่อกำหนดกรอบ — กด "ครอบเลย" เมื่อพอใจ', 4000);
};

function leDrawCropOverlay() {
    const overlay = document.getElementById('leCropOverlay');
    const s = window.leState;
    if (!overlay || !s.cropBox) return;
    overlay.classList.remove('hidden');
    const scale = leTotalScale();
    overlay.style.left = (s.cropBox.x * scale) + 'px';
    overlay.style.top = (s.cropBox.y * scale) + 'px';
    overlay.style.width = (s.cropBox.w * scale) + 'px';
    overlay.style.height = (s.cropBox.h * scale) + 'px';
}

function leStartCropDraw(e) {
    if (!window.leState.cropMode) return;
    e.preventDefault();
    const cvs = window.leState.canvas;
    const rect = cvs.getBoundingClientRect();
    const scale = leTotalScale();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    window.leState._cropDrawing = true;
    window.leState._cropStart = { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale };
}

function leMoveCropDraw(e) {
    if (!window.leState._cropDrawing) return;
    e.preventDefault();
    const cvs = window.leState.canvas;
    const rect = cvs.getBoundingClientRect();
    const scale = leTotalScale();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const ex = (cx - rect.left) / scale;
    const ey = (cy - rect.top) / scale;
    const s = window.leState;
    let x = Math.min(s._cropStart.x, ex);
    let y = Math.min(s._cropStart.y, ey);
    let w = Math.abs(ex - s._cropStart.x);
    let h = Math.abs(ey - s._cropStart.y);
    // บังคับ ratio
    if (s.cropRatio !== 'free') {
        const [rw, rh] = s.cropRatio.split(':').map(Number);
        const targetRatio = rw / rh;
        if (w / h > targetRatio) w = h * targetRatio;
        else h = w / targetRatio;
    }
    s.cropBox = { x, y, w, h };
    leDrawCropOverlay();
}

function leEndCropDraw(e) {
    window.leState._cropDrawing = false;
}

window.leApplyCrop = function() {
    const s = window.leState;
    if (!s.cropBox || s.cropBox.w < 10 || s.cropBox.h < 10) {
        return Swal.fire('!', 'กรอบเล็กเกินไป', 'warning');
    }
    leSaveHistory();
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(s.cropBox.w);
    tmp.height = Math.round(s.cropBox.h);
    const tctx = tmp.getContext('2d');
    tctx.drawImage(s.canvas, -s.cropBox.x, -s.cropBox.y);
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.canvas.width = tmp.width;
        s.canvas.height = tmp.height;
        s.ctx.drawImage(newImg, 0, 0);
        leFitScreen();
        leCancelCrop();
        Swal.fire({ icon: 'success', title: 'ครอบรูปสำเร็จ', timer: 1000, showConfirmButton: false });
    };
    newImg.src = tmp.toDataURL('image/png');
};

window.leCancelCrop = function() {
    window.leState.cropMode = false;
    window.leState.cropBox = null;
    document.getElementById('leStartCropBtn').classList.remove('hidden');
    document.getElementById('leCropControls').classList.add('hidden');
    document.getElementById('leCropControls').classList.remove('grid');
    document.getElementById('leCropOverlay').classList.add('hidden');
    document.getElementById('leCanvas').style.cursor = 'crosshair';
};

// ==========================================
// 💧 WATERMARK
// ==========================================
window.leApplyWatermark = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    const text = document.getElementById('leWatermarkText').value.trim();
    if (!text) return Swal.fire('!', 'กรุณาพิมพ์ข้อความ', 'warning');
    
    leSaveHistory();
    const pattern = document.getElementById('leWatermarkPattern').value;
    const opacity = parseInt(document.getElementById('leWmOpacity').value) / 100;
    const size = parseInt(document.getElementById('leWmSize').value);
    const color = document.getElementById('leWmColor').value;
    
    s.ctx.save();
    s.ctx.globalAlpha = opacity;
    s.ctx.fillStyle = color;
    s.ctx.font = `bold ${size}px Arial, sans-serif`;
    s.ctx.textBaseline = 'middle';
    
    if (pattern === 'tile') {
        // เรียงทแยงทั่วทั้งภาพ
        s.ctx.translate(s.canvas.width / 2, s.canvas.height / 2);
        s.ctx.rotate(-Math.PI / 6);
        s.ctx.textAlign = 'center';
        const spaceX = size * 8;
        const spaceY = size * 4;
        const range = Math.max(s.canvas.width, s.canvas.height);
        for (let y = -range; y < range; y += spaceY) {
            for (let x = -range; x < range; x += spaceX) {
                s.ctx.fillText(text, x, y);
            }
        }
    } else if (pattern === 'single') {
        s.ctx.textAlign = 'right';
        s.ctx.fillText(text, s.canvas.width - 20, s.canvas.height - 20);
    } else if (pattern === 'corners') {
        const margin = 20;
        s.ctx.textAlign = 'left';
        s.ctx.fillText(text, margin, margin + size / 2);
        s.ctx.fillText(text, margin, s.canvas.height - margin - size / 2);
        s.ctx.textAlign = 'right';
        s.ctx.fillText(text, s.canvas.width - margin, margin + size / 2);
        s.ctx.fillText(text, s.canvas.width - margin, s.canvas.height - margin - size / 2);
    } else if (pattern === 'center') {
        s.ctx.textAlign = 'center';
        s.ctx.font = `bold ${size * 3}px Arial, sans-serif`;
        s.ctx.fillText(text, s.canvas.width / 2, s.canvas.height / 2);
    }
    
    s.ctx.restore();
    Swal.fire({ icon: 'success', title: 'ใส่ลายน้ำสำเร็จ', timer: 1000, showConfirmButton: false });
};

// ==========================================
// 📚 HISTORY
// ==========================================
function leSaveHistory() {
    const s = window.leState;
    if (!s.ctx || !s.canvas) return;
    try {
        s.history.push(s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height));
        if (s.history.length > 20) s.history.shift();
    } catch(e) {}
}

window.leUndoLast = function() {
    const s = window.leState;
    if (s.history.length === 0) return Swal.fire('!', 'ไม่มีขั้นตอนให้ย้อนกลับ', 'info');
    const last = s.history.pop();
    s.canvas.width = last.width;
    s.canvas.height = last.height;
    s.ctx.putImageData(last, 0, 0);
    leFitScreen();
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
    leClearAllText();
    leResetFilters(false);
    s.selBox = null;
};

// ==========================================
// 💾 DOWNLOAD - merge ทุก layer
// ==========================================
window.leDownload = function() {
    if (window.leCanDownload === false) return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ดาวน์โหลดรูป', 'warning');
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    
    const out = document.createElement('canvas');
    out.width = s.canvas.width;
    out.height = s.canvas.height;
    const octx = out.getContext('2d');
    
    // 1. canvas หลัก (มี filter ฝังอยู่ถ้าไม่ได้ commit)
    octx.filter = leGetFilterCss();
    octx.drawImage(s.canvas, 0, 0);
    octx.filter = 'none';
    
    // 2. โลโก้ใหม่
    if (s.newLogo) {
        octx.globalAlpha = s.logoOverlay.opacity;
        octx.drawImage(s.newLogo, s.logoOverlay.x, s.logoOverlay.y, s.logoOverlay.w, s.logoOverlay.h);
        octx.globalAlpha = 1;
    }
    
    // 3. text overlays
    s.textObjects.forEach(obj => {
        octx.save();
        octx.font = `${obj.weight} ${obj.fontSize}px ${obj.font}`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        if (obj.shadow) {
            octx.shadowColor = 'rgba(0,0,0,0.7)';
            octx.shadowBlur = 4;
            octx.shadowOffsetX = 3;
            octx.shadowOffsetY = 3;
        }
        if (obj.stroke > 0) {
            octx.strokeStyle = obj.strokeColor;
            octx.lineWidth = obj.stroke;
            octx.lineJoin = 'round';
            octx.strokeText(obj.text, obj.x, obj.y);
        }
        octx.fillStyle = obj.color;
        octx.fillText(obj.text, obj.x, obj.y);
        octx.restore();
    });
    
    out.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `edited_${Date.now()}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดแล้ว', timer: 1200, showConfirmButton: false });
    }, 'image/png');
};
