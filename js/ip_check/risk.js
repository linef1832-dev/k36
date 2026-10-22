const VPN_ISP_KEYWORDS = [ 'vpn', 'proxy', 'hosting', 'datacenter', 'data center', 'digitalocean', 'linode', 'vultr', 'hetzner', 'ovh', 'cloudflare', 'amazon', 'google cloud', 'microsoft azure', 'fastly', 'leaseweb', 'choopa', 'as-choopa', 'multacom', 'psychz', 'quadranet', 'tzulo', 'buyvm', 'frantech', 'm247', 'mullvad', 'nordvpn', 'expressvpn', 'torguard', 'hidemyass', 'privateinternetaccess', 'surfshark', 'cyberghost' ];

function calcRiskScore(u) {
  let score = 0;
  const reasons = [];
  const ipCount = Object.keys(u.ips || {}).length;
  const fpCount = Object.keys(u.fps || {}).length;
  const countries = new Set(Object.values(u.ips || {}).map((i => i.country)).filter((c => c && c !== '-')));
  if (u.fpChanges > 0) {
    score += u.fpChanges * 30;
    reasons.push(`🔴 สลับเครื่อง ${u.fpChanges} ครั้ง`);
  }
  if (u.ipChanges > 0) {
    score += u.ipChanges * 15;
    reasons.push(`🟠 เปลี่ยน IP ${u.ipChanges} ครั้ง`);
  }
  if (fpCount > 1) {
    score += (fpCount - 1) * 20;
    reasons.push(`🟠 ใช้ ${fpCount} เครื่อง`);
  }
  if (ipCount > 2) {
    score += (ipCount - 2) * 8;
    reasons.push(`🟡 ใช้ ${ipCount} IP`);
  }
  if (countries.size > 1) {
    score += countries.size * 25;
    reasons.push(`🔴 ${countries.size} ประเทศ: ${[ ...countries ].join(', ')}`);
  }
  const isps = Object.values(u.ips || {}).map((i => (i.isp || '').toLowerCase()));
  const vpnHits = isps.filter((isp => VPN_ISP_KEYWORDS.some((k => isp.includes(k)))));
  if (vpnHits.length > 0) {
    score += 40;
    reasons.push(`🔴 ISP น่าสงสัย (VPN/Datacenter)`);
  }
  const oddHour = (u.allTimes || []).filter((t => {
    const h = new Date(t).getHours();
    return h >= 1 && h <= 5;
  })).length;
  if (oddHour > 0) {
    score += oddHour * 5;
    reasons.push(`🟡 Login ดึก/ตี ${oddHour} ครั้ง`);
  }
  let level = 'low';
  if (score >= 60) level = 'critical'; else if (score >= 30) level = 'high'; else if (score >= 10) level = 'medium';
  return {
    score: score,
    level: level,
    reasons: reasons
  };
}

window.renderRiskBoard = function() {
  const container = document.getElementById('ipLogsContainer');
  if (!container) return;
  const userMap = {};
  globalIpLogs.forEach((l => {
    if (!l.user_id) return;
    if (!userMap[l.user_id]) {
      userMap[l.user_id] = {
        user_id: l.user_id,
        username: l.username,
        ips: {},
        fps: {},
        ipChanges: 0,
        fpChanges: 0,
        allTimes: [],
        lastSeen: l.login_time,
        logs: []
      };
    }
    const u = userMap[l.user_id];
    if (l.ip_address) {
      if (!u.ips[l.ip_address]) {
        u.ips[l.ip_address] = {
          country: l.country,
          city: l.city,
          isp: l.isp,
          asn: l.asn,
          timezone: l.timezone,
          firstSeen: l.login_time,
          lastSeen: l.login_time,
          count: 0
        };
      }
      u.ips[l.ip_address].count++;
      if (l.login_time > u.ips[l.ip_address].lastSeen) u.ips[l.ip_address].lastSeen = l.login_time;
    }
    if (l.fingerprint) {
      if (!u.fps[l.fingerprint]) {
        u.fps[l.fingerprint] = {
          fp: l.fingerprint,
          device: parseUserAgent(l.user_agent || ''),
          ua: l.user_agent,
          firstSeen: l.login_time,
          count: 0
        };
      }
      u.fps[l.fingerprint].count++;
    }
    if (l.event_type === 'ip_change') u.ipChanges++;
    if (l.event_type === 'fp_change') u.fpChanges++;
    if (l.login_time) u.allTimes.push(l.login_time);
    if (l.login_time > u.lastSeen) u.lastSeen = l.login_time;
    u.logs.push(l);
  }));
  const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
  let users = Object.values(userMap);
  if (term) users = users.filter((u => (u.username || '').toLowerCase().includes(term)));
  users = users.map((u => ({
    ...u,
    ...calcRiskScore(u)
  }))).sort(((a, b) => b.score - a.score));
  const levelColor = {
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-500',
      badge: 'bg-red-500',
      label: '🔴 วิกฤต'
    },
    high: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-500',
      badge: 'bg-orange-500',
      label: '🟠 สูง'
    },
    medium: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-500',
      badge: 'bg-yellow-500',
      label: '🟡 กลาง'
    },
    low: {
      bg: 'bg-slate-50 dark:bg-slate-800',
      border: 'border-slate-300',
      badge: 'bg-slate-400',
      label: '🟢 ปกติ'
    }
  };
  const _tc = Math.max(1, Math.ceil(users.length / IP_PAGE_SIZE));
  const _p = Math.min(Math.max(1, ipPages.risk || 1), _tc);
  ipPages.risk = _p;
  const paged = users.slice((_p - 1) * IP_PAGE_SIZE, _p * IP_PAGE_SIZE);
  const suspicious = users.filter((u => u.level !== 'low')).length;
  container.innerHTML = `\n        <div class="col-span-full mb-3 p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 text-white flex items-center justify-between flex-wrap gap-3">\n            <div>\n                <div class="font-black text-lg">🏆 Risk Score Board</div>\n                <div class="text-xs opacity-75">คำนวณจาก: FP เปลี่ยน × 30 | IP เปลี่ยน × 15 | หลายเครื่อง × 20 | VPN × 40 | หลายประเทศ × 25</div>\n            </div>\n            <div class="flex gap-3">\n                <div class="text-center"><div class="text-2xl font-black text-red-400">${users.filter((u => u.level === 'critical')).length}</div><div class="text-[10px] opacity-75">วิกฤต</div></div>\n                <div class="text-center"><div class="text-2xl font-black text-orange-400">${users.filter((u => u.level === 'high')).length}</div><div class="text-[10px] opacity-75">สูง</div></div>\n                <div class="text-center"><div class="text-2xl font-black text-yellow-400">${users.filter((u => u.level === 'medium')).length}</div><div class="text-[10px] opacity-75">กลาง</div></div>\n                <div class="text-center"><div class="text-2xl font-black text-green-400">${users.filter((u => u.level === 'low')).length}</div><div class="text-[10px] opacity-75">ปกติ</div></div>\n            </div>\n        </div>\n        ${paged.map(((u, i) => {
    const c = levelColor[u.level];
    const rank = (_p - 1) * IP_PAGE_SIZE + i + 1;
    const ipList = Object.entries(u.ips).slice(0, 3);
    const fpList = Object.entries(u.fps).slice(0, 3);
    return `\n            <div class="col-span-full ${c.bg} rounded-2xl shadow p-4 border-l-4 ${c.border}">\n                <div class="flex items-start justify-between gap-3 flex-wrap">\n                    <div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition" onclick="showRiskDetail('${u.user_id}')">\n                        <div class="text-2xl font-black text-slate-400 w-8">#${rank}</div>\n                        <div>\n                            <div class="font-black text-lg text-slate-800 dark:text-white underline decoration-dotted">${window.escapeHtml(u.username)}</div>\n                            <div class="text-[10px] text-gray-500">เข้าล่าสุด: ${new Date(u.lastSeen).toLocaleString('th-TH')} • ${u.allTimes.length} ครั้ง</div>\n                        </div>\n                    </div>\n                    <div class="flex items-center gap-3">\n                        <div class="text-3xl font-black ${u.level === 'critical' ? 'text-red-500' : u.level === 'high' ? 'text-orange-500' : u.level === 'medium' ? 'text-yellow-500' : 'text-slate-400'}">${u.score}</div>\n                        <span class="${c.badge} text-white text-xs font-bold px-3 py-1 rounded-full">${c.label}</span>\n                        <button onclick="showRiskDetail('${u.user_id}')" class="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition flex items-center gap-1">\n                            <span class="material-icons text-base">open_in_new</span> รายละเอียด\n                        </button>\n                    </div>\n                </div>\n                ${u.reasons.length > 0 ? `\n                <div class="mt-3 flex flex-wrap gap-2">\n                    ${u.reasons.map((r => `<span class="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-lg font-bold">${r}</span>`)).join('')}\n                </div>` : '<div class="mt-2 text-xs text-green-500 font-bold">✅ ไม่พบพฤติกรรมผิดปกติ</div>'}\n                <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">\n                    <div class="bg-white/60 dark:bg-slate-700/40 rounded-xl p-3">\n                        <div class="text-[10px] font-bold text-gray-500 uppercase mb-2">🌐 IP ที่ใช้ (${Object.keys(u.ips).length} รายการ)</div>\n                        ${ipList.map((([ip, d]) => `<div class="text-xs mb-1 flex items-center justify-between"><span class="font-mono font-bold text-sky-600 dark:text-sky-400">${ip}</span><span class="text-gray-400">${window.escapeHtml(d.country || '-')} • ${d.count}ครั้ง</span></div>`)).join('')}\n                        ${Object.keys(u.ips).length > 3 ? `<div class="text-[10px] text-gray-400 mt-1">+${Object.keys(u.ips).length - 3} รายการ...</div>` : ''}\n                    </div>\n                    <div class="bg-white/60 dark:bg-slate-700/40 rounded-xl p-3">\n                        <div class="text-[10px] font-bold text-gray-500 uppercase mb-2">📱 เครื่องที่ใช้ (${Object.keys(u.fps).length} เครื่อง)</div>\n                        ${fpList.map((([fp, d]) => `<div class="text-xs mb-1"><span class="font-bold text-indigo-600 dark:text-indigo-400">${d.device}</span> <span class="text-gray-400 font-mono">(${shortFp(fp)})</span></div>`)).join('')}\n                        ${Object.keys(u.fps).length > 3 ? `<div class="text-[10px] text-gray-400 mt-1">+${Object.keys(u.fps).length - 3} เครื่อง...</div>` : ''}\n                    </div>\n                </div>\n            </div>`;
  })).join('')}\n        ${_tc > 1 ? renderIpPagination(_tc, users.length, 'risk') : ''}\n    `;
};

window.renderVpnDetector = function() {
  const container = document.getElementById('ipLogsContainer');
  if (!container) return;
  const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
  let suspects = globalIpLogs.filter((l => {
    const isp = (l.isp || '').toLowerCase();
    return VPN_ISP_KEYWORDS.some((k => isp.includes(k)));
  }));
  if (term) suspects = suspects.filter((l => (l.username || '').toLowerCase().includes(term) || (l.ip_address || '').toLowerCase().includes(term)));
  if (suspects.length === 0) {
    container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-emerald-500">\n            <span class="material-icons text-6xl mb-2">verified_user</span>\n            <p class="font-bold">ไม่พบการใช้ VPN / Proxy / Datacenter IP 🎉</p></div>`;
    return;
  }
  const ipMap = {};
  suspects.forEach((l => {
    if (!ipMap[l.ip_address]) ipMap[l.ip_address] = {
      ip: l.ip_address,
      isp: l.isp,
      country: l.country,
      users: new Set,
      logs: []
    };
    ipMap[l.ip_address].users.add(l.username);
    ipMap[l.ip_address].logs.push(l);
  }));
  const groups = Object.values(ipMap).sort(((a, b) => b.users.size - a.users.size));
  const _tc = Math.max(1, Math.ceil(groups.length / IP_PAGE_SIZE));
  const _p = Math.min(Math.max(1, ipPages.vpn || 1), _tc);
  ipPages.vpn = _p;
  const paged = groups.slice((_p - 1) * IP_PAGE_SIZE, _p * IP_PAGE_SIZE);
  container.innerHTML = `\n        <div class="col-span-full mb-3 bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4 rounded-xl">\n            <div class="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold">\n                <span class="material-icons">vpn_lock</span>\n                <span>พบ ${groups.length} IP ที่น่าสงสัย (VPN / Proxy / Datacenter)</span>\n            </div>\n            <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">ตรวจจากชื่อ ISP ที่มักใช้ซ่อน IP จริง</p>\n        </div>\n        ${paged.map((g => `\n        <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow p-4 border-l-4 border-purple-500">\n            <div class="flex items-center justify-between flex-wrap gap-2 mb-3">\n                <div>\n                    <div class="font-mono font-bold text-lg text-purple-700 dark:text-purple-300">${g.ip}</div>\n                    <div class="text-xs text-gray-500">${window.escapeHtml(g.country || '-')} • ${window.escapeHtml(g.isp)}</div>\n                </div>\n                <span class="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">⚠ VPN/Proxy • ${g.users.size} คน</span>\n            </div>\n            <div class="flex flex-wrap gap-2">\n                ${[ ...g.users ].map((u => `<span class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">${u}</span>`)).join('')}\n            </div>\n        </div>`)).join('')}\n        ${_tc > 1 ? renderIpPagination(_tc, groups.length, 'vpn') : ''}\n    `;
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

window.renderImpossibleTravel = function() {
  const container = document.getElementById('ipLogsContainer');
  if (!container) return;
  const userLogs = {};
  globalIpLogs.forEach((l => {
    if (!l.latitude || !l.longitude) return;
    if (!userLogs[l.user_id]) userLogs[l.user_id] = [];
    userLogs[l.user_id].push(l);
  }));
  Object.values(userLogs).forEach((arr => arr.sort(((a, b) => new Date(a.login_time) - new Date(b.login_time)))));
  const alerts = [];
  Object.values(userLogs).forEach((logs => {
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1], curr = logs[i];
      const distKm = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const diffHr = (new Date(curr.login_time) - new Date(prev.login_time)) / 36e5;
      if (diffHr <= 0) continue;
      const speedKmh = distKm / diffHr;
      if (distKm > 100 && speedKmh > 900) {
        alerts.push({
          username: curr.username,
          prev: prev,
          curr: curr,
          distKm: Math.round(distKm),
          speedKmh: Math.round(speedKmh),
          diffHr: diffHr.toFixed(1)
        });
      }
    }
  }));
  const hasLatLng = globalIpLogs.some((l => l.latitude && l.longitude));
  if (!hasLatLng) {
    container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-slate-400">\n            <span class="material-icons text-6xl mb-2 opacity-30">flight</span>\n            <p class="font-bold">ยังไม่มีข้อมูลพิกัด (lat/lng)</p>\n            <p class="text-xs mt-2 text-center max-w-sm">ข้อมูลพิกัดจะเริ่มเก็บจากนี้ไป หลังจาก login ใหม่ครั้งถัดไป<br>รอสัก 1-2 วันแล้วกลับมาเช็คใหม่</p>\n        </div>`;
    return;
  }
  if (alerts.length === 0) {
    container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-emerald-500">\n            <span class="material-icons text-6xl mb-2">flight_land</span>\n            <p class="font-bold">ไม่พบ Impossible Travel 🎉</p></div>`;
    return;
  }
  const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
  let filtered = alerts;
  if (term) filtered = filtered.filter((a => (a.username || '').toLowerCase().includes(term)));
  container.innerHTML = `\n        <div class="col-span-full mb-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl">\n            <div class="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold">\n                <span class="material-icons">flight</span>\n                <span>พบ ${filtered.length} กรณี Impossible Travel (เดินทางเร็วเกินจริง)</span>\n            </div>\n            <p class="text-xs text-red-600 dark:text-red-400 mt-1">เกณฑ์: ระยะทาง > 100km และความเร็ว > 900 km/h ภายในเวลาเดียวกัน = ไม่ใช่คนเดียวกัน</p>\n        </div>\n        ${filtered.map((a => `\n        <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow p-4 border-l-4 border-red-500">\n            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">\n                <div class="font-black text-lg text-slate-800 dark:text-white">${window.escapeHtml(a.username)}</div>\n                <div class="flex gap-2">\n                    <span class="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">🚀 ${a.speedKmh.toLocaleString()} km/h</span>\n                    <span class="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">📍 ${a.distKm.toLocaleString()} km</span>\n                </div>\n            </div>\n            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">\n                <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">\n                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">จุดเดิม</div>\n                    <div class="font-bold text-slate-800 dark:text-white">${a.prev.country} • ${a.prev.city}</div>\n                    <div class="font-mono text-xs text-slate-500">${a.prev.ip_address}</div>\n                    <div class="text-xs text-gray-400 mt-1">${new Date(a.prev.login_time).toLocaleString('th-TH')}</div>\n                </div>\n                <div class="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 border border-red-200 dark:border-red-700">\n                    <div class="text-[10px] font-bold text-red-500 uppercase mb-1">⚡ จุดใหม่ (${a.diffHr} ชม.ต่อมา)</div>\n                    <div class="font-bold text-red-700 dark:text-red-300">${a.curr.country} • ${a.curr.city}</div>\n                    <div class="font-mono text-xs text-red-500">${a.curr.ip_address}</div>\n                    <div class="text-xs text-red-400 mt-1">${new Date(a.curr.login_time).toLocaleString('th-TH')}</div>\n                </div>\n            </div>\n        </div>`)).join('')}\n    `;
};

window.renderLoginHeatmap = function() {
  const container = document.getElementById('ipLogsContainer');
  if (!container) return;
  const grid = {};
  const days = [ 'อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส' ];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) grid[`${d}_${h}`] = 0;
  const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
  let logs = globalIpLogs;
  if (term) logs = logs.filter((l => (l.username || '').toLowerCase().includes(term)));
  let maxCount = 0;
  logs.forEach((l => {
    if (!l.login_time) return;
    const d = new Date(l.login_time);
    const key = `${d.getDay()}_${d.getHours()}`;
    grid[key] = (grid[key] || 0) + 1;
    if (grid[key] > maxCount) maxCount = grid[key];
  }));
  const cellBg = count => {
    if (count === 0) return '#e2e8f0';
    const ratio = count / maxCount;
    if (ratio >= .8) return '#ef4444';
    if (ratio >= .6) return '#fb923c';
    if (ratio >= .4) return '#facc15';
    if (ratio >= .2) return '#4ade80';
    return '#bbf7d0';
  };
  const isDark = document.documentElement.classList.contains('dark');
  const emptyBg = isDark ? '#334155' : '#e2e8f0';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const subColor = isDark ? '#94a3b8' : '#64748b';
  let html = `\n        <div class="col-span-full rounded-2xl shadow p-5" style="background:${cardBg}">\n            <div style="font-size:18px;font-weight:900;margin-bottom:4px;color:${textColor}">⏰ Login Heatmap</div>\n            <div style="font-size:12px;color:${subColor};margin-bottom:16px">ความหนาแน่นของ login ตามวัน × ชั่วโมง — สีแดง = บ่อยที่สุด</div>\n            <div style="overflow-x:auto">\n                <table style="border-collapse:separate;border-spacing:3px;font-size:10px">\n                    <thead><tr>\n                        <th style="width:24px;color:${subColor}"></th>\n                        ${Array.from({
    length: 24
  }, ((_, h) => `<th style="width:26px;text-align:center;color:${subColor};font-weight:400;font-size:10px">${h}</th>`)).join('')}\n                    </tr></thead>\n                    <tbody>\n                        ${days.map(((day, d) => `\n                        <tr>\n                            <td style="color:${subColor};font-weight:700;padding-right:4px;font-size:11px">${day}</td>\n                            ${Array.from({
    length: 24
  }, ((_, h) => {
    const count = grid[`${d}_${h}`] || 0;
    const isOdd = h >= 1 && h <= 5;
    const bg = count === 0 ? emptyBg : cellBg(count);
    const outline = isOdd && count > 0 ? 'outline:2px solid #f87171;outline-offset:1px' : '';
    return `<td title="${day} ${h}:00 — ${count} ครั้ง${isOdd && count > 0 ? ' ⚠️ ผิดปกติ' : ''}"\n                                    style="width:26px;height:26px;border-radius:4px;background:${bg};${outline};cursor:pointer;transition:opacity .15s"\n                                    onmouseover="this.style.opacity='.7'" onmouseout="this.style.opacity='1'"></td>`;
  })).join('')}\n                        </tr>`)).join('')}\n                    </tbody>\n                </table>\n            </div>\n            <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:10px;color:${subColor}">\n                <span>น้อย</span>\n                <div style="display:flex;gap:3px">\n                    ${[ '#bbf7d0', '#4ade80', '#facc15', '#fb923c', '#ef4444' ].map((c => `<div style="width:16px;height:16px;border-radius:3px;background:${c}"></div>`)).join('')}\n                </div>\n                <span>มาก</span>\n                <span style="margin-left:12px">⭕ = ตี 1-5 (น่าสงสัย)</span>\n                <span style="margin-left:auto;font-weight:700">รวม ${logs.length} login</span>\n            </div>\n        </div>`;
  const oddUsers = {};
  logs.forEach((l => {
    if (!l.login_time) return;
    const h = new Date(l.login_time).getHours();
    if (h >= 1 && h <= 5) {
      if (!oddUsers[l.username]) oddUsers[l.username] = [];
      oddUsers[l.username].push({
        h: h,
        time: l.login_time
      });
    }
  }));
  const oddList = Object.entries(oddUsers).sort(((a, b) => b[1].length - a[1].length));
  if (oddList.length > 0) {
    const warnBg = isDark ? 'rgba(153,27,27,0.2)' : '#fef2f2';
    const warnBorder = '#f87171';
    const warnText = isDark ? '#fca5a5' : '#dc2626';
    html += `\n        <div class="col-span-full rounded-2xl shadow p-4" style="background:${warnBg};border-left:4px solid ${warnBorder}">\n            <div style="font-weight:700;color:${warnText};margin-bottom:10px">⚠️ พนักงานที่ Login ช่วงเวลาผิดปกติ (ตี 1-5)</div>\n            <div style="display:flex;flex-wrap:wrap;gap:8px">\n                ${oddList.map((([name, times]) => `\n                <div style="background:${cardBg};border:1px solid ${warnBorder};border-radius:8px;padding:6px 12px;font-size:13px">\n                    <span style="font-weight:700;color:${textColor}">${name}</span>\n                    <span style="margin-left:8px;color:light-dark(#a00e0e,#ef4444);font-weight:700">${times.length} ครั้ง</span>\n                </div>`)).join('')}\n            </div>\n        </div>`;
  }
  container.innerHTML = html;
};

window.renderUserTimeline = function() {
  const container = document.getElementById('ipLogsContainer');
  if (!container) return;
  const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
  if (!term) {
    container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-slate-400">\n            <span class="material-icons text-6xl mb-2 opacity-30">manage_search</span>\n            <p class="font-bold">พิมพ์ชื่อพนักงานในช่องค้นหาเพื่อดู Timeline</p>\n        </div>`;
    return;
  }
  const logs = globalIpLogs.filter((l => (l.username || '').toLowerCase().includes(term))).sort(((a, b) => new Date(b.login_time) - new Date(a.login_time)));
  if (logs.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400"><p class="font-bold">ไม่พบข้อมูลของ "${term}"</p></div>`;
    return;
  }
  const evColor = {
    login: 'bg-emerald-500',
    ip_change: 'bg-rose-500',
    fp_change: 'bg-fuchsia-500'
  };
  const evLabel = {
    login: '🟢 Login',
    ip_change: '🔴 IP เปลี่ยน',
    fp_change: '🟣 สลับเครื่อง'
  };
  container.innerHTML = `\n        <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow p-5">\n            <div class="font-black text-lg mb-4 text-slate-800 dark:text-white">👤 Timeline: ${logs[0]?.username} (${logs.length} events)</div>\n            <div class="relative">\n                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-600"></div>\n                <div class="space-y-4">\n                    ${logs.map((l => `\n                    <div class="flex gap-4 pl-10 relative">\n                        <div class="absolute left-2.5 w-3 h-3 rounded-full ${evColor[l.event_type] || 'bg-slate-400'} mt-1 ring-2 ring-white dark:ring-slate-800"></div>\n                        <div class="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">\n                            <div class="flex items-center justify-between flex-wrap gap-2">\n                                <span class="text-sm font-bold text-slate-800 dark:text-white">${evLabel[l.event_type] || l.event_type}</span>\n                                <span class="text-xs text-gray-400">${new Date(l.login_time).toLocaleString('th-TH')}</span>\n                            </div>\n                            <div class="mt-1 text-xs text-gray-500 space-y-0.5">\n                                <div>🌐 <span class="font-mono">${l.ip_address || '-'}</span> — ${window.escapeHtml(l.country || '-')} / ${window.escapeHtml(l.city || '-')}</div>\n                                <div>🏢 ${window.escapeHtml(l.isp || '-')}</div>\n                                ${l.fingerprint ? `<div>📱 FP: <span class="font-mono">${shortFp(l.fingerprint)}</span></div>` : ''}\n                                ${l.timezone ? `<div>🕐 Timezone: ${l.timezone}</div>` : ''}\n                                ${l.asn ? `<div>🔌 ASN: ${l.asn}</div>` : ''}\n                            </div>\n                        </div>\n                    </div>`)).join('')}\n                </div>\n            </div>\n        </div>`;
};

window.showRiskDetail = function(userId) {
  const logs = globalIpLogs.filter((l => String(l.user_id) === String(userId))).sort(((a, b) => new Date(b.login_time) - new Date(a.login_time)));
  if (!logs.length) return;
  const u = {
    user_id: userId,
    username: logs[0].username,
    ips: {},
    fps: {},
    ipChanges: 0,
    fpChanges: 0,
    allTimes: [],
    lastSeen: logs[0].login_time
  };
  logs.forEach((l => {
    if (l.ip_address && !u.ips[l.ip_address]) {
      u.ips[l.ip_address] = {
        country: l.country,
        city: l.city,
        isp: l.isp,
        asn: l.asn,
        timezone: l.timezone,
        count: 0,
        lastSeen: l.login_time
      };
    }
    if (l.ip_address) {
      u.ips[l.ip_address].count++;
    }
    if (l.fingerprint && !u.fps[l.fingerprint]) {
      u.fps[l.fingerprint] = {
        fp: l.fingerprint,
        device: parseUserAgent(l.user_agent || ''),
        ua: l.user_agent || '-',
        count: 0,
        firstSeen: l.login_time
      };
    }
    if (l.fingerprint) u.fps[l.fingerprint].count++;
    if (l.event_type === 'ip_change') u.ipChanges++;
    if (l.event_type === 'fp_change') u.fpChanges++;
    if (l.login_time) u.allTimes.push(l.login_time);
  }));
  Object.assign(u, calcRiskScore(u));
  const levelColor = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e'
  };
  const levelLabel = {
    critical: '🔴 วิกฤต',
    high: '🟠 สูง',
    medium: '🟡 กลาง',
    low: '🟢 ปกติ'
  };
  const isVpn = Object.values(u.ips).some((d => VPN_ISP_KEYWORDS.some((k => (d.isp || '').toLowerCase().includes(k)))));
  const ipRows = Object.entries(u.ips).sort(((a, b) => b[1].count - a[1].count)).map((([ip, d]) => {
    const isVpnIp = VPN_ISP_KEYWORDS.some((k => (d.isp || '').toLowerCase().includes(k)));
    return `<tr style="border-bottom:1px solid #e2e8f0">\n            <td style="padding:8px;font-family:monospace;font-size:12px;color:#0369a1;font-weight:700">${ip}</td>\n            <td style="padding:8px;font-size:12px">${window.escapeHtml(d.country || '-')} / ${window.escapeHtml(d.city || '-')}</td>\n            <td style="padding:8px;font-size:12px;max-width:180px;word-break:break-word">${isVpnIp ? '<span style="background:#7e22ce;color:#fff;padding:1px 6px;border-radius:99px;font-size:10px;font-weight:700">⚠ VPN</span> ' : ''}${window.escapeHtml(d.isp || '-')}</td>\n            <td style="padding:8px;font-size:11px;color:var(--k-mute)">${d.asn || '-'}</td>\n            <td style="padding:8px;font-size:11px;color:var(--k-mute)">${d.timezone || '-'}</td>\n            <td style="padding:8px;text-align:center;font-weight:700;color:#0f172a">${d.count}</td>\n        </tr>`;
  })).join('');
  const fpRows = Object.entries(u.fps).sort(((a, b) => b[1].count - a[1].count)).map((([fp, d], i) => `<tr style="border-bottom:1px solid #e2e8f0">\n            <td style="padding:8px;font-size:12px;font-weight:700;color:#4f46e5">${d.device}</td>\n            <td style="padding:8px;font-family:monospace;font-size:11px;color:var(--k-mute)">${fp}</td>\n            <td style="padding:8px;font-size:11px;color:var(--k-mute);max-width:200px;word-break:break-word">${d.ua}</td>\n            <td style="padding:8px;text-align:center;font-weight:700;color:#0f172a">${d.count}</td>\n        </tr>`)).join('');
  const evColor = {
    login: '#22c55e',
    ip_change: '#ef4444',
    fp_change: '#a855f7'
  };
  const evLabel = {
    login: '🟢 Login',
    ip_change: '🔴 IP เปลี่ยน',
    fp_change: '🟣 สลับเครื่อง'
  };
  const recentLogs = logs.slice(0, 15).map((l => `\n        <tr style="border-bottom:1px solid #f1f5f9">\n            <td style="padding:6px 8px;font-size:11px;color:var(--k-mute);white-space:nowrap">${new Date(l.login_time).toLocaleString('th-TH')}</td>\n            <td style="padding:6px 8px"><span style="background:${evColor[l.event_type]}22;color:${evColor[l.event_type]};font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px">${evLabel[l.event_type] || l.event_type}</span></td>\n            <td style="padding:6px 8px;font-family:monospace;font-size:11px;color:#0369a1">${l.ip_address || '-'}</td>\n            <td style="padding:6px 8px;font-size:11px;color:var(--k-mute)">${window.escapeHtml(l.country || '-')} / ${window.escapeHtml(l.city || '-')}</td>\n            <td style="padding:6px 8px;font-size:11px;color:var(--k-mute)">${l.fingerprint ? shortFp(l.fingerprint) : '-'}</td>\n        </tr>`)).join('');
  const html = `\n    <div style="text-align:left;font-family:sans-serif">\n        \x3c!-- Header --\x3e\n        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">\n            <div>\n                <div style="font-size:11px;color:var(--k-mute);text-transform:uppercase;letter-spacing:.05em">Risk Score</div>\n                <div style="font-size:36px;font-weight:900;color:${levelColor[u.level]};line-height:1">${u.score}</div>\n            </div>\n            <div style="display:flex;gap:8px;flex-wrap:wrap">\n                <div style="background:#f1f5f9;border-radius:10px;padding:8px 14px;text-align:center">\n                    <div style="font-size:20px;font-weight:900;color:light-dark(#0a74a4,#0ea5e9)">${Object.keys(u.ips).length}</div>\n                    <div style="font-size:10px;color:var(--k-mute)">IP ที่ใช้</div>\n                </div>\n                <div style="background:#f1f5f9;border-radius:10px;padding:8px 14px;text-align:center">\n                    <div style="font-size:20px;font-weight:900;color:light-dark(#0e119f,#6366f1)">${Object.keys(u.fps).length}</div>\n                    <div style="font-size:10px;color:var(--k-mute)">เครื่องที่ใช้</div>\n                </div>\n                <div style="background:#f1f5f9;border-radius:10px;padding:8px 14px;text-align:center">\n                    <div style="font-size:20px;font-weight:900;color:light-dark(#a94804,#f97316)">${u.ipChanges}</div>\n                    <div style="font-size:10px;color:var(--k-mute)">IP เปลี่ยน</div>\n                </div>\n                <div style="background:#f1f5f9;border-radius:10px;padding:8px 14px;text-align:center">\n                    <div style="font-size:20px;font-weight:900;color:light-dark(#5908a6,#a855f7)">${u.fpChanges}</div>\n                    <div style="font-size:10px;color:var(--k-mute)">สลับเครื่อง</div>\n                </div>\n                <div style="background:#f1f5f9;border-radius:10px;padding:8px 14px;text-align:center">\n                    <div style="font-size:20px;font-weight:900;color:light-dark(#0ea06f,#10b981)">${u.allTimes.length}</div>\n                    <div style="font-size:10px;color:var(--k-mute)">Login ทั้งหมด</div>\n                </div>\n            </div>\n        </div>\n\n        \x3c!-- Reasons --\x3e\n        ${u.reasons.length > 0 ? `\n        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:16px">\n            <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:8px">⚠️ สาเหตุที่น่าสงสัย</div>\n            <div style="display:flex;flex-wrap:wrap;gap:6px">\n                ${u.reasons.map((r => `<span style="background:#fff;border:1px solid #fca5a5;color:#dc2626;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px">${r}</span>`)).join('')}\n            </div>\n        </div>` : ''}\n\n        \x3c!-- IP Table --\x3e\n        <div style="margin-bottom:16px">\n            <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px">🌐 IP Address ทั้งหมด (${Object.keys(u.ips).length} รายการ)</div>\n            <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0">\n                <table style="width:100%;border-collapse:collapse;font-size:12px">\n                    <thead style="background:#f8fafc">\n                        <tr>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">IP</th>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">ประเทศ/เมือง</th>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">ISP</th>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">ASN</th>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">Timezone</th>\n                            <th style="padding:8px;text-align:center;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">ครั้ง</th>\n                        </tr>\n                    </thead>\n                    <tbody>${ipRows}</tbody>\n                </table>\n            </div>\n        </div>\n\n        \x3c!-- Device Table --\x3e\n        <div style="margin-bottom:16px">\n            <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px">📱 อุปกรณ์/เครื่องที่ใช้ (${Object.keys(u.fps).length} เครื่อง)</div>\n            <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0">\n                <table style="width:100%;border-collapse:collapse;font-size:12px">\n                    <thead style="background:#f8fafc">\n                        <tr>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">รุ่น/ระบบ</th>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">Device FP</th>\n                            <th style="padding:8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">User Agent</th>\n                            <th style="padding:8px;text-align:center;font-size:10px;color:var(--k-mute);font-weight:700;text-transform:uppercase">ครั้ง</th>\n                        </tr>\n                    </thead>\n                    <tbody>${fpRows}</tbody>\n                </table>\n            </div>\n        </div>\n\n        \x3c!-- Event Log --\x3e\n        <div>\n            <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px">📋 ประวัติล่าสุด (15 รายการ)</div>\n            <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0;max-height:280px;overflow-y:auto">\n                <table style="width:100%;border-collapse:collapse;font-size:12px">\n                    <thead style="background:#f8fafc;position:sticky;top:0">\n                        <tr>\n                            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700">เวลา</th>\n                            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700">ประเภท</th>\n                            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700">IP</th>\n                            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700">สถานที่</th>\n                            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--k-mute);font-weight:700">FP</th>\n                        </tr>\n                    </thead>\n                    <tbody>${recentLogs}</tbody>\n                </table>\n            </div>\n        </div>\n    </div>`;
  Swal.fire({
    title: `<div style="display:flex;align-items:center;gap:10px"><span style="font-size:22px">👤</span> ${window.escapeHtml(u.username)} <span style="font-size:12px;background:${levelColor[u.level]}22;color:${levelColor[u.level]};padding:2px 10px;border-radius:99px;font-weight:700">${levelLabel[u.level]}</span></div>`,
    html: html,
    width: '900px',
    showConfirmButton: false,
    showCloseButton: true,
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl',
      htmlContainer: 'text-left'
    }
  });
};
