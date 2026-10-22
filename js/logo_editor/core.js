window.leState = {
  canvas: null,
  ctx: null,
  baseImage: null,
  newLogo: null,
  pendingLogo: null,
  history: [],
  mode: 'magic',
  currentTab: 'replace',
  shape: 'rect',
  isDrawingSelection: false,
  selStart: null,
  lassoPoints: [],
  selBox: null,
  zoom: 1,
  logoOverlay: {
    x: 50,
    y: 50,
    w: 120,
    h: 120,
    opacity: 1
  },
  textObjects: [],
  selectedTextId: null,
  filtersBaked: {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    hue: 0,
    blur: 0
  },
  cropMode: false,
  cropBox: null,
  cropRatio: 'free',
  isBrushing: false,
  drawMode: false,
  drawTool: 'pen',
  drawColor: '#ef4444',
  drawSize: 8,
  drawingShape: false,
  drawStart: null,
  drawSnapshot: null,
  stickerObjects: [],
  selectedStickerId: null,
  splitMode: false,
  logoRecolor: {
    enabled: false,
    pickMode: false
  },
  originalLogo: null
};

function leTotalScale() {
  return window.leState.zoom || 1;
}

function leEnsureInit() {
  if (window.leState.canvas && window.leState.ctx) return true;
  const cvs = document.getElementById('leCanvas');
  if (!cvs) return false;
  window.leState.canvas = cvs;
  window.leState.ctx = cvs.getContext('2d', {
    willReadFrequently: true
  });
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
  const isAdminOrMgr = false;
  const can = perm => isAdminOrMgr || typeof window.hasUserPerm === 'function' && window.hasUserPerm(perm);
  window.leCanErase = can('logo_editor_erase');
  window.leCanAddLogo = can('logo_editor_add_logo');
  window.leCanDownload = can('logo_editor_download');
  const eraseSection = document.getElementById('leEraseSection');
  const addLogoSection = document.getElementById('leAddLogoSection');
  const downloadBtn = document.getElementById('leDownloadBtn');
  if (eraseSection) eraseSection.style.display = window.leCanErase ? '' : 'none';
  if (addLogoSection) addLogoSection.style.display = window.leCanAddLogo ? '' : 'none';
  if (downloadBtn) downloadBtn.style.display = window.leCanDownload ? '' : 'none';
  leSetupKeyboardShortcuts();
};

function leSetupKeyboardShortcuts() {
  if (window._leShortcutsSetup) return;
  window._leShortcutsSetup = true;
  document.addEventListener('keydown', (e => {
    const app = document.getElementById('logoEditorApp');
    if (!app || app.classList.contains('hidden')) return;
    const target = e.target;
    const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (!isTyping) {
        e.preventDefault();
        if (typeof window.leUndoLast === 'function') window.leUndoLast();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (typeof window.leDownload === 'function') window.leDownload();
    } else if (e.key === 'Escape') {
      if (window.leState.cropMode) {
        e.preventDefault();
        if (typeof window.leCancelCrop === 'function') window.leCancelCrop();
      }
    } else if (e.key === 'Delete' && window.leState.selectedTextId && !isTyping) {
      e.preventDefault();
      window.leDeleteText(window.leState.selectedTextId);
      window.leState.selectedTextId = null;
    }
  }));
}

window.leSwitchTab = function(tab) {
  window.leState.currentTab = tab;
  const allTabs = [ 'replace', 'aibg', 'split', 'template', 'text', 'draw', 'sticker', 'layer', 'color', 'adjust', 'resize', 'watermark' ];
  allTabs.forEach((t => {
    const btn = document.getElementById('leTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const content = document.getElementById('leTabContent_' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (content) content.classList.toggle('hidden', t !== tab);
  }));
  if (tab !== 'draw' && window.leState.drawMode) leToggleDrawMode();
  if (tab === 'resize') leUpdateResizeInfo();
  if (tab === 'sticker') leRenderEmojiPickers();
  if (tab === 'layer') leLayerRefresh();
  if (tab === 'split' && typeof leSplitRefresh === 'function') leSplitRefresh();
};

window.leSetMode = function(mode) {
  window.leState.mode = mode;
  document.getElementById('leModeMagic')?.classList.toggle('active', mode === 'magic');
  document.getElementById('leModeManual')?.classList.toggle('active', mode === 'manual');
  document.getElementById('leModeBrush')?.classList.toggle('active', mode === 'brush');
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

window.leLoadBaseImage = function(event) {
  if (!leEnsureInit()) return;
  const file = event.target ? event.target.files[0] : event;
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    Swal.fire('ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพ', 'warning');
    return;
  }
  const reader = new FileReader;
  reader.onload = e => {
    const img = new Image;
    img.onload = () => {
      window.leState.baseImage = img;
      window.leState.history = [];
      window.leState.newLogo = null;
      window.leState.selBox = null;
      window.leState.lassoPoints = [];
      window.leState.textObjects = [];
      leResetFilters(false);
      leRenderBase();
      leRemoveLogo();
      leClearAllText();
      leClearAllStickers();
      document.getElementById('leEmptyState')?.classList.add('hidden');
      document.getElementById('leCanvasWrapper')?.classList.remove('hidden');
      document.getElementById('leZoomControls')?.classList.remove('hidden');
      requestAnimationFrame((() => {
        requestAnimationFrame((() => {
          leFitScreen();
        }));
      }));
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
  leApplyFilters();
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
  window.leState.zoom = Math.max(.1, window.leState.zoom / 1.25);
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
  if (s.zoom < .1) s.zoom = .1;
  leApplyCanvasScale();
};

window.addEventListener('resize', (() => {
  if (window.leState && window.leState.baseImage) leApplyCanvasScale();
}));

function leShowTip(text, duration) {
  const bar = document.getElementById('leTipBar');
  const txt = document.getElementById('leTipText');
  if (!bar || !txt) return;
  txt.innerText = text;
  bar.classList.remove('hidden');
  if (duration) {
    clearTimeout(window._leTipTimer);
    window._leTipTimer = setTimeout((() => bar.classList.add('hidden')), duration);
  }
}

window.leSetShape = function(shape) {
  window.leState.shape = shape;
  [ 'rect', 'ellipse', 'circle', 'lasso' ].forEach((name => {
    const el = document.getElementById('leShape' + name.charAt(0).toUpperCase() + name.slice(1));
    if (el) el.classList.toggle('active', name === shape);
  }));
};

function leSetupDragDropFile() {
  const area = document.getElementById('leCanvasArea');
  if (!area || area._dropSetup) return;
  area._dropSetup = true;
  area.addEventListener('dragover', (e => {
    e.preventDefault();
    area.classList.add('ring-4', 'ring-fuchsia-400/50');
  }));
  area.addEventListener('dragleave', (() => area.classList.remove('ring-4', 'ring-fuchsia-400/50')));
  area.addEventListener('drop', (e => {
    e.preventDefault();
    area.classList.remove('ring-4', 'ring-fuchsia-400/50');
    if (e.dataTransfer.files.length > 0) leLoadBaseImage(e.dataTransfer.files[0]);
  }));
}
