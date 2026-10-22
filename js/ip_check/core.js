let globalIpLogs = [];

let currentIpFilterUser = 'all';

let currentIpTab = 'all';

const IP_PAGE_SIZE = 30;

let ipPages = {
  all: 1,
  changes: 1,
  fp_changes: 1,
  duplicates: 1,
  fp_duplicates: 1,
  by_user: 1,
  risk: 1,
  vpn: 1,
  overlap: 1,
  tzmismatch: 1
};

Object.defineProperty(window, 'ipCurrentPage', {
  get: () => ipPages[currentIpTab] || 1,
  set: v => {
    ipPages[currentIpTab] = v;
  }
});

window.initIpCheckApp = async function() {
  if (!currentUser) return;
  const canView = canPerm('ip_view') || typeof window.hasUserPerm === 'function' && window.hasUserPerm('ip_view');
  if (!canView) {
    const grid = document.getElementById('ipLogsContainer');
    if (grid) grid.innerHTML = `\n            <div class="col-span-full text-center py-20 text-gray-400">\n                <span class="material-icons text-6xl mb-2 opacity-20">block</span>\n                <p class="font-bold">คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้</p>\n            </div>`;
    return;
  }
  await fetchIpLogs();
  populateIpUserFilter();
};

async function fetchIpLogs() {
  const container = document.getElementById('ipLogsContainer');
  if (!container) return;
  container.innerHTML = `\n        <div class="col-span-full text-center py-10">\n            <span class="material-icons animate-spin text-sky-500 text-4xl">sync</span>\n            <p class="text-gray-400 mt-2 font-bold">กำลังโหลดข้อมูล IP & FP...</p>\n        </div>`;
  try {
    const {data: data, error: error} = await appDB.from('user_ip_logs').select('*').order('login_time', {
      ascending: false
    }).limit(1e3);
    if (error) throw error;
    globalIpLogs = data || [];
    renderIpView();
    updateIpSummary();
    renderLiveAlerts();
  } catch (err) {
    container.innerHTML = `<div class="col-span-full text-center text-red-500 py-10 font-bold">โหลดข้อมูลไม่สำเร็จ: ${err.message}</div>`;
  }
}

function populateIpUserFilter() {
  const select = document.getElementById('ipUserFilter');
  if (!select || !window.GLOBAL_USER_LIST) return;
  const oldVal = select.value;
  select.innerHTML = `<option value="all">-- ดูทั้งหมด --</option>`;
  window.GLOBAL_USER_LIST.filter((u => u && u.username)).sort(((a, b) => String(a.username).localeCompare(String(b.username)))).forEach((u => {
    select.innerHTML += `<option value="${u.id}">${window.escapeHtml(u.username)}</option>`;
  }));
  if (oldVal) select.value = oldVal;
}

window.switchIpTab = function(tab) {
  currentIpTab = tab;
  ipPages[tab] = 1;
  document.querySelectorAll('.ip-tab-btn').forEach((b => {
    b.classList.remove('bg-sky-600', 'bg-rose-600', 'bg-fuchsia-600', 'bg-amber-500', 'bg-orange-500', 'bg-emerald-600', 'text-white');
    b.classList.add('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
  }));
  const activeBtn = document.getElementById('ipTab_' + tab);
  if (activeBtn) {
    activeBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
    const colorMap = {
      all: 'bg-sky-600',
      changes: 'bg-rose-600',
      fp_changes: 'bg-fuchsia-600',
      duplicates: 'bg-amber-500',
      fp_duplicates: 'bg-orange-500',
      by_user: 'bg-emerald-600',
      risk: 'bg-slate-700',
      vpn: 'bg-purple-600',
      travel: 'bg-red-600',
      heatmap: 'bg-blue-600',
      timeline: 'bg-indigo-600',
      overlap: 'bg-rose-600',
      tzmismatch: 'bg-cyan-600'
    };
    activeBtn.classList.add(colorMap[tab] || 'bg-sky-600', 'text-white');
  }
  renderIpView();
};

window.filterIpLogs = function() {
  const sel = document.getElementById('ipUserFilter');
  currentIpFilterUser = sel ? sel.value : 'all';
  ipCurrentPage = 1;
  renderIpView();
};

function renderIpView() {
  if (currentIpTab === 'changes') renderIpChanges(); else if (currentIpTab === 'fp_changes') renderFpChanges(); else if (currentIpTab === 'duplicates') renderDuplicateIps(); else if (currentIpTab === 'fp_duplicates') renderDuplicateFps(); else if (currentIpTab === 'by_user') renderByUser(); else if (currentIpTab === 'risk') renderRiskBoard(); else if (currentIpTab === 'vpn') renderVpnDetector(); else if (currentIpTab === 'travel') renderImpossibleTravel(); else if (currentIpTab === 'heatmap') renderLoginHeatmap(); else if (currentIpTab === 'timeline') renderUserTimeline(); else if (currentIpTab === 'overlap') renderSessionOverlap(); else if (currentIpTab === 'tzmismatch') renderTzMismatch(); else renderAllLogs();
}

function eventBadge(type) {
  if (type === 'ip_change') {
    return `<span class="inline-flex items-center gap-1 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">\n                    <span class="material-icons text-[12px]">swap_horiz</span> เปลี่ยน IP\n                </span>`;
  }
  if (type === 'fp_change') {
    return `<span class="inline-flex items-center gap-1 bg-fuchsia-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">\n                    <span class="material-icons text-[12px]">devices</span> เปลี่ยนเครื่อง\n                </span>`;
  }
  return `<span class="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">\n                <span class="material-icons text-[12px]">login</span> Login\n            </span>`;
}

function shortFp(fp) {
  if (!fp) return '-';
  return String(fp).substring(0, 8);
}

function renderAllLogs() {
  const container = document.getElementById('ipLogsContainer');
  if (!container) return;
  let logs = globalIpLogs;
  const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
  if (term) {
    logs = logs.filter((l => (l.username || '').toLowerCase().includes(term) || (l.ip_address || '').toLowerCase().includes(term) || (l.country || '').toLowerCase().includes(term) || (l.city || '').toLowerCase().includes(term) || (l.fingerprint || '').toLowerCase().includes(term)));
  }
  if (currentIpFilterUser !== 'all') {
    logs = logs.filter((l => String(l.user_id) === String(currentIpFilterUser)));
  }
  if (logs.length === 0) {
    container.innerHTML = `\n            <div class="col-span-full flex flex-col items-center py-20 text-gray-400">\n                <span class="material-icons text-6xl mb-2 opacity-20">wifi_off</span>\n                <p class="font-bold">ยังไม่มีข้อมูล IP</p>\n            </div>`;
    return;
  }
  const ipUserMap = {};
  const fpUserMap = {};
  globalIpLogs.forEach((l => {
    if (l.ip_address) {
      if (!ipUserMap[l.ip_address]) ipUserMap[l.ip_address] = new Set;
      ipUserMap[l.ip_address].add(l.user_id);
    }
    if (l.fingerprint) {
      if (!fpUserMap[l.fingerprint]) fpUserMap[l.fingerprint] = new Set;
      fpUserMap[l.fingerprint].add(l.user_id);
    }
  }));
  const totalPages = Math.max(1, Math.ceil(logs.length / IP_PAGE_SIZE));
  if (ipCurrentPage > totalPages) ipCurrentPage = totalPages;
  if (ipCurrentPage < 1) ipCurrentPage = 1;
  const startIdx = (ipCurrentPage - 1) * IP_PAGE_SIZE;
  const pagedLogs = logs.slice(startIdx, startIdx + IP_PAGE_SIZE);
  container.innerHTML = `\n        <div class="col-span-full overflow-x-auto rounded-xl shadow-md">\n            <table class="min-w-full bg-white dark:bg-slate-800 text-sm">\n                <thead class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">\n                    <tr>\n                        <th class="px-3 py-2 text-left">เวลา</th>\n                        <th class="px-3 py-2 text-left">ประเภท</th>\n                        <th class="px-3 py-2 text-left">พนักงาน</th>\n                        <th class="px-3 py-2 text-left">IP Address</th>\n                        <th class="px-3 py-2 text-left">FP (อุปกรณ์)</th>\n                        <th class="px-3 py-2 text-left">ประเทศ / เมือง</th>\n                        <th class="px-3 py-2 text-left">ISP</th>\n                        <th class="px-3 py-2 text-left">อุปกรณ์</th>\n                        <th class="px-3 py-2 text-center">จัดการ</th>\n                    </tr>\n                </thead>\n                <tbody>\n                    ${pagedLogs.map((l => {
    const sharedIpCount = (ipUserMap[l.ip_address] || new Set).size;
    const sharedFpCount = (fpUserMap[l.fingerprint] || new Set).size;
    const isSharedIp = sharedIpCount > 1;
    const isSharedFp = sharedFpCount > 1;
    const isIpChange = l.event_type === 'ip_change';
    const isFpChange = l.event_type === 'fp_change';
    const time = l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '-';
    const device = parseUserAgent(l.user_agent || '');
    let rowClass = '';
    if (isFpChange) rowClass = 'bg-fuchsia-50 dark:bg-fuchsia-900/20'; else if (isIpChange) rowClass = 'bg-rose-50 dark:bg-rose-900/20'; else if (isSharedFp) rowClass = 'bg-orange-50 dark:bg-orange-900/20'; else if (isSharedIp) rowClass = 'bg-amber-50 dark:bg-amber-900/20';
    return `\n                            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${rowClass}">\n                                <td class="px-3 py-2 text-xs">${time}</td>\n                                <td class="px-3 py-2">${eventBadge(l.event_type)}</td>\n                                <td class="px-3 py-2 font-bold text-slate-800 dark:text-white">${window.escapeHtml(l.username || '-')}</td>\n                                <td class="px-3 py-2">\n                                    <span class="font-mono text-xs ${isSharedIp ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-200'}">${l.ip_address || '-'}</span>\n                                    ${isSharedIp ? `<span class="ml-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">⚠ ${sharedIpCount} คน</span>` : ''}\n                                </td>\n                                <td class="px-3 py-2">\n                                    ${l.fingerprint ? `\n                                        <span class="font-mono text-xs ${isSharedFp ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-indigo-600 dark:text-indigo-300'}" title="${l.fingerprint}">${shortFp(l.fingerprint)}</span>\n                                        ${isSharedFp ? `<span class="ml-1 text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full">⚠ ${sharedFpCount} คน</span>` : ''}\n                                    ` : '<span class="text-gray-400 text-xs">-</span>'}\n                                </td>\n                                <td class="px-3 py-2 text-xs">${window.escapeHtml(l.country || '-')} / ${window.escapeHtml(l.city || '-')}</td>\n                                <td class="px-3 py-2 text-xs text-gray-500">${window.escapeHtml(l.isp || '-')}</td>\n                                <td class="px-3 py-2 text-xs text-gray-500">${device}</td>\n                                <td class="px-3 py-2 text-center">\n                                    <button onclick="deleteIpLog(${l.id})" class="text-red-400 hover:text-red-600" title="ลบ">\n                                        <span class="material-icons text-base">delete</span>\n                                    </button>\n                                </td>\n                            </tr>`;
  })).join('')}\n                </tbody>\n            </table>\n        </div>\n        ${totalPages > 1 ? renderIpPagination(totalPages, logs.length) : ''}`;
}

function renderIpPagination(totalPages, totalItems, tabKey) {
  tabKey = tabKey || currentIpTab;
  const cur = ipPages[tabKey] || 1;
  let pages = [];
  const addPage = p => {
    const active = p === cur;
    pages.push(`<button onclick="gotoIpPage(${p},'${tabKey}')" class="min-w-[36px] h-9 px-2 rounded-lg text-sm font-bold transition ${active ? 'bg-sky-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-gray-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-slate-600'}">${p}</button>`);
  };
  const addDots = () => pages.push(`<span class="px-1 text-gray-400">...</span>`);
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) addPage(p);
  } else {
    addPage(1);
    if (cur > 3) addDots();
    const from = Math.max(2, cur - 1);
    const to = Math.min(totalPages - 1, cur + 1);
    for (let p = from; p <= to; p++) addPage(p);
    if (cur < totalPages - 2) addDots();
    addPage(totalPages);
  }
  const prevDisabled = cur <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-sky-50 dark:hover:bg-slate-600';
  const nextDisabled = cur >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-sky-50 dark:hover:bg-slate-600';
  return `\n        <div class="col-span-full flex items-center justify-between flex-wrap gap-3 mt-2 px-1">\n            <div class="text-xs text-gray-500 dark:text-gray-400 font-bold">\n                หน้า ${cur} / ${totalPages} (ทั้งหมด ${totalItems} รายการ)\n            </div>\n            <div class="flex items-center gap-1">\n                <button onclick="gotoIpPage(${cur - 1},'${tabKey}')" ${cur <= 1 ? 'disabled' : ''} class="h-9 px-3 rounded-lg text-sm font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-gray-200 dark:border-slate-600 transition ${prevDisabled} flex items-center gap-1">\n                    <span class="material-icons text-base">chevron_left</span> ก่อนหน้า\n                </button>\n                ${pages.join('')}\n                <button onclick="gotoIpPage(${cur + 1},'${tabKey}')" ${cur >= totalPages ? 'disabled' : ''} class="h-9 px-3 rounded-lg text-sm font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-gray-200 dark:border-slate-600 transition ${nextDisabled} flex items-center gap-1">\n                    ถัดไป <span class="material-icons text-base">chevron_right</span>\n                </button>\n            </div>\n        </div>`;
}

window.gotoIpPage = function(page, tabKey) {
  tabKey = tabKey || currentIpTab;
  ipPages[tabKey] = page;
  renderIpView();
  const container = document.getElementById('ipLogsContainer');
  if (container) container.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
};
