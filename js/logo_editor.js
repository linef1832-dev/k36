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
    logoRecolor: { 
        enabled: false, 
        color: '#ec4899',
        mode: 'all',                  // 'all' หรือ 'selective'
        sourceColor: '#ffffff',       // สีต้นทาง (สำหรับ selective)
        tolerance: 50,                // ความใกล้เคียง
        pickMode: false               // กำลังรอ click ที่ canvas เพื่อ pick สี
    },
    
    textObjects: [],
    selectedTextId: null,
    filtersBaked: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0 },
    cropMode: false,
    cropBox: null,
    cropRatio: 'free',
    
    // 🌟 v6 ใหม่
    isBrushing: false,            // กำลังลากแปรง Magic Eraser
    drawMode: false,              // โหมดวาดเปิดอยู่ไหม
    drawTool: 'pen',              // 'pen','highlighter','marker','arrow','line','rect-shape','circle-shape','eraser'
    drawColor: '#ef4444',
    drawSize: 8,
    drawingShape: false,          // กำลังลากวาด shape (เส้น/ลูกศร/กรอบ)
    drawStart: null,              // จุดเริ่มของ shape
    drawSnapshot: null,           // snapshot ก่อนวาด shape (สำหรับ preview)
    stickerObjects: [],           // [{id, emoji, x, y, size}]
    selectedStickerId: null,
    
    // 🌟 v7 — Logo Splitter
    splitSource: null,            // Image ต้นฉบับที่จะแยก
    splitParts: [],               // [{id, color, mask: ImageData, bbox, scale, dx, dy, replaceText, visible}]
    selectedPartId: null,
    splitMode: false              // อยู่ในโหมดแยกชิ้นไหม
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
    leSetupStickerDragging();
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
    
    // 🌟 [แก้บัค scroll] บังคับ layout ของ sidebar — ใช้ JS เพราะ CSS อาจถูก override
    leForceLayoutFix();
};

// ==========================================
// 🔧 บังคับ layout ของ sidebar/canvas ให้ scroll ทำงานแน่นอน
// ==========================================
function leForceLayoutFix() {
    requestAnimationFrame(() => {
        const app = document.getElementById('logoEditorApp');
        if (!app) return;
        
        // root: fixed inset-0 (เต็มจอ)
        app.style.height = '100vh';
        app.style.maxHeight = '100vh';
        app.style.display = 'flex';
        app.style.flexDirection = 'column';
        
        // header
        const header = app.querySelector(':scope > div:first-of-type');
        if (header) header.style.flexShrink = '0';
        
        // body (flex container ใหญ่)
        const body = app.querySelector(':scope > div:last-of-type');
        if (body) {
            body.style.flex = '1 1 0%';
            body.style.minHeight = '0';
            body.style.height = 'auto';
            body.style.overflow = 'hidden';
            body.style.display = 'flex';
        }
        
        // sidebar
        const aside = app.querySelector('aside');
        if (aside) {
            aside.style.height = '100%';
            aside.style.minHeight = '0';
            aside.style.maxHeight = '100%';
            aside.style.display = 'flex';
            aside.style.flexDirection = 'column';
            aside.style.flexShrink = '0';
        }
        
        // scroll container ใน sidebar
        if (aside) {
            // 🌟 tab nav (ตัวแรก) ต้องไม่ขยาย
            const tabNav = aside.querySelector('.le-tab-nav');
            if (tabNav) {
                tabNav.style.flex = '0 0 auto';
                tabNav.style.flexShrink = '0';
                tabNav.style.height = 'auto';
            }
            
            // scroll div — ต้องเป็นตัวที่ยาวที่สุด ขยายเต็มที่
            const scrollDiv = aside.querySelector('[class*="overflow-y-auto"]');
            if (scrollDiv) {
                scrollDiv.style.flex = '1 1 0%';
                scrollDiv.style.minHeight = '0';
                scrollDiv.style.overflowY = 'auto';
                scrollDiv.style.overflowX = 'hidden';
            }
            
            // sticky bottom — shrink-0
            const bottomSection = aside.querySelector(':scope > div:last-of-type');
            if (bottomSection) {
                bottomSection.style.flexShrink = '0';
                bottomSection.style.flex = '0 0 auto';
            }
        }
        
        // canvas area
        const canvasArea = document.getElementById('leCanvasArea');
        if (canvasArea) {
            canvasArea.style.flex = '1 1 0%';
            canvasArea.style.minHeight = '0';
            canvasArea.style.overflow = 'auto';
        }
    });
}

// re-fix layout ทุกครั้งที่ resize
window.addEventListener('resize', () => {
    if (document.getElementById('logoEditorApp')) leForceLayoutFix();
});

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
    const allTabs = ['replace','aibg','split','template','text','draw','sticker','layer','color','adjust','resize','watermark'];
    allTabs.forEach(t => {
        const btn = document.getElementById('leTab' + t.charAt(0).toUpperCase() + t.slice(1));
        const content = document.getElementById('leTabContent_' + t);
        if (btn) btn.classList.toggle('active', t === tab);
        if (content) content.classList.toggle('hidden', t !== tab);
    });
    if (tab !== 'draw' && window.leState.drawMode) leToggleDrawMode();
    if (tab === 'resize') leUpdateResizeInfo();
    if (tab === 'sticker') leRenderEmojiPickers();
    if (tab === 'layer') leLayerRefresh();
    if (tab === 'split') leSplitRefresh();
};

window.leSetMode = function(mode) {
    window.leState.mode = mode;
    document.getElementById('leModeMagic')?.classList.toggle('active', mode === 'magic');
    document.getElementById('leModeManual')?.classList.toggle('active', mode === 'manual');
    document.getElementById('leModeBrush')?.classList.toggle('active', mode === 'brush');
    
    // โหมด brush → แสดง brush controls + เปลี่ยน cursor
    const brushSection = document.getElementById('leBrushSection');
    if (mode === 'brush') {
        brushSection?.classList.remove('hidden');
        const cvs = document.getElementById('leCanvas');
        if (cvs) cvs.style.cursor = 'crosshair';
        leShowTip('🪶 ลากแปรงทับสิ่งที่อยากลบ — ระบบลบให้ทันที', 3500);
    } else {
        brushSection?.classList.add('hidden');
    }
    
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
            leClearAllStickers();
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
        if (window.leState.cropMode) return leStartCropDraw(e);
        
        // 🎨 Split mode — ใช้แท็บ split และมีชิ้นแยกอยู่
        if (window.leState.currentTab === 'split' && window.leState.splitMode && window.leState.splitParts.length > 0) {
            e.preventDefault();
            leSplitHandleCanvasMouseDown(e);
            return;
        }
        
        // 🌟 โหมดวาด (มี priority สูงสุด ใช้ได้ทุกแท็บที่เปิด drawMode)
        if (window.leState.drawMode) return leStartDraw(e, getCoords(e));
        
        // 🪶 Magic Eraser Brush — ใช้ในแท็บ replace + mode = brush
        if (window.leState.currentTab === 'replace' && window.leState.mode === 'brush') {
            if (window.leCanErase === false) return;
            e.preventDefault();
            leSaveHistory();
            window.leState.isBrushing = true;
            leBrushErase(getCoords(e));
            return;
        }
        
        // โหมดคลุมเป็นกรอบ (rect/ellipse/circle/lasso)
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
        
        // split drag
        if (window.leState._splitDragging) {
            return leSplitHandleCanvasMouseMove(e);
        }
        
        if (window.leState.drawMode) return leMoveDraw(e, getCoords(e));
        
        // brush eraser
        if (window.leState.isBrushing) {
            e.preventDefault();
            leBrushErase(getCoords(e));
            return;
        }
        
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
        
        // split drag end
        if (window.leState._splitDragging) {
            return leSplitHandleCanvasMouseUp();
        }
        
        if (window.leState.drawMode) return leEndDraw(e);
        
        // brush eraser
        if (window.leState.isBrushing) {
            window.leState.isBrushing = false;
            return;
        }
        
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
    
    // brush size label update
    document.addEventListener('input', (e) => {
        if (e.target.id === 'leBrushSize') {
            document.getElementById('leBrushSizeLabel').innerText = e.target.value + 'px';
        }
        if (e.target.id === 'leDrawSize') {
            document.getElementById('leDrawSizeLabel').innerText = e.target.value + 'px';
            window.leState.drawSize = parseInt(e.target.value);
        }
        if (e.target.id === 'leResizePercent') {
            leUpdateResizePreview();
        }
        if (e.target.id === 'leDrawColor') {
            window.leState.drawColor = e.target.value;
        }
    });
}

// ==========================================
// 🪶 Magic Eraser Brush — ระบายลบเป็นแปรง
// ==========================================
function leBrushErase(p) {
    const s = window.leState;
    if (!s.baseImage) return;
    const size = parseInt(document.getElementById('leBrushSize')?.value || 40);
    const radius = size / 2;
    
    // ใช้ content-aware fill กับ bounding box ของแปรง (วงกลม)
    const sel = {
        type: 'ellipse',
        cx: p.x,
        cy: p.y,
        rx: radius,
        ry: radius
    };
    const bbox = leGetBBox(sel);
    
    // ใช้ algorithm content-aware fill เดิม
    leContentAwareFill(sel, bbox);
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
    
    if (mode === 'solid') {
        // โหมดสีทึบ — ใช้สีที่ผู้ใช้เลือก
        s.ctx.save();
        leClipToShape(s.ctx, sel);
        s.ctx.fillStyle = color;
        s.ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
        s.ctx.restore();
    } else if (mode === 'blur') {
        // โหมด blur — เติม content-aware ก่อน แล้วเบลอ
        leContentAwareFill(sel, bbox);
        try {
            const imgData = s.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
            const blurred = leBoxBlur(imgData, 3);
            s.ctx.putImageData(blurred, bbox.x, bbox.y);
        } catch(e) {}
    } else {
        // 🌟 โหมด auto — ใช้ content-aware fill (ลากสีจากขอบทุกด้านมาใช้)
        leContentAwareFill(sel, bbox);
    }
};

// ==========================================
// 🪄 Content-Aware Fill v5 — Directional Stretch
// หลักการ: pixel ในกรอบ → ใช้สีจากคอลัมน์/แถวเดียวกันที่อยู่นอกกรอบ
// "ยืด" texture เข้ามาแทน — ไม่ใช่ mirror ไม่ใช่เฉลี่ย
// เหมาะกับพื้นที่มีลาย (texture, gradient)
// ==========================================
function leContentAwareFill(sel, bbox) {
    const s = window.leState;
    const ctx = s.ctx;
    const W = s.canvas.width;
    const H = s.canvas.height;
    
    const x0 = Math.max(0, Math.floor(bbox.x));
    const y0 = Math.max(0, Math.floor(bbox.y));
    const x1 = Math.min(W, Math.ceil(bbox.x + bbox.w));
    const y1 = Math.min(H, Math.ceil(bbox.y + bbox.h));
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw < 2 || bh < 2) return;
    
    // อ่านแถบรอบกรอบ — เอาหลายๆ แถวเพื่อหา pixel ที่ "เรียบ" ใช้แทน
    // ความหนาของแถบ source = 8 pixel
    const sampleDepth = 8;
    
    const tDepth = Math.min(sampleDepth, y0);
    const bDepth = Math.min(sampleDepth, H - y1);
    const lDepth = Math.min(sampleDepth, x0);
    const rDepth = Math.min(sampleDepth, W - x1);
    
    // ถ้าไม่มี source เลย → fallback
    if (tDepth === 0 && bDepth === 0 && lDepth === 0 && rDepth === 0) return;
    
    // อ่านแถบทั้งหมด (ครอบคลุมพื้นที่นอกกรอบ + กรอบเดิม)
    const srcX = Math.max(0, x0 - lDepth);
    const srcY = Math.max(0, y0 - tDepth);
    const srcW = Math.min(W - srcX, bw + lDepth + rDepth);
    const srcH = Math.min(H - srcY, bh + tDepth + bDepth);
    
    let srcData;
    try {
        srcData = ctx.getImageData(srcX, srcY, srcW, srcH);
    } catch(e) { return; }
    const src = srcData.data;
    
    // helper: อ่านสีจาก source ที่ตำแหน่ง (sx, sy) — local ใน source
    const getSrc = (sx, sy) => {
        if (sx < 0 || sx >= srcW || sy < 0 || sy >= srcH) return null;
        const i = (sy * srcW + sx) * 4;
        return { r: src[i], g: src[i+1], b: src[i+2] };
    };
    
    const outImg = ctx.createImageData(bw, bh);
    const out = outImg.data;
    
    // สำหรับ pixel แต่ละตัวในกรอบ — เก็บ candidates จากแถบ source
    // - ทิศบน: คอลัมน์เดียวกัน แถวที่อยู่เหนือกรอบ (เลือกแถวที่ "เรียบ" — สีคล้าย neighbors)
    // - ทิศล่าง: คอลัมน์เดียวกัน แถวที่อยู่ใต้กรอบ
    // - ทิศซ้าย: แถวเดียวกัน คอลัมน์ที่อยู่ซ้าย
    // - ทิศขวา: แถวเดียวกัน คอลัมน์ที่อยู่ขวา
    
    // ก่อนอื่น สร้าง "smoothed edge color" สำหรับแต่ละทิศ
    // โดยหาค่าเฉลี่ยของแถบ source ในคอลัมน์/แถวนั้น
    // ⭐ ใช้ median แทน mean เพื่อหลีกเลี่ยง outlier (เช่น pixel ของตัวอักษร)
    
    function median(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }
    
    // สำหรับแต่ละคอลัมน์ (px) — หาสี median ของแถบบน, ล่าง
    // สำหรับแต่ละแถว (py) — หาสี median ของแถบซ้าย, ขวา
    
    const topColors = new Array(bw);     // [{r,g,b}] ของแต่ละคอลัมน์
    const bottomColors = new Array(bw);
    const leftColors = new Array(bh);    // ของแต่ละแถว
    const rightColors = new Array(bh);
    
    // ทิศบน: pixel ที่อยู่เหนือกรอบ ในคอลัมน์ px
    for (let px = 0; px < bw; px++) {
        const sx = px + lDepth;
        if (sx >= srcW) { topColors[px] = null; continue; }
        if (tDepth > 0) {
            // เก็บค่า R, G, B แยกกัน แล้วหา median
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < tDepth; d++) {
                const sy = d; // sy = 0 คือบนสุดของ source = ห่างจากกรอบ tDepth pixels
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            topColors[px] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else topColors[px] = null;
    }
    
    // ทิศล่าง
    for (let px = 0; px < bw; px++) {
        const sx = px + lDepth;
        if (sx >= srcW) { bottomColors[px] = null; continue; }
        if (bDepth > 0) {
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < bDepth; d++) {
                const sy = tDepth + bh + d;
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            bottomColors[px] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else bottomColors[px] = null;
    }
    
    // ทิศซ้าย
    for (let py = 0; py < bh; py++) {
        const sy = py + tDepth;
        if (sy >= srcH) { leftColors[py] = null; continue; }
        if (lDepth > 0) {
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < lDepth; d++) {
                const sx = d;
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            leftColors[py] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else leftColors[py] = null;
    }
    
    // ทิศขวา
    for (let py = 0; py < bh; py++) {
        const sy = py + tDepth;
        if (sy >= srcH) { rightColors[py] = null; continue; }
        if (rDepth > 0) {
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < rDepth; d++) {
                const sx = lDepth + bw + d;
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            rightColors[py] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else rightColors[py] = null;
    }
    
    // ทีนี้ ใช้ bilinear blend ของ 4 ทิศ
    for (let py = 0; py < bh; py++) {
        for (let px = 0; px < bw; px++) {
            const tx = px / (bw - 1 || 1);
            const ty = py / (bh - 1 || 1);
            
            const t = topColors[px];
            const b = bottomColors[px];
            const l = leftColors[py];
            const r = rightColors[py];
            
            // ผสมแนวตั้ง — ถ้าทิศใดไม่มี (null) → ใช้อีกทิศ
            let vR, vG, vB;
            if (t && b) {
                vR = t.r * (1 - ty) + b.r * ty;
                vG = t.g * (1 - ty) + b.g * ty;
                vB = t.b * (1 - ty) + b.b * ty;
            } else if (t) { vR = t.r; vG = t.g; vB = t.b; }
            else if (b)   { vR = b.r; vG = b.g; vB = b.b; }
            else { vR = vG = vB = null; }
            
            // ผสมแนวนอน
            let hR, hG, hB;
            if (l && r) {
                hR = l.r * (1 - tx) + r.r * tx;
                hG = l.g * (1 - tx) + r.g * tx;
                hB = l.b * (1 - tx) + r.b * tx;
            } else if (l) { hR = l.r; hG = l.g; hB = l.b; }
            else if (r)   { hR = r.r; hG = r.g; hB = r.b; }
            else { hR = hG = hB = null; }
            
            // เฉลี่ยแนวตั้ง+แนวนอน
            const i = (py * bw + px) * 4;
            let finalR, finalG, finalB;
            if (vR !== null && hR !== null) {
                finalR = (vR + hR) / 2;
                finalG = (vG + hG) / 2;
                finalB = (vB + hB) / 2;
            } else if (vR !== null) { finalR = vR; finalG = vG; finalB = vB; }
            else if (hR !== null)   { finalR = hR; finalG = hG; finalB = hB; }
            else { finalR = finalG = finalB = 128; }
            
            out[i]   = Math.round(finalR);
            out[i+1] = Math.round(finalG);
            out[i+2] = Math.round(finalB);
            out[i+3] = 255;
        }
    }
    
    // noise นิดหน่อย
    for (let i = 0; i < out.length; i += 4) {
        const n = (Math.random() - 0.5) * 8;
        out[i]   = Math.max(0, Math.min(255, out[i] + n));
        out[i+1] = Math.max(0, Math.min(255, out[i+1] + n));
        out[i+2] = Math.max(0, Math.min(255, out[i+2] + n));
    }
    
    // วาดลง canvas
    const off = document.createElement('canvas');
    off.width = bw; off.height = bh;
    off.getContext('2d').putImageData(outImg, 0, 0);
    
    ctx.save();
    leClipToShape(ctx, sel);
    ctx.drawImage(off, x0, y0);
    ctx.restore();
}





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

window.leUpdateRecolorMode = function() {
    const mode = document.getElementById('leRecolorMode')?.value || 'all';
    window.leState.logoRecolor.mode = mode;
    const selCtl = document.getElementById('leSelectiveControls');
    if (mode === 'selective') selCtl?.classList.remove('hidden');
    else selCtl?.classList.add('hidden');
    leApplyLogoRecolor();
};

// 🌟 โหมด pick สีจากโลโก้ — ผู้ใช้คลิกบนโลโก้แล้วระบบดูดสีออกมา
window.lePickColorMode = function() {
    window.leState.logoRecolor.pickMode = true;
    const btn = document.getElementById('lePickBtn');
    if (btn) {
        btn.innerHTML = '<span class="material-icons text-[12px] align-middle">touch_app</span> คลิกที่สีบนโลโก้...';
        btn.classList.add('animate-pulse');
    }
    const img = document.getElementById('leLogoImg');
    if (img) img.style.cursor = 'crosshair';
    leShowTip('🎯 คลิกที่สีบนโลโก้ที่ต้องการเปลี่ยน', 5000);
};

function leExitPickMode() {
    window.leState.logoRecolor.pickMode = false;
    const btn = document.getElementById('lePickBtn');
    if (btn) {
        btn.innerHTML = '<span class="material-icons text-[12px] align-middle">colorize</span> คลิกเลือกบนโลโก้';
        btn.classList.remove('animate-pulse');
    }
    const img = document.getElementById('leLogoImg');
    if (img) img.style.cursor = '';
}

// คลิกที่ overlay → ถ้าอยู่ใน pickMode ดูดสี
document.addEventListener('click', (e) => {
    if (!window.leState.logoRecolor.pickMode) return;
    const img = e.target.closest('#leLogoImg');
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();
    
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // คำนวณตำแหน่งใน originalLogo
    const origLogo = window.leState.originalLogo;
    if (!origLogo) return;
    const sx = Math.floor(x / rect.width * origLogo.width);
    const sy = Math.floor(y / rect.height * origLogo.height);
    
    // สร้าง canvas ชั่วคราวเพื่ออ่านสี
    const tmp = document.createElement('canvas');
    tmp.width = origLogo.width;
    tmp.height = origLogo.height;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(origLogo, 0, 0);
    try {
        const pixel = tctx.getImageData(sx, sy, 1, 1).data;
        if (pixel[3] < 30) {
            leShowTip('⚠️ คลิกตรงพื้นโปร่งใส กรุณาคลิกที่สีโลโก้', 2500);
            return;
        }
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('');
        document.getElementById('leSourceColor').value = hex;
        leShowTip('🎯 เลือกสี ' + hex + ' แล้ว', 2000);
        leApplyLogoRecolor();
    } catch(err) {
        console.warn('pick color failed:', err);
    }
    leExitPickMode();
}, true);

function leApplyLogoRecolor() {
    const s = window.leState;
    if (!s.originalLogo) return;
    
    // ถ้าปิด recolor → ใช้ originalLogo เลย
    if (!s.logoRecolor.enabled) {
        s.newLogo = s.originalLogo;
        document.getElementById('leLogoImg').src = s.originalLogo.src;
        return;
    }
    
    const newColor = document.getElementById('leLogoNewColor')?.value || '#ec4899';
    const mode = document.getElementById('leRecolorMode')?.value || 'all';
    s.logoRecolor.color = newColor;
    s.logoRecolor.mode = mode;
    
    const tmp = document.createElement('canvas');
    tmp.width = s.originalLogo.width;
    tmp.height = s.originalLogo.height;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(s.originalLogo, 0, 0);
    
    if (mode === 'all') {
        // โหมดเปลี่ยนทั้งหมด: ใช้ source-in
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = newColor;
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.globalCompositeOperation = 'source-over';
    } else {
        // โหมด selective: เปลี่ยนเฉพาะสีใกล้เคียงกับ sourceColor
        const sourceHex = document.getElementById('leSourceColor')?.value || '#ffffff';
        const tolerance = parseInt(document.getElementById('leRecolorTolerance')?.value || 50);
        document.getElementById('leTolLabel') && (document.getElementById('leTolLabel').innerText = tolerance);
        
        s.logoRecolor.sourceColor = sourceHex;
        s.logoRecolor.tolerance = tolerance;
        
        const srcR = parseInt(sourceHex.slice(1, 3), 16);
        const srcG = parseInt(sourceHex.slice(3, 5), 16);
        const srcB = parseInt(sourceHex.slice(5, 7), 16);
        const newR = parseInt(newColor.slice(1, 3), 16);
        const newG = parseInt(newColor.slice(3, 5), 16);
        const newB = parseInt(newColor.slice(5, 7), 16);
        
        const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i+3] < 10) continue; // ข้าม pixel โปร่งใส
            const dr = data[i] - srcR;
            const dg = data[i+1] - srcG;
            const db = data[i+2] - srcB;
            const dist = Math.sqrt(dr*dr + dg*dg + db*db);
            
            if (dist < tolerance) {
                // เปลี่ยนสีโดย smooth (fade เข้ากันที่ขอบ)
                const ratio = 1 - (dist / tolerance);
                data[i]   = Math.round(data[i]   * (1 - ratio) + newR * ratio);
                data[i+1] = Math.round(data[i+1] * (1 - ratio) + newG * ratio);
                data[i+2] = Math.round(data[i+2] * (1 - ratio) + newB * ratio);
            }
        }
        tctx.putImageData(imgData, 0, 0);
    }
    
    const recolored = new Image();
    recolored.onload = () => {
        s.newLogo = recolored;
        document.getElementById('leLogoImg').src = recolored.src;
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
        if (obj.visible === false) return;  // ซ่อนจาก layer panel
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
    // re-render stickers ด้วย (เพราะ innerHTML='' ลบ sticker ไปด้วย)
    leRenderAllStickers();
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
    if (wrap && list) {
        const items = window.leState.textObjects;
        if (items.length === 0) {
            wrap.classList.add('hidden');
        } else {
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
    }
    // refresh layer panel ด้วย
    if (typeof leLayerRefresh === 'function') leLayerRefresh();
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
    leClearAllStickers();
    leResetFilters(false);
    s.selBox = null;
};

// ==========================================
// ✏️ DRAW TOOLS — วาดฟรีมือ
// ==========================================
window.leSetDrawTool = function(tool) {
    window.leState.drawTool = tool;
    ['pen','highlighter','marker','arrow','line','rect-shape','circle-shape','eraser'].forEach(t => {
        const id = 'leDraw' + (
            t === 'pen' ? 'Pen' :
            t === 'highlighter' ? 'Highlight' :
            t === 'marker' ? 'Marker' :
            t === 'arrow' ? 'Arrow' :
            t === 'line' ? 'Line' :
            t === 'rect-shape' ? 'Rect' :
            t === 'circle-shape' ? 'Circle' :
            'Eraser'
        );
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', t === tool);
    });
};

window.leSetDrawColor = function(color) {
    window.leState.drawColor = color;
    const input = document.getElementById('leDrawColor');
    if (input) input.value = color;
};

window.leToggleDrawMode = function() {
    const s = window.leState;
    s.drawMode = !s.drawMode;
    const btn = document.getElementById('leDrawToggleBtn');
    const cvs = document.getElementById('leCanvas');
    if (s.drawMode) {
        if (!s.baseImage) {
            s.drawMode = false;
            Swal.fire('!', 'กรุณาเลือกรูปก่อน', 'warning');
            return;
        }
        if (btn) {
            btn.innerHTML = '<span class="material-icons text-sm align-middle">stop</span> หยุดวาด';
            btn.classList.remove('le-btn-amber');
            btn.classList.add('le-btn-danger');
        }
        if (cvs) cvs.style.cursor = 'crosshair';
        leShowTip('✏️ ลากเมาส์บนรูปเพื่อวาด — กดหยุดวาดเมื่อเสร็จ', 3500);
    } else {
        if (btn) {
            btn.innerHTML = '<span class="material-icons text-sm align-middle">play_arrow</span> เริ่มวาด';
            btn.classList.remove('le-btn-danger');
            btn.classList.add('le-btn-amber');
        }
        if (cvs) cvs.style.cursor = '';
    }
};

function leStartDraw(e, p) {
    const s = window.leState;
    if (!s.baseImage) return;
    e.preventDefault();
    e.stopPropagation();
    leSaveHistory();
    
    const tool = s.drawTool;
    const ctx = s.ctx;
    
    // เครื่องมือ shape (line/arrow/rect/circle) — เก็บ snapshot สำหรับ preview
    if (['line', 'arrow', 'rect-shape', 'circle-shape'].includes(tool)) {
        s.drawingShape = true;
        s.drawStart = p;
        try {
            s.drawSnapshot = ctx.getImageData(0, 0, s.canvas.width, s.canvas.height);
        } catch(err) {}
        return;
    }
    
    // freehand: pen/highlighter/marker/eraser
    s.drawStart = p;
    leDrawPath(p, p);
}

function leMoveDraw(e, p) {
    const s = window.leState;
    if (!s.drawStart) return;
    e.preventDefault();
    
    const tool = s.drawTool;
    
    // Shape: preview - restore snapshot แล้ววาดใหม่
    if (s.drawingShape && s.drawSnapshot) {
        s.ctx.putImageData(s.drawSnapshot, 0, 0);
        leDrawShape(s.drawStart, p);
        return;
    }
    
    // Freehand: ลากเส้นต่อเนื่อง
    leDrawPath(s.drawStart, p);
    s.drawStart = p;
}

function leEndDraw(e) {
    const s = window.leState;
    s.drawingShape = false;
    s.drawStart = null;
    s.drawSnapshot = null;
}

function leDrawPath(from, to) {
    const s = window.leState;
    const ctx = s.ctx;
    const tool = s.drawTool;
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.drawSize;
    
    if (tool === 'pen') {
        ctx.strokeStyle = s.drawColor;
        ctx.globalAlpha = 1;
    } else if (tool === 'highlighter') {
        ctx.strokeStyle = s.drawColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = s.drawSize * 2;
    } else if (tool === 'marker') {
        ctx.strokeStyle = s.drawColor;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = s.drawSize * 1.5;
    } else if (tool === 'eraser') {
        // ยางลบ — วาดบนรูปจะลบสิ่งที่วาดไว้ (ทำเป็นสีพื้น) — ใช้ destination-out
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = s.drawSize * 1.5;
    }
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
}

function leDrawShape(from, to) {
    const s = window.leState;
    const ctx = s.ctx;
    const tool = s.drawTool;
    
    ctx.save();
    ctx.strokeStyle = s.drawColor;
    ctx.lineWidth = s.drawSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    } else if (tool === 'arrow') {
        // วาดเส้นตรง + หัวลูกศร
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headSize = s.drawSize * 4;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headSize * Math.cos(angle - Math.PI / 6),
                   to.y - headSize * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headSize * Math.cos(angle + Math.PI / 6),
                   to.y - headSize * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    } else if (tool === 'rect-shape') {
        ctx.strokeRect(
            Math.min(from.x, to.x), Math.min(from.y, to.y),
            Math.abs(to.x - from.x), Math.abs(to.y - from.y)
        );
    } else if (tool === 'circle-shape') {
        const cx = (from.x + to.x) / 2;
        const cy = (from.y + to.y) / 2;
        const rx = Math.abs(to.x - from.x) / 2;
        const ry = Math.abs(to.y - from.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.restore();
}

// ==========================================
// 🌟 STICKER / EMOJI
// ==========================================
const LE_EMOJI_CATEGORIES = {
    general: ['🎉','🎊','🔥','💯','⭐','✨','💫','⚡','💥','🎁','🎯','🎪','🎨','🎭','🎬','🎮','🏆','🏅','🥇','🏵️','🎀','🎈','🎂','💝'],
    promo:   ['🆕','🆓','💎','👑','🏷️','🛍️','🛒','💸','💵','💴','💷','💶','🤑','💲','🎟️','🎫','🆙','🔝','📢','📣','📯','🔔','🚨','⚠️'],
    arrows:  ['⬆️','⬇️','⬅️','➡️','↗️','↘️','↙️','↖️','🔼','🔽','◀️','▶️','🔄','🔃','🔁','🔂','↩️','↪️','⤴️','⤵️','➰','➿','➕','➖'],
    status:  ['✅','❌','✔️','❎','☑️','🆗','🆖','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','💚','💛','🧡','❤️','💙','💜','🖤','🤍'],
    money:   ['💰','💴','💵','💶','💷','💸','💳','🪙','🤑','💹','📈','📉','📊','💎','🏦','🪪','🧾','🎰','🎲','🎴','♠️','♥️','♦️','♣️']
};

function leRenderEmojiPickers() {
    Object.entries(LE_EMOJI_CATEGORIES).forEach(([cat, emojis]) => {
        const containerId = 'leEmoji' + cat.charAt(0).toUpperCase() + cat.slice(1);
        const container = document.getElementById(containerId);
        if (!container || container._rendered) return;
        container._rendered = true;
        container.innerHTML = emojis.map(e => `
            <button onclick="leAddSticker('${e}')" class="le-shape-btn rounded p-1.5 text-xl hover:scale-110 transition" title="${e}">${e}</button>
        `).join('');
    });
}

window.leAddSticker = function(emoji) {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'กรุณาเลือกรูปก่อน', 'warning');
    
    const size = Math.min(s.canvas.width, s.canvas.height) * 0.1;
    const obj = {
        id: 'st_' + Date.now(),
        emoji,
        x: s.canvas.width / 2,
        y: s.canvas.height / 2,
        size
    };
    s.stickerObjects.push(obj);
    leRenderAllStickers();
    leUpdateStickerList();
    leShowTip('🌟 วางสติกเกอร์แล้ว — ลากย้ายตำแหน่งได้', 2500);
};

function leRenderAllStickers() {
    const container = document.getElementById('leTextOverlayContainer');
    if (!container) return;
    container.querySelectorAll('.le-sticker-overlay').forEach(e => e.remove());
    const scale = leTotalScale();
    window.leState.stickerObjects.forEach(obj => {
        if (obj.visible === false) return;
        const div = document.createElement('div');
        div.className = 'le-sticker-overlay le-text-overlay' + (obj.id === window.leState.selectedStickerId ? ' selected' : '');
        div.dataset.id = obj.id;
        div.dataset.type = 'sticker';
        div.style.left = (obj.x * scale) + 'px';
        div.style.top = (obj.y * scale) + 'px';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.fontSize = (obj.size * scale) + 'px';
        div.style.lineHeight = '1';
        div.style.pointerEvents = 'auto';
        div.innerText = obj.emoji;
        container.appendChild(div);
    });
}

function leUpdateStickerList() {
    const wrap = document.getElementById('leStickerList');
    const list = document.getElementById('leStickerItems');
    const count = document.getElementById('leStickerCount');
    if (wrap && list) {
        const items = window.leState.stickerObjects;
        if (items.length === 0) {
            wrap.classList.add('hidden');
        } else {
            wrap.classList.remove('hidden');
            if (count) count.innerText = items.length;
            list.innerHTML = items.map(o => `
                <div class="flex items-center gap-2 bg-yellow-950/30 border border-yellow-900/40 rounded p-1.5">
                    <span class="text-lg">${o.emoji}</span>
                    <div class="flex-1 text-[10px] text-yellow-200">
                        <input type="range" min="20" max="500" value="${o.size}" oninput="leUpdateStickerSize('${o.id}', this.value)" class="w-full le-slider">
                    </div>
                    <button onclick="leDeleteSticker('${o.id}')" class="text-rose-400 hover:bg-rose-500/20 p-0.5 rounded">
                        <span class="material-icons text-xs">close</span>
                    </button>
                </div>
            `).join('');
        }
    }
    if (typeof leLayerRefresh === 'function') leLayerRefresh();
}

window.leUpdateStickerSize = function(id, val) {
    const obj = window.leState.stickerObjects.find(o => o.id === id);
    if (obj) {
        obj.size = parseInt(val);
        leRenderAllStickers();
    }
};

window.leDeleteSticker = function(id) {
    window.leState.stickerObjects = window.leState.stickerObjects.filter(o => o.id !== id);
    leRenderAllStickers();
    leUpdateStickerList();
};

function leClearAllStickers() {
    window.leState.stickerObjects = [];
    leRenderAllStickers();
    leUpdateStickerList();
}

// แก้ text drag handler ให้รองรับ sticker ด้วย
function leSetupStickerDragging() {
    // sticker ใช้ container เดียวกับ text — drag handler เดิมรองรับเฉพาะ text 
    // เราจะเพิ่ม handler ที่เช็ค dataset.type
    const container = document.getElementById('leTextOverlayContainer');
    if (!container || container._stickerSetup) return;
    container._stickerSetup = true;
    
    let dragId = null, dragType = null, dragStart = null, startPos = null;
    
    const onDown = (e) => {
        const el = e.target.closest('.le-text-overlay');
        if (!el) return;
        dragId = el.dataset.id;
        dragType = el.dataset.type === 'sticker' ? 'sticker' : 'text';
        
        let obj;
        if (dragType === 'sticker') {
            obj = window.leState.stickerObjects.find(o => o.id === dragId);
            window.leState.selectedStickerId = dragId;
        } else {
            obj = window.leState.textObjects.find(o => o.id === dragId);
            window.leState.selectedTextId = dragId;
        }
        if (!obj) return;
        
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        dragStart = { x: cx, y: cy };
        startPos = { x: obj.x, y: obj.y };
        
        if (dragType === 'sticker') leRenderAllStickers();
        else leRenderAllTextOverlays();
        e.preventDefault();
        e.stopPropagation();
    };
    const onMove = (e) => {
        if (!dragId) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const scale = leTotalScale();
        let obj;
        if (dragType === 'sticker') obj = window.leState.stickerObjects.find(o => o.id === dragId);
        else obj = window.leState.textObjects.find(o => o.id === dragId);
        if (!obj) return;
        obj.x = startPos.x + (cx - dragStart.x) / scale;
        obj.y = startPos.y + (cy - dragStart.y) / scale;
        if (dragType === 'sticker') leRenderAllStickers();
        else leRenderAllTextOverlays();
        e.preventDefault();
    };
    const onUp = () => { dragId = null; dragType = null; };
    
    container.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('touchstart', onDown, {passive: false});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onUp);
}

// ==========================================
// 🔍 RESIZE IMAGE
// ==========================================
function leUpdateResizeInfo() {
    const s = window.leState;
    const current = document.getElementById('leCurrentSize');
    if (current && s.canvas) {
        current.innerText = `${s.canvas.width} × ${s.canvas.height} px`;
    }
    leUpdateResizePreview();
}

window.leSetResizePercent = function(pct) {
    document.getElementById('leResizePercent').value = pct;
    leUpdateResizePreview();
};

window.leUpdateResizePreview = function() {
    const s = window.leState;
    const pct = parseInt(document.getElementById('leResizePercent')?.value || 100);
    const label = document.getElementById('leResizePercentLabel');
    const newSize = document.getElementById('leNewSize');
    if (label) label.innerText = pct + '%';
    if (newSize && s.canvas) {
        const nw = Math.round(s.canvas.width * pct / 100);
        const nh = Math.round(s.canvas.height * pct / 100);
        newSize.innerText = `${nw} × ${nh} px`;
    }
};

window.leApplyResize = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    const pct = parseInt(document.getElementById('leResizePercent')?.value || 100);
    if (pct === 100) return Swal.fire('!', 'ขนาดเท่าเดิม ไม่ต้องปรับ', 'info');
    
    const newW = Math.round(s.canvas.width * pct / 100);
    const newH = Math.round(s.canvas.height * pct / 100);
    
    if (newW > 8000 || newH > 8000) {
        return Swal.fire('!', 'ขนาดใหญ่เกินไป (max 8000px)', 'warning');
    }
    
    leSaveHistory();
    
    const smooth = document.getElementById('leSmoothResize')?.checked !== false;
    const tmp = document.createElement('canvas');
    tmp.width = newW;
    tmp.height = newH;
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = smooth;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(s.canvas, 0, 0, newW, newH);
    
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.canvas.width = newW;
        s.canvas.height = newH;
        s.ctx.drawImage(newImg, 0, 0);
        leFitScreen();
        leUpdateResizeInfo();
        Swal.fire({ icon: 'success', title: `ปรับขนาดเป็น ${newW}×${newH}`, timer: 1200, showConfirmButton: false });
    };
    newImg.src = tmp.toDataURL('image/png');
};

// ==========================================
// 🎨 LOGO SPLITTER — แยกโลโก้เป็นชิ้น แก้ไขทีละชิ้น
// ==========================================

window.leLoadLogoForSplit = function(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    
    // ถ้ายังไม่ได้เลือกไฟล์ (กดปุ่ม label) → ให้ trigger click ที่ input
    if (!file) {
        if (event && event.target && event.target.querySelector) {
            const input = event.target.querySelector('input[type="file"]') || 
                          event.target.closest('label')?.querySelector('input[type="file"]');
            if (input) input.click();
        }
        return;
    }
    
    if (!file.type || !file.type.startsWith('image/')) {
        Swal.fire('ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูป', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.leState.splitSource = img;
            window.leState.splitParts = [];
            window.leState.selectedPartId = null;
            window.leState.splitMode = true;
            
            // ใส่รูปลง canvas เป็น base
            const s = window.leState;
            s.baseImage = img;
            s.canvas.width = img.width;
            s.canvas.height = img.height;
            s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
            s.ctx.drawImage(img, 0, 0);
            
            document.getElementById('leEmptyState')?.classList.add('hidden');
            document.getElementById('leCanvasWrapper')?.classList.remove('hidden');
            document.getElementById('leZoomControls')?.classList.remove('hidden');
            document.getElementById('leSplitSettings')?.classList.remove('hidden');
            
            leFitScreen();
            leShowTip('💡 ปรับค่าแล้วกด "แยกชิ้นเลย"', 3500);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.leSplitLogoNow = async function() {
    const s = window.leState;
    if (!s.splitSource) return Swal.fire('!', 'กรุณาเลือกโลโก้ก่อน', 'warning');
    
    const progress = document.getElementById('leSplitProgress');
    const status = document.getElementById('leSplitStatus');
    progress?.classList.remove('hidden');
    
    if (status) status.innerText = 'กำลังอ่านสีในรูป...';
    
    // ใช้ setTimeout เพื่อให้ UI update ก่อนทำงานหนัก
    await new Promise(r => setTimeout(r, 50));
    
    try {
        const tolerance = parseInt(document.getElementById('leSplitTolerance').value);
        const minSize = parseInt(document.getElementById('leSplitMinSize').value);
        const ignoreBg = document.getElementById('leSplitIgnoreBg').checked;
        
        if (status) status.innerText = 'กำลังแยกชิ้นด้วย flood-fill...';
        await new Promise(r => setTimeout(r, 50));
        
        const parts = leSplitImageIntoParts(s.splitSource, tolerance, minSize, ignoreBg);
        
        if (parts.length === 0) {
            progress?.classList.add('hidden');
            return Swal.fire('!', 'แยกชิ้นไม่ได้ — ลองลด "ขนาดชิ้นขั้นต่ำ" หรือเพิ่ม "ความใกล้เคียงสี"', 'info');
        }
        
        s.splitParts = parts;
        
        // วาด canvas ใหม่ — ใส่ทุกชิ้นกลับเข้าไป
        leSplitRenderToCanvas();
        leSplitRefresh();
        
        progress?.classList.add('hidden');
        document.getElementById('leSplitPartsContainer')?.classList.remove('hidden');
        document.getElementById('leSplitMerge')?.classList.remove('hidden');
        
        Swal.fire({ icon: 'success', title: `แยกได้ ${parts.length} ชิ้น`, text: 'คลิกที่ชิ้นบนรูปเพื่อแก้ไข', timer: 2000, showConfirmButton: false });
        leShowTip('🎯 คลิกที่ชิ้นบนรูปหรือเลือกจากรายการเพื่อแก้ไข', 4000);
    } catch(err) {
        console.error('Split error:', err);
        progress?.classList.add('hidden');
        Swal.fire('ผิดพลาด', err.message || 'แยกชิ้นไม่สำเร็จ', 'error');
    }
};

// ==========================================
// Algorithm หลัก: flood-fill แยกชิ้น
// ==========================================
function leSplitImageIntoParts(img, tolerance, minSize, ignoreBg) {
    const W = img.width, H = img.height;
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(img, 0, 0);
    const imgData = tctx.getImageData(0, 0, W, H);
    const data = imgData.data;
    
    // หา bg color จากมุม (ถ้า ignoreBg)
    let bgR = -1, bgG = -1, bgB = -1;
    if (ignoreBg) {
        const corners = [[0,0], [W-1,0], [0,H-1], [W-1,H-1]];
        let r=0, g=0, b=0;
        corners.forEach(([x,y]) => {
            const i = (y * W + x) * 4;
            r += data[i]; g += data[i+1]; b += data[i+2];
        });
        bgR = r / 4; bgG = g / 4; bgB = b / 4;
    }
    
    const visited = new Uint8Array(W * H);
    const parts = [];
    
    // Helper: เช็คว่า pixel นี้เป็นพื้นหลังไหม
    const isBg = (idx) => {
        if (data[idx+3] < 30) return true; // โปร่งใส = bg
        if (!ignoreBg) return false;
        const dr = data[idx] - bgR;
        const dg = data[idx+1] - bgG;
        const db = data[idx+2] - bgB;
        return Math.sqrt(dr*dr + dg*dg + db*db) < tolerance;
    };
    
    // เช็คว่า 2 pixel สีใกล้กันไหม
    const sameColor = (i1, i2) => {
        const dr = data[i1] - data[i2];
        const dg = data[i1+1] - data[i2+1];
        const db = data[i1+2] - data[i2+2];
        return Math.sqrt(dr*dr + dg*dg + db*db) < tolerance;
    };
    
    // BFS flood-fill จาก seed
    function floodFill(startX, startY) {
        const startIdx = (startY * W + startX) * 4;
        const startR = data[startIdx], startG = data[startIdx+1], startB = data[startIdx+2];
        
        const queue = [[startX, startY]];
        const pixels = [];  // [{x, y}]
        let minX = startX, maxX = startX, minY = startY, maxY = startY;
        
        while (queue.length > 0) {
            const [x, y] = queue.pop();
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const vIdx = y * W + x;
            if (visited[vIdx]) continue;
            const dIdx = vIdx * 4;
            if (isBg(dIdx)) continue;
            
            // เช็คสีใกล้เคียง seed
            const dr = data[dIdx] - startR;
            const dg = data[dIdx+1] - startG;
            const db = data[dIdx+2] - startB;
            if (Math.sqrt(dr*dr + dg*dg + db*db) > tolerance) continue;
            
            visited[vIdx] = 1;
            pixels.push([x, y]);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            
            // 4-connected neighbors
            queue.push([x+1, y]);
            queue.push([x-1, y]);
            queue.push([x, y+1]);
            queue.push([x, y-1]);
        }
        
        return { pixels, minX, maxX, minY, maxY, color: { r: startR, g: startG, b: startB } };
    }
    
    // Scan ทั้งรูป — เจอ pixel ที่ยังไม่ได้เยี่ยม + ไม่ใช่ bg → flood-fill
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const vIdx = y * W + x;
            if (visited[vIdx]) continue;
            const dIdx = vIdx * 4;
            if (isBg(dIdx)) {
                visited[vIdx] = 1;
                continue;
            }
            
            const result = floodFill(x, y);
            if (result.pixels.length < minSize) continue;
            
            // สร้าง mask ImageData (ขนาดเท่า bbox)
            const bw = result.maxX - result.minX + 1;
            const bh = result.maxY - result.minY + 1;
            const maskData = new Uint8ClampedArray(bw * bh * 4);
            
            // pixel ใน part = สีนั้น (alpha 255), pixel นอก = โปร่งใส (alpha 0)
            result.pixels.forEach(([px, py]) => {
                const lx = px - result.minX;
                const ly = py - result.minY;
                const lIdx = (ly * bw + lx) * 4;
                const oIdx = (py * W + px) * 4;
                maskData[lIdx]   = data[oIdx];
                maskData[lIdx+1] = data[oIdx+1];
                maskData[lIdx+2] = data[oIdx+2];
                maskData[lIdx+3] = 255;
            });
            
            parts.push({
                id: 'p_' + Date.now() + '_' + parts.length,
                originalColor: '#' + [result.color.r, result.color.g, result.color.b]
                    .map(c => Math.round(c).toString(16).padStart(2, '0')).join(''),
                currentColor: '#' + [result.color.r, result.color.g, result.color.b]
                    .map(c => Math.round(c).toString(16).padStart(2, '0')).join(''),
                originalMask: maskData,    // mask ดั้งเดิม (มีสีต้นฉบับ)
                bbox: { x: result.minX, y: result.minY, w: bw, h: bh },
                originalBbox: { x: result.minX, y: result.minY, w: bw, h: bh },
                scale: 1,
                dx: 0,                      // offset ย้ายตำแหน่ง
                dy: 0,
                replaceText: null,          // ถ้าตั้งค่า = ใช้ตัวอักษรแทน
                visible: true,
                pixelCount: result.pixels.length
            });
        }
    }
    
    // เรียงจากชิ้นใหญ่ → เล็ก
    parts.sort((a, b) => b.pixelCount - a.pixelCount);
    return parts;
}

// ==========================================
// วาดทุก part ลง canvas
// ==========================================
function leSplitRenderToCanvas() {
    const s = window.leState;
    if (!s.splitSource) return;
    
    const ctx = s.ctx;
    ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    
    // วาดพื้นหลัง (สีพื้น/transparent)
    // ใช้สีมุมของรูปต้นฉบับเป็นพื้น
    const tmp = document.createElement('canvas');
    tmp.width = s.splitSource.width;
    tmp.height = s.splitSource.height;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(s.splitSource, 0, 0);
    try {
        const corner = tctx.getImageData(0, 0, 1, 1).data;
        ctx.fillStyle = `rgba(${corner[0]},${corner[1]},${corner[2]},${corner[3]/255})`;
        ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
    } catch(e) {}
    
    // วาดแต่ละ part
    s.splitParts.forEach(part => {
        if (!part.visible) return;
        leDrawPart(ctx, part);
    });
    
    // highlight ชิ้นที่เลือก
    if (s.selectedPartId) {
        const p = s.splitParts.find(x => x.id === s.selectedPartId);
        if (p) {
            ctx.save();
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 4]);
            const bx = p.originalBbox.x + p.dx;
            const by = p.originalBbox.y + p.dy;
            const bw = p.originalBbox.w * p.scale;
            const bh = p.originalBbox.h * p.scale;
            ctx.strokeRect(bx - 5, by - 5, bw + 10, bh + 10);
            ctx.restore();
        }
    }
}

function leDrawPart(ctx, part) {
    // ถ้ามี replaceText → วาดเป็นตัวอักษร
    if (part.replaceText) {
        ctx.save();
        const bx = part.originalBbox.x + part.dx;
        const by = part.originalBbox.y + part.dy;
        const bw = part.originalBbox.w * part.scale;
        const bh = part.originalBbox.h * part.scale;
        
        // ใช้ฟอนต์หนา สีตาม currentColor
        const fontSize = bh * 0.95;
        ctx.font = `900 ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = part.currentColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(part.replaceText, bx + bw / 2, by + bh / 2);
        ctx.restore();
        return;
    }
    
    // สร้าง offscreen canvas จาก mask
    const off = document.createElement('canvas');
    off.width = part.originalBbox.w;
    off.height = part.originalBbox.h;
    const octx = off.getContext('2d');
    
    // ถ้าเปลี่ยนสี → ใช้ mask แล้วเปลี่ยนสีก่อนวาด
    if (part.currentColor !== part.originalColor) {
        // สร้าง mask ใหม่ที่มีสี currentColor
        const newR = parseInt(part.currentColor.slice(1, 3), 16);
        const newG = parseInt(part.currentColor.slice(3, 5), 16);
        const newB = parseInt(part.currentColor.slice(5, 7), 16);
        const recolored = new Uint8ClampedArray(part.originalMask.length);
        for (let i = 0; i < part.originalMask.length; i += 4) {
            if (part.originalMask[i+3] > 0) {
                recolored[i]   = newR;
                recolored[i+1] = newG;
                recolored[i+2] = newB;
                recolored[i+3] = part.originalMask[i+3];
            }
        }
        const imgData = new ImageData(recolored, part.originalBbox.w, part.originalBbox.h);
        octx.putImageData(imgData, 0, 0);
    } else {
        const imgData = new ImageData(
            new Uint8ClampedArray(part.originalMask), 
            part.originalBbox.w, 
            part.originalBbox.h
        );
        octx.putImageData(imgData, 0, 0);
    }
    
    // วาดลง main canvas พร้อม scale + offset
    const bx = part.originalBbox.x + part.dx;
    const by = part.originalBbox.y + part.dy;
    const bw = part.originalBbox.w * part.scale;
    const bh = part.originalBbox.h * part.scale;
    
    // ใช้ smoothing เพื่อให้ scale แล้วไม่แตก
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, bx, by, bw, bh);
}

// ==========================================
// UI: รายการ parts
// ==========================================
function leSplitRefresh() {
    const container = document.getElementById('leSplitPartsList');
    const countEl = document.getElementById('leSplitCount');
    if (!container) return;
    
    const parts = window.leState.splitParts;
    if (countEl) countEl.innerText = parts.length;
    
    if (parts.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-slate-500 text-xs">ยังไม่ได้แยกชิ้น</div>';
        return;
    }
    
    container.innerHTML = parts.map((p, idx) => {
        const isSel = p.id === window.leState.selectedPartId;
        return `
        <div onclick="leSplitSelectPart('${p.id}')" class="cursor-pointer bg-slate-800/50 hover:bg-pink-950/40 ${isSel ? 'ring-2 ring-pink-500 bg-pink-950/50' : ''} border border-white/10 rounded-lg p-2 flex items-center gap-2 transition">
            <div class="w-8 h-8 rounded border border-white/20 flex-shrink-0" style="background:${p.currentColor}"></div>
            <div class="flex-1 min-w-0">
                <div class="text-[11px] font-bold text-white">ชิ้นที่ ${idx + 1}${p.replaceText ? ' "' + p.replaceText + '"' : ''}</div>
                <div class="text-[9px] text-slate-400">${p.originalBbox.w}×${p.originalBbox.h}px • ${p.pixelCount.toLocaleString()} pixels</div>
            </div>
            <div class="flex gap-0.5">
                <button onclick="event.stopPropagation(); leSplitToggleVisible('${p.id}')" class="${p.visible ? 'text-emerald-400' : 'text-slate-500'} hover:bg-white/10 p-1 rounded">
                    <span class="material-icons text-sm">${p.visible ? 'visibility' : 'visibility_off'}</span>
                </button>
            </div>
        </div>`;
    }).join('');
}

window.leSplitSelectPart = function(id) {
    window.leState.selectedPartId = id;
    const part = window.leState.splitParts.find(p => p.id === id);
    if (!part) return;
    
    // โชว์ editor
    document.getElementById('leSplitEditor')?.classList.remove('hidden');
    
    // sync UI
    const colorInput = document.getElementById('leSplitColor');
    if (colorInput) colorInput.value = part.currentColor;
    document.getElementById('leSplitColorLabel').innerText = part.currentColor;
    document.getElementById('leSplitScale').value = Math.round(part.scale * 100);
    document.getElementById('leSplitScaleLabel').innerText = Math.round(part.scale * 100) + '%';
    document.getElementById('leSplitReplaceText').value = part.replaceText || '';
    
    leSplitRenderToCanvas();
    leSplitRefresh();
};

window.leSplitChangeColor = function(color) {
    const s = window.leState;
    const part = s.splitParts.find(p => p.id === s.selectedPartId);
    if (!part) return;
    part.currentColor = color;
    document.getElementById('leSplitColor').value = color;
    document.getElementById('leSplitColorLabel').innerText = color;
    leSplitRenderToCanvas();
    leSplitRefresh();
};

window.leSplitChangeScale = function(val) {
    const s = window.leState;
    const part = s.splitParts.find(p => p.id === s.selectedPartId);
    if (!part) return;
    part.scale = parseInt(val) / 100;
    document.getElementById('leSplitScaleLabel').innerText = val + '%';
    leSplitRenderToCanvas();
};

window.leSplitReplaceWithText = function() {
    const s = window.leState;
    const part = s.splitParts.find(p => p.id === s.selectedPartId);
    if (!part) return;
    const text = document.getElementById('leSplitReplaceText').value;
    part.replaceText = text || null;
    leSplitRenderToCanvas();
    leSplitRefresh();
};

window.leSplitDuplicate = function() {
    const s = window.leState;
    const part = s.splitParts.find(p => p.id === s.selectedPartId);
    if (!part) return;
    const dup = JSON.parse(JSON.stringify(part));
    dup.id = 'p_' + Date.now();
    dup.dx = part.dx + 30;
    dup.dy = part.dy + 30;
    // clone mask
    dup.originalMask = new Uint8ClampedArray(part.originalMask);
    s.splitParts.push(dup);
    s.selectedPartId = dup.id;
    leSplitRenderToCanvas();
    leSplitRefresh();
};

window.leSplitDeletePart = function() {
    const s = window.leState;
    s.splitParts = s.splitParts.filter(p => p.id !== s.selectedPartId);
    s.selectedPartId = null;
    document.getElementById('leSplitEditor')?.classList.add('hidden');
    leSplitRenderToCanvas();
    leSplitRefresh();
};

window.leSplitToggleVisible = function(id) {
    const part = window.leState.splitParts.find(p => p.id === id);
    if (part) {
        part.visible = !part.visible;
        leSplitRenderToCanvas();
        leSplitRefresh();
    }
};

// คลิกที่ canvas → เลือกชิ้น (ใช้เฉพาะแท็บ split)
function leSplitHandleCanvasClick(e) {
    const s = window.leState;
    if (s.currentTab !== 'split' || !s.splitMode || s.splitParts.length === 0) return false;
    
    const rect = s.canvas.getBoundingClientRect();
    const scale = leTotalScale();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const px = (cx - rect.left) / scale;
    const py = (cy - rect.top) / scale;
    
    // หา part ที่อยู่ตรงนั้น (ค้นจากบนสุดลงล่าง)
    for (let i = s.splitParts.length - 1; i >= 0; i--) {
        const p = s.splitParts[i];
        if (!p.visible) continue;
        const bx = p.originalBbox.x + p.dx;
        const by = p.originalBbox.y + p.dy;
        const bw = p.originalBbox.w * p.scale;
        const bh = p.originalBbox.h * p.scale;
        if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
            // เช็คให้แม่นขึ้น — เป็น pixel ของ part จริงๆ ไหม
            if (p.replaceText) {
                leSplitSelectPart(p.id);
                return true;
            }
            const localX = Math.floor((px - bx) / p.scale);
            const localY = Math.floor((py - by) / p.scale);
            if (localX >= 0 && localX < p.originalBbox.w && localY >= 0 && localY < p.originalBbox.h) {
                const idx = (localY * p.originalBbox.w + localX) * 4;
                if (p.originalMask[idx + 3] > 30) {
                    leSplitSelectPart(p.id);
                    return true;
                }
            }
        }
    }
    return false;
}

// ==========================================
// Drag/Move ชิ้นที่เลือก
// ==========================================
function leSplitHandleCanvasMouseDown(e) {
    const s = window.leState;
    if (s.currentTab !== 'split' || !s.splitMode) return false;
    
    // เช็คก่อนว่าคลิกที่ชิ้นไหน
    if (!leSplitHandleCanvasClick(e)) return false;
    
    // ถ้าคลิกเลือกชิ้นได้แล้ว → เตรียม drag
    s._splitDragging = true;
    const rect = s.canvas.getBoundingClientRect();
    const scale = leTotalScale();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    s._splitDragStart = {
        mouseX: (cx - rect.left) / scale,
        mouseY: (cy - rect.top) / scale
    };
    const part = s.splitParts.find(p => p.id === s.selectedPartId);
    if (part) {
        s._splitDragStart.dx = part.dx;
        s._splitDragStart.dy = part.dy;
    }
    return true;
}

function leSplitHandleCanvasMouseMove(e) {
    const s = window.leState;
    if (!s._splitDragging) return false;
    e.preventDefault();
    const part = s.splitParts.find(p => p.id === s.selectedPartId);
    if (!part) return false;
    
    const rect = s.canvas.getBoundingClientRect();
    const scale = leTotalScale();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const newX = (cx - rect.left) / scale;
    const newY = (cy - rect.top) / scale;
    
    part.dx = s._splitDragStart.dx + (newX - s._splitDragStart.mouseX);
    part.dy = s._splitDragStart.dy + (newY - s._splitDragStart.mouseY);
    leSplitRenderToCanvas();
    return true;
}

function leSplitHandleCanvasMouseUp() {
    window.leState._splitDragging = false;
}

// ==========================================
// Finalize — รวมทุก part เป็นรูปเดียว ออกจาก split mode
// ==========================================
window.leSplitFinalize = async function() {
    const s = window.leState;
    if (s.splitParts.length === 0) return Swal.fire('!', 'ยังไม่มีชิ้นให้รวม', 'warning');
    
    const ok = await Swal.fire({
        title: 'รวมเป็นโลโก้ใหม่?',
        text: 'ทุกชิ้นจะถูกรวมเป็นรูปเดียว — แก้ทีละชิ้นไม่ได้อีก',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่ รวมเลย',
        cancelButtonText: 'ยกเลิก'
    });
    if (!ok.isConfirmed) return;
    
    // วาดทุก part ลง canvas (ยกเลิก highlight)
    s.selectedPartId = null;
    leSplitRenderToCanvas();
    
    // เก็บ canvas เป็น Image ใหม่
    const dataUrl = s.canvas.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.splitMode = false;
        s.splitParts = [];
        s.splitSource = null;
        s.selectedPartId = null;
        
        document.getElementById('leSplitPartsContainer')?.classList.add('hidden');
        document.getElementById('leSplitEditor')?.classList.add('hidden');
        document.getElementById('leSplitMerge')?.classList.add('hidden');
        document.getElementById('leSplitSettings')?.classList.add('hidden');
        
        Swal.fire({ icon: 'success', title: '✓ รวมเป็นรูปเดียวแล้ว', text: 'ใช้งานเหมือนรูปทั่วไปได้แล้ว', timer: 1500, showConfirmButton: false });
    };
    newImg.src = dataUrl;
};


window._leAiBgModule = null;

async function leLoadAiBgLibrary() {
    if (window._leAiBgModule) return window._leAiBgModule;
    leUpdateAiProgress(5, 'กำลังโหลด AI library...');
    try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
        window._leAiBgModule = mod;
        return mod;
    } catch (e) {
        console.error('โหลด AI lib ไม่ได้:', e);
        throw new Error('โหลด AI library ไม่สำเร็จ — ตรวจสอบเน็ต');
    }
}

function leUpdateAiProgress(pct, text) {
    document.getElementById('leAiBgProgress')?.classList.remove('hidden');
    const bar = document.getElementById('leAiBgBar');
    const status = document.getElementById('leAiBgStatus');
    if (bar) bar.style.width = pct + '%';
    if (status) status.innerText = text;
}

function leHideAiProgress() {
    document.getElementById('leAiBgProgress')?.classList.add('hidden');
}

window.leAiRemoveBg = async function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'กรุณาเลือกรูปก่อน', 'warning');
    
    const btn = document.getElementById('leAiBgBtn');
    if (btn) btn.disabled = true;
    
    try {
        leSaveHistory();
        const mod = await leLoadAiBgLibrary();
        leUpdateAiProgress(15, 'เตรียมข้อมูลรูปภาพ...');
        const blob = await new Promise(r => s.canvas.toBlob(r, 'image/png'));
        leUpdateAiProgress(30, 'AI กำลังประมวลผล... (10-30 วินาที)');
        
        const config = {
            progress: (key, current, total) => {
                const p = 30 + (current / total) * 60;
                leUpdateAiProgress(Math.min(90, p), 'AI: ' + key);
            }
        };
        
        const resultBlob = await mod.removeBackground(blob, config);
        leUpdateAiProgress(95, 'กำลังวาดผลลัพธ์...');
        
        const url = URL.createObjectURL(resultBlob);
        const img = new Image();
        img.onload = () => {
            s.canvas.width = img.width;
            s.canvas.height = img.height;
            s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
            s.ctx.drawImage(img, 0, 0);
            s._aiBgResultImg = img;
            URL.revokeObjectURL(url);
            leUpdateAiProgress(100, '✓ เสร็จแล้ว!');
            
            document.getElementById('leAiKeepBtn')?.classList.remove('hidden');
            document.getElementById('leAiBgWhiteBtn')?.classList.remove('hidden');
            document.getElementById('leAiBgBlackBtn')?.classList.remove('hidden');
            document.getElementById('leAiBgCustomColor')?.classList.remove('hidden');
            document.getElementById('leAiBgCustomLabel')?.classList.remove('hidden');
            
            setTimeout(() => leHideAiProgress(), 1500);
            Swal.fire({ icon: 'success', title: 'ลบพื้นหลังสำเร็จ', timer: 1500, showConfirmButton: false });
        };
        img.src = url;
    } catch (err) {
        console.error('AI BG error:', err);
        leHideAiProgress();
        Swal.fire('ผิดพลาด', err.message || 'AI ลบพื้นหลังไม่สำเร็จ', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.leAiBgKeepSubject = function() {
    Swal.fire({ icon: 'success', title: 'พื้นโปร่งใสพร้อมใช้งาน', timer: 1000, showConfirmButton: false });
};

window.leAiBgChangeBg = function(color) {
    const s = window.leState;
    if (!s._aiBgResultImg) return Swal.fire('!', 'ต้องลบพื้นด้วย AI ก่อน', 'warning');
    leSaveHistory();
    s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    s.ctx.fillStyle = color;
    s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
    s.ctx.drawImage(s._aiBgResultImg, 0, 0);
    Swal.fire({ icon: 'success', title: 'เปลี่ยนพื้นแล้ว', timer: 800, showConfirmButton: false });
};

// ==========================================
// 📦 TEMPLATE SYSTEM
// ==========================================
window.leApplyTemplate = async function(templateId) {
    const s = window.leState;
    const confirmed = await Swal.fire({
        title: 'เริ่มจาก Template นี้?',
        text: 'รูปปัจจุบันและ layer ทั้งหมดจะถูกแทนที่',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่ เริ่มเลย',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#a855f7'
    });
    if (!confirmed.isConfirmed) return;
    
    s.history = [];
    s.textObjects = [];
    s.stickerObjects = [];
    leRemoveLogo();
    leClearPendingLogo();
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateTextList();
    leUpdateStickerList();
    
    const templates = {
        promo_square:   { w: 1080, h: 1080, bg: 'gradient', c1: '#a855f7', c2: '#ec4899' },
        story_vertical: { w: 1080, h: 1920, bg: 'gradient', c1: '#f59e0b', c2: '#dc2626' },
        fb_post:        { w: 1200, h: 1500, bg: 'gradient', c1: '#3b82f6', c2: '#0891b2' },
        yt_thumb:       { w: 1280, h: 720,  bg: 'gradient', c1: '#dc2626', c2: '#7f1d1d' },
        deposit_alert:  { w: 1080, h: 1080, bg: 'gradient', c1: '#1e293b', c2: '#0f172a', preset: 'deposit_alert' },
        promo_credit:   { w: 1080, h: 1080, bg: 'gradient', c1: '#f59e0b', c2: '#dc2626', preset: 'promo_credit' },
        how_to_3step:   { w: 1920, h: 1080, bg: 'gradient', c1: '#0f172a', c2: '#1e293b', preset: 'how_to' },
        qr_template:    { w: 1080, h: 1080, bg: 'solid',    c1: '#ffffff', preset: 'qr_template' },
        warning:        { w: 1080, h: 1080, bg: 'gradient', c1: '#f59e0b', c2: '#dc2626', preset: 'warning' },
        bg_purple:      { w: 1080, h: 1080, bg: 'gradient', c1: '#a21caf', c2: '#581c87' },
        bg_blue:        { w: 1080, h: 1080, bg: 'gradient', c1: '#3b82f6', c2: '#1e3a8a' },
        bg_orange:      { w: 1080, h: 1080, bg: 'gradient', c1: '#f59e0b', c2: '#dc2626' },
        bg_green:       { w: 1080, h: 1080, bg: 'gradient', c1: '#10b981', c2: '#0f766e' },
        bg_pink:        { w: 1080, h: 1080, bg: 'gradient', c1: '#f472b6', c2: '#be185d' },
        bg_dark:        { w: 1080, h: 1080, bg: 'gradient', c1: '#475569', c2: '#0f172a' }
    };
    
    const tpl = templates[templateId];
    if (!tpl) return;
    
    const tmp = document.createElement('canvas');
    tmp.width = tpl.w;
    tmp.height = tpl.h;
    const tctx = tmp.getContext('2d');
    
    if (tpl.bg === 'gradient') {
        const grad = tctx.createLinearGradient(0, 0, tpl.w, tpl.h);
        grad.addColorStop(0, tpl.c1);
        grad.addColorStop(1, tpl.c2);
        tctx.fillStyle = grad;
    } else {
        tctx.fillStyle = tpl.c1;
    }
    tctx.fillRect(0, 0, tpl.w, tpl.h);
    
    if (tpl.preset === 'warning') {
        tctx.save();
        tctx.fillStyle = 'rgba(0,0,0,0.3)';
        const stripeW = 60;
        for (let i = -tpl.h; i < tpl.w; i += stripeW * 2) {
            tctx.beginPath();
            tctx.moveTo(i, tpl.h);
            tctx.lineTo(i + stripeW, tpl.h);
            tctx.lineTo(i + tpl.h + stripeW, 0);
            tctx.lineTo(i + tpl.h, 0);
            tctx.closePath();
            tctx.fill();
        }
        tctx.restore();
    }
    
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.canvas.width = tpl.w;
        s.canvas.height = tpl.h;
        s.ctx.clearRect(0, 0, tpl.w, tpl.h);
        s.ctx.drawImage(newImg, 0, 0);
        
        const ts = Date.now();
        if (tpl.preset === 'deposit_alert') {
            s.textObjects.push({ id: 't_'+ts+'_1', text: '⚠️ แจ้งเตือน', x: tpl.w/2, y: tpl.h*0.2, fontSize: 80, font: "'Kanit', sans-serif", color: '#ef4444', weight: '900', stroke: 4, strokeColor: '#ffffff', shadow: true });
            s.textObjects.push({ id: 't_'+ts+'_2', text: 'ยอดฝากไม่เข้าระบบ', x: tpl.w/2, y: tpl.h*0.4, fontSize: 56, font: "'Sarabun', sans-serif", color: '#ffffff', weight: '700', stroke: 0, strokeColor: '#000', shadow: true });
            s.textObjects.push({ id: 't_'+ts+'_3', text: 'กรุณาส่งสลิปให้แอดมิน', x: tpl.w/2, y: tpl.h*0.55, fontSize: 40, font: "'Sarabun', sans-serif", color: '#fbbf24', weight: '700', stroke: 0, strokeColor: '#000', shadow: false });
        } else if (tpl.preset === 'promo_credit') {
            s.textObjects.push({ id: 't_'+ts+'_1', text: '🎁 รับเครดิตฟรี', x: tpl.w/2, y: tpl.h*0.25, fontSize: 84, font: "'Kanit', sans-serif", color: '#ffffff', weight: '900', stroke: 5, strokeColor: '#7c2d12', shadow: true });
            s.textObjects.push({ id: 't_'+ts+'_2', text: '36.8 บาท', x: tpl.w/2, y: tpl.h*0.5, fontSize: 140, font: "'Kanit', sans-serif", color: '#fbbf24', weight: '900', stroke: 6, strokeColor: '#7c2d12', shadow: true });
            s.textObjects.push({ id: 't_'+ts+'_3', text: 'สำหรับสมาชิกใหม่', x: tpl.w/2, y: tpl.h*0.7, fontSize: 50, font: "'Sarabun', sans-serif", color: '#ffffff', weight: '700', stroke: 0, strokeColor: '#000', shadow: false });
        } else if (tpl.preset === 'how_to') {
            for (let i = 1; i <= 3; i++) {
                const x = tpl.w * (i / 4);
                s.textObjects.push({ id: 't_'+ts+'_n'+i, text: i+'', x, y: tpl.h*0.35, fontSize: 180, font: "'Kanit', sans-serif", color: '#fbbf24', weight: '900', stroke: 8, strokeColor: '#ffffff', shadow: true });
                s.textObjects.push({ id: 't_'+ts+'_s'+i, text: 'ขั้นตอนที่ '+i, x, y: tpl.h*0.65, fontSize: 40, font: "'Sarabun', sans-serif", color: '#ffffff', weight: '700', stroke: 0, strokeColor: '#000', shadow: true });
            }
        } else if (tpl.preset === 'qr_template') {
            s.textObjects.push({ id: 't_'+ts+'_1', text: 'สแกน QR เพื่อชำระ', x: tpl.w/2, y: 100, fontSize: 56, font: "'Kanit', sans-serif", color: '#1e293b', weight: '900', stroke: 0, strokeColor: '#000', shadow: false });
            s.textObjects.push({ id: 't_'+ts+'_2', text: '[วาง QR ตรงนี้]', x: tpl.w/2, y: tpl.h/2, fontSize: 40, font: "'Sarabun', sans-serif", color: '#94a3b8', weight: '400', stroke: 0, strokeColor: '#000', shadow: false });
        } else if (tpl.preset === 'warning') {
            s.textObjects.push({ id: 't_'+ts+'_1', text: '🚨 แจ้งสำคัญ 🚨', x: tpl.w/2, y: tpl.h*0.3, fontSize: 90, font: "'Kanit', sans-serif", color: '#ffffff', weight: '900', stroke: 6, strokeColor: '#7c2d12', shadow: true });
            s.textObjects.push({ id: 't_'+ts+'_2', text: 'พิมพ์ข้อความที่นี่', x: tpl.w/2, y: tpl.h*0.55, fontSize: 50, font: "'Sarabun', sans-serif", color: '#fef3c7', weight: '700', stroke: 0, strokeColor: '#000', shadow: true });
        }
        
        document.getElementById('leEmptyState')?.classList.add('hidden');
        document.getElementById('leCanvasWrapper')?.classList.remove('hidden');
        document.getElementById('leZoomControls')?.classList.remove('hidden');
        
        leFitScreen();
        leRenderAllTextOverlays();
        leUpdateTextList();
        leLayerRefresh();
        
        Swal.fire({ icon: 'success', title: '✨ Template พร้อม!', timer: 1200, showConfirmButton: false });
    };
    newImg.src = tmp.toDataURL('image/png');
};

// ==========================================
// 📎 LAYER SYSTEM
// ==========================================
function leGetAllLayers() {
    const s = window.leState;
    const layers = [];
    if (s.baseImage) {
        layers.push({ id: 'base', type: 'base', name: 'รูปต้นฉบับ', icon: 'image', iconColor: 'text-fuchsia-400', visible: true, locked: true });
    }
    s.textObjects.forEach(t => {
        layers.push({ id: t.id, type: 'text', name: t.text.length > 25 ? t.text.substring(0, 25) + '...' : t.text, icon: 'text_fields', iconColor: 'text-cyan-400', visible: t.visible !== false, locked: false });
    });
    s.stickerObjects.forEach(st => {
        layers.push({ id: st.id, type: 'sticker', name: 'สติกเกอร์ ' + st.emoji, icon: 'emoji_emotions', iconColor: 'text-yellow-400', visible: st.visible !== false, locked: false });
    });
    if (s.newLogo) {
        layers.push({ id: 'newlogo', type: 'logo', name: 'โลโก้ใหม่', icon: 'add_photo_alternate', iconColor: 'text-emerald-400', visible: s.logoOverlay.opacity > 0, locked: false });
    }
    return layers;
}

window.leLayerRefresh = function() {
    const container = document.getElementById('leLayerListContainer');
    if (!container) return;
    const layers = leGetAllLayers();
    if (layers.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs"><span class="material-icons text-3xl opacity-50">layers_clear</span><p class="mt-1">ยังไม่มี layer</p></div>`;
        return;
    }
    container.innerHTML = layers.slice().reverse().map((l) => {
        const visIcon = l.visible ? 'visibility' : 'visibility_off';
        const visClass = l.visible ? 'text-emerald-400' : 'text-slate-500';
        return `
        <div class="bg-slate-800/50 hover:bg-slate-800/80 border border-white/10 rounded-lg p-2 flex items-center gap-2 transition">
            <span class="material-icons ${l.iconColor} text-base">${l.icon}</span>
            <div class="flex-1 min-w-0">
                <div class="text-[11px] font-bold text-white truncate">${l.name}</div>
                <div class="text-[9px] text-slate-400">${l.type}${l.locked ? ' • locked' : ''}</div>
            </div>
            <div class="flex gap-0.5">
                <button onclick="leLayerToggleVisibility('${l.id}', '${l.type}')" class="${visClass} hover:bg-white/10 p-1 rounded"><span class="material-icons text-sm">${visIcon}</span></button>
                ${!l.locked ? `
                    <button onclick="leLayerMoveUp('${l.id}', '${l.type}')" class="text-slate-400 hover:bg-white/10 p-1 rounded"><span class="material-icons text-sm">arrow_upward</span></button>
                    <button onclick="leLayerMoveDown('${l.id}', '${l.type}')" class="text-slate-400 hover:bg-white/10 p-1 rounded"><span class="material-icons text-sm">arrow_downward</span></button>
                    <button onclick="leLayerDuplicate('${l.id}', '${l.type}')" class="text-blue-400 hover:bg-blue-500/20 p-1 rounded"><span class="material-icons text-sm">content_copy</span></button>
                    <button onclick="leLayerDelete('${l.id}', '${l.type}')" class="text-rose-400 hover:bg-rose-500/20 p-1 rounded"><span class="material-icons text-sm">delete</span></button>
                ` : `<span class="text-slate-600 p-1"><span class="material-icons text-sm">lock</span></span>`}
            </div>
        </div>`;
    }).join('');
};

window.leLayerToggleVisibility = function(id, type) {
    const s = window.leState;
    if (type === 'text') {
        const obj = s.textObjects.find(o => o.id === id);
        if (obj) obj.visible = obj.visible === false ? true : false;
    } else if (type === 'sticker') {
        const obj = s.stickerObjects.find(o => o.id === id);
        if (obj) obj.visible = obj.visible === false ? true : false;
    } else if (type === 'logo' && id === 'newlogo') {
        s.logoOverlay.opacity = s.logoOverlay.opacity > 0 ? 0 : 1;
        leUpdateLogoOverlayPosition();
    }
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leLayerRefresh();
};

window.leLayerMoveUp = function(id, type) {
    const s = window.leState;
    const arr = type === 'text' ? s.textObjects : (type === 'sticker' ? s.stickerObjects : null);
    if (!arr) return;
    const i = arr.findIndex(o => o.id === id);
    if (i >= 0 && i < arr.length - 1) [arr[i], arr[i+1]] = [arr[i+1], arr[i]];
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leLayerRefresh();
};

window.leLayerMoveDown = function(id, type) {
    const s = window.leState;
    const arr = type === 'text' ? s.textObjects : (type === 'sticker' ? s.stickerObjects : null);
    if (!arr) return;
    const i = arr.findIndex(o => o.id === id);
    if (i > 0) [arr[i], arr[i-1]] = [arr[i-1], arr[i]];
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leLayerRefresh();
};

window.leLayerDuplicate = function(id, type) {
    const s = window.leState;
    if (type === 'text') {
        const obj = s.textObjects.find(o => o.id === id);
        if (obj) s.textObjects.push({ ...obj, id: 't_' + Date.now(), x: obj.x + 30, y: obj.y + 30 });
    } else if (type === 'sticker') {
        const obj = s.stickerObjects.find(o => o.id === id);
        if (obj) s.stickerObjects.push({ ...obj, id: 'st_' + Date.now(), x: obj.x + 30, y: obj.y + 30 });
    }
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateTextList();
    leUpdateStickerList();
    leLayerRefresh();
};

window.leLayerDelete = function(id, type) {
    const s = window.leState;
    if (type === 'text') s.textObjects = s.textObjects.filter(o => o.id !== id);
    else if (type === 'sticker') s.stickerObjects = s.stickerObjects.filter(o => o.id !== id);
    else if (type === 'logo' && id === 'newlogo') leRemoveLogo();
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateTextList();
    leUpdateStickerList();
    leLayerRefresh();
};

window.leLayerClearAll = async function() {
    const ok = await Swal.fire({ title: 'ลบ layer ทั้งหมด?', text: 'ข้อความ/สติกเกอร์/โลโก้ใหม่ จะถูกลบ', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!ok.isConfirmed) return;
    const s = window.leState;
    s.textObjects = [];
    s.stickerObjects = [];
    leRemoveLogo();
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateTextList();
    leUpdateStickerList();
    leLayerRefresh();
};

window.leLayerHideAll = function() {
    const s = window.leState;
    s.textObjects.forEach(o => o.visible = false);
    s.stickerObjects.forEach(o => o.visible = false);
    if (s.newLogo) s.logoOverlay.opacity = 0;
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateLogoOverlayPosition();
    leLayerRefresh();
};

window.leLayerShowAll = function() {
    const s = window.leState;
    s.textObjects.forEach(o => o.visible = true);
    s.stickerObjects.forEach(o => o.visible = true);
    if (s.newLogo && s.logoOverlay.opacity === 0) {
        s.logoOverlay.opacity = 1;
        const slider = document.getElementById('leLogoOpacity');
        if (slider) slider.value = 100;
    }
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateLogoOverlayPosition();
    leLayerRefresh();
};


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
        if (obj.visible === false) return;
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
    
    // 4. sticker overlays
    s.stickerObjects.forEach(obj => {
        if (obj.visible === false) return;
        octx.save();
        octx.font = `${obj.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText(obj.emoji, obj.x, obj.y);
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
