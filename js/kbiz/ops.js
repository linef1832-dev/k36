// ════════════════════════════════════════════════════════════════════
// 📦 kbiz/ops.js — ส่วนที่ 2/2 ของระบบบอท K BIZ (แยกจาก kbiz.js เดิม 969 บรรทัด)
// เนื้อหา: Telegram Bot Config, VPS Stats, เคลียร์ RAM, Chrome Auto-Refresh
// ⚠️ ลำดับโหลด: kbiz/core → kbiz/ops (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 🤖 ระบบจัดการ Telegram Bot Config
// ==========================================
let globalTelegramConfig = {};

async function fetchTelegramBotConfig() {
    if (!document.getElementById('telegramBotToken')) return;
    try {
        let _tgRaw = await window.getSettingCached('telegram_bot_config');
        if (!_tgRaw) {
            const { data: _dbTg } = await appDB.from('settings').select('value').eq('key', 'telegram_bot_config').maybeSingle();
            _tgRaw = _dbTg?.value ?? null;
        }
        if (_tgRaw) {
            globalTelegramConfig = JSON.parse(_tgRaw);
        } else {
            globalTelegramConfig = {};
        }
    } catch(e) {
        globalTelegramConfig = {};
    }
    renderTelegramBotConfig();
}

function renderTelegramBotConfig() {
    const tokenInput = document.getElementById('telegramBotToken');
    if (!tokenInput) return;

    tokenInput.value = globalTelegramConfig.token || '';
    document.getElementById('telegramPickStrategy').value = globalTelegramConfig.pick_strategy || 'random';
    document.getElementById('telegramEnabled').checked = globalTelegramConfig.enabled !== false;

    const select = document.getElementById('telegramPreferredMachine');
    const activeBots = (globalKbizBots || []).filter(b => b.is_active);
    let optionsHtml = '<option value="">🎲 อัตโนมัติ (สลับใช้ทุกตัวที่ active)</option>';
    optionsHtml += activeBots.map(b => 
        `<option value="${b.machine_id}">${b.machine_id}${b.display_name ? ' — ' + b.display_name : ''}</option>`
    ).join('');
    select.innerHTML = optionsHtml;
    select.value = globalTelegramConfig.preferred_machine || '';

    const badge = document.getElementById('telegramBotStatusBadge');
    if (badge) {
        const hasToken = !!globalTelegramConfig.token;
        const isEnabled = globalTelegramConfig.enabled !== false;
        if (!hasToken) {
            badge.textContent = '⚠ ยังไม่ตั้ง Token';
            badge.className = 'bg-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-amber-300/50';
        } else if (!isEnabled) {
            badge.textContent = '⏸ ปิดใช้งาน';
            badge.className = 'bg-red-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-red-300/50';
        } else {
            badge.textContent = '✅ พร้อมใช้งาน';
            badge.className = 'bg-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-300/50';
        }
    }
}

window.toggleTelegramTokenVisibility = function() {
    const input = document.getElementById('telegramBotToken');
    const icon = document.getElementById('telegramTokenEyeIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
    }
};

window.saveTelegramConfig = async function(e) {
    if (e) e.preventDefault();
    const token = document.getElementById('telegramBotToken').value.trim();
    const preferred = document.getElementById('telegramPreferredMachine').value;
    const strategy = document.getElementById('telegramPickStrategy').value;
    const enabled = document.getElementById('telegramEnabled').checked;

    if (token && !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
        return Swal.fire('Token รูปแบบไม่ถูกต้อง', 'Token ของ Telegram ต้องเป็นแบบ <b>123456789:ABCdef...</b>', 'warning');
    }

    const config = {
        token: token,
        preferred_machine: preferred,
        pick_strategy: strategy,
        enabled: enabled,
        updated_at: new Date().toISOString()
    };

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    try {
        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'telegram_bot_config', value: JSON.stringify(config) }]);
        globalTelegramConfig = config;
        renderTelegramBotConfig();
        Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ!',
            html: '⚠ <b>อย่าลืมรีสตาร์ท bot บน VPS</b><br><span class="text-xs">ปิดหน้าต่าง CMD แล้ว double-click <code>2-start-bot.bat</code> ใหม่</span>',
            timer: 3500,
            showConfirmButton: false
        });
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    }
};

window.testTelegramBotInfo = async function() {
    const token = document.getElementById('telegramBotToken').value.trim();
    if (!token) return Swal.fire('ไม่มี Token', 'กรอก token ก่อน', 'warning');

    Swal.fire({title: 'กำลังทดสอบ...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        if (data.ok) {
            const b = data.result;
            Swal.fire({
                icon: 'success',
                title: 'Token ใช้งานได้!',
                html: `
                    <div class="text-left text-sm space-y-1 mt-2">
                        <div>🤖 ชื่อบอท: <b>${b.first_name}</b></div>
                        <div>📛 Username: <code>@${b.username}</code></div>
                        <div>🔗 Link: <a href="https://t.me/${b.username}" target="_blank" class="text-sky-500 underline">t.me/${b.username}</a></div>
                    </div>
                `
            });
        } else {
            Swal.fire('Token ใช้ไม่ได้', data.description || 'Telegram API ปฏิเสธ token นี้', 'error');
        }
    } catch(err) {
        Swal.fire('เชื่อมไม่ได้', err.message, 'error');
    }
};


// ==========================================
// 📊 VPS STATS DASHBOARD
// ==========================================
let _vpsStatsTimer = null;

window.fetchVpsStats = async function(manual = false) {
    if (!document.getElementById('vpsStatsCard')) return;

    const btnIcon = manual ? document.querySelector('#vpsStatsRefreshBtn .material-icons') : null;
    if (btnIcon) btnIcon.classList.add('animate-spin');

    try {
        let _vpsRaw = await window.getSettingCached('vps_stats');
        if (!_vpsRaw) {
            const { data: _dbVps } = await appDB.from('settings').select('value').eq('key', 'vps_stats').maybeSingle();
            _vpsRaw = _dbVps?.value ?? null;
        }
        if (_vpsRaw) {
            // [FIX] แก้บัค: ใช้ _vpsRaw แทน _tgRaw และ data.value ที่ไม่มีอยู่
            const stats = typeof _vpsRaw === 'string' ? JSON.parse(_vpsRaw) : _vpsRaw;
            renderVpsStats(stats);
        } else {
            setVpsStatsOffline();
        }
    } catch(e) {
        setVpsStatsOffline();
    } finally {
        if (btnIcon) {
            setTimeout(() => btnIcon.classList.remove('animate-spin'), 600);
        }
    }
};

function formatUptime(sec) {
    if (!sec || sec < 0) return '—';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d} วัน ${h} ชม`;
    if (h > 0) return `${h} ชม ${m} นาที`;
    return `${m} นาที`;
}

function timeAgo(isoString) {
    if (!isoString) return '—';
    const past = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - past) / 1000);
    if (isNaN(diffSec)) return '—';
    if (diffSec < 5) return 'เมื่อสักครู่';
    if (diffSec < 60) return `${diffSec} วินาทีก่อน`;
    if (diffSec < 3600) return `${Math.floor(diffSec/60)} นาทีก่อน`;
    if (diffSec < 86400) return `${Math.floor(diffSec/3600)} ชม.ก่อน`;
    return `${Math.floor(diffSec/86400)} วันก่อน`;
}

function colorByPercent(percent) {
    if (percent >= 90) return { bar: 'bg-red-500', text: 'text-red-300' };
    if (percent >= 75) return { bar: 'bg-orange-500', text: 'text-orange-300' };
    if (percent >= 50) return { bar: 'bg-amber-500', text: 'text-amber-300' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-300' };
}

function renderVpsStats(stats) {
    if (!stats) return setVpsStatsOffline();

    const updatedAt = stats.updated_at;
    if (updatedAt) {
        const ageSec = (Date.now() - new Date(updatedAt).getTime()) / 1000;
        if (ageSec > 90) {
            setVpsStatsStale(stats);
            return;
        }
    }

    const cpu = stats.cpu_percent ?? 0;
    const cpuColor = colorByPercent(cpu);
    document.getElementById('vpsStatsCpu').textContent = `${cpu.toFixed(1)}%`;
    document.getElementById('vpsStatsCpu').className = `text-base font-black ${cpuColor.text}`;
    const cpuBar = document.getElementById('vpsStatsCpuBar');
    cpuBar.style.width = `${Math.min(100, cpu)}%`;
    cpuBar.className = `h-full transition-all ${cpuColor.bar}`;

    const ramPct = stats.ram_percent ?? 0;
    const ramColor = colorByPercent(ramPct);
    document.getElementById('vpsStatsRam').textContent = `${ramPct.toFixed(1)}%`;
    document.getElementById('vpsStatsRam').className = `text-base font-black ${ramColor.text}`;
    const ramBar = document.getElementById('vpsStatsRamBar');
    ramBar.style.width = `${ramPct}%`;
    ramBar.className = `h-full transition-all ${ramColor.bar}`;
    document.getElementById('vpsStatsRamDetail').textContent =
        `${stats.ram_used_gb?.toFixed(2) || 0} / ${stats.ram_total_gb?.toFixed(2) || 0} GB`;

    const diskPct = stats.disk_percent ?? 0;
    const diskColor = colorByPercent(diskPct);
    document.getElementById('vpsStatsDisk').textContent = `${diskPct.toFixed(1)}%`;
    document.getElementById('vpsStatsDisk').className = `text-base font-black ${diskColor.text}`;
    const diskBar = document.getElementById('vpsStatsDiskBar');
    diskBar.style.width = `${diskPct}%`;
    diskBar.className = `h-full transition-all ${diskColor.bar}`;
    document.getElementById('vpsStatsDiskDetail').textContent =
        `${stats.disk_used_gb?.toFixed(1) || 0} / ${stats.disk_total_gb?.toFixed(1) || 0} GB`;

    document.getElementById('vpsStatsUptime').textContent = formatUptime(stats.system_uptime_sec);
    document.getElementById('vpsStatsBotUptime').textContent = `Bot: ${formatUptime(stats.bot_uptime_sec)}`;

    document.getElementById('vpsStatsUpdatedAt').textContent = timeAgo(updatedAt);
    document.getElementById('vpsStatsBotMem').textContent =
        `Bot RAM: ${stats.bot_mem_mb?.toFixed(1) || 0} MB`;

    // จุดเขียวกระพริบ
    const statusEl = document.getElementById('vpsStatsStatus');
    if (statusEl) {
        statusEl.innerHTML = `
            <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <span class="font-bold text-emerald-300">Online</span>
        `;
    }
}

function setVpsStatsOffline() {
    const statusEl = document.getElementById('vpsStatsStatus');
    if (statusEl) {
        statusEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            <span class="font-bold text-red-300">ยังไม่มีข้อมูล</span>
        `;
    }
}

function setVpsStatsStale(stats) {
    if (stats) renderVpsStatsValuesOnly(stats);
    const statusEl = document.getElementById('vpsStatsStatus');
    if (statusEl) {
        const updatedAt = stats?.updated_at;
        statusEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-orange-500"></span>
            <span class="font-bold text-orange-300">ข้อมูลค้าง (${timeAgo(updatedAt)})</span>
        `;
    }
}

function renderVpsStatsValuesOnly(stats) {
    document.getElementById('vpsStatsCpu').textContent = `${(stats.cpu_percent ?? 0).toFixed(1)}%`;
    document.getElementById('vpsStatsRam').textContent = `${(stats.ram_percent ?? 0).toFixed(1)}%`;
    document.getElementById('vpsStatsDisk').textContent = `${(stats.disk_percent ?? 0).toFixed(1)}%`;
    document.getElementById('vpsStatsUptime').textContent = formatUptime(stats.system_uptime_sec);
    document.getElementById('vpsStatsUpdatedAt').textContent = timeAgo(stats.updated_at);
}

// auto refresh ทุก 5 นาที (300,000 ms)
function startVpsStatsPolling() {
    if (_vpsStatsTimer) clearInterval(_vpsStatsTimer);
    fetchVpsStats();
    _vpsStatsTimer = setInterval(fetchVpsStats, 5 * 60 * 1000);
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(_vpsStatsTimer);
}


// ==========================================
// 🧹 ปุ่มเคลียร์ RAM
// ==========================================
window.clearVpsRam = async function() {
    const result = await Swal.fire({
        title: '🧹 เคลียร์ RAM cache?',
        html: 'ระบบจะล้าง <b>OS cache</b> เพื่อคืน RAM<br><span class="text-xs text-gray-500">✅ ปลอดภัย — Chrome ไม่ปิด<br>⏱ ใช้เวลา ~5 วินาที</span>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: '🧹 เคลียร์เลย',
        cancelButtonText: 'ยกเลิก',
    });
    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'กำลังส่งคำสั่ง...',
        html: '<span class="text-xs">รอ bot บน VPS รับคำสั่ง — สูงสุด 10 วินาที</span>',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
    });

    try {
        // ส่ง command ขึ้น Supabase
        const cmdPayload = {
            action: 'clear_ram',
            requested_at: new Date().toISOString()
        };
        window.clearSettingCache(); await appDB.from('settings').upsert([{
            key: 'vps_command',
            value: JSON.stringify(cmdPayload)
        }]);

        // รอ bot ทำเสร็จ — poll ผลลัพธ์ทุก 1 วินาที (max 15s)
        const startTime = Date.now();
        let cmdResult = null;
        while (Date.now() - startTime < 15000) {
            await new Promise(r => setTimeout(r, 1500));
            try {
                let _vcRaw = await window.getSettingCached('vps_command_result');
                if (_vcRaw) {
                    const r = typeof _vcRaw === 'string' ? JSON.parse(_vcRaw) : _vcRaw;
                    if (r && r.executed_at) {
                        const execTime = new Date(r.executed_at).getTime();
                        if (execTime > startTime - 5000) {
                            cmdResult = r;
                            break;
                        }
                    }
                }
            } catch(e) { /* ignore */ }
        }

        if (!cmdResult) {
            return Swal.fire({
                icon: 'warning',
                title: 'ไม่ได้รับคำตอบ',
                html: 'Bot ไม่ตอบกลับใน 15 วินาที<br><span class="text-xs">ลองอีกครั้งหรือเช็คสถานะ bot</span>',
            });
        }

        if (cmdResult.success) {
            await fetchVpsStats(true); // refresh stats ทันที
            Swal.fire({
                icon: 'success',
                title: '✅ เคลียร์ RAM สำเร็จ!',
                html: `
                    <div class="text-left text-sm space-y-1 mt-2">
                        <div>🆓 คืน RAM: <b class="text-emerald-600">${cmdResult.freed_mb} MB</b></div>
                        <div>📊 ก่อน: ${cmdResult.before_mb} MB (${cmdResult.before_percent}%)</div>
                        <div>📊 หลัง: ${cmdResult.after_mb} MB (${cmdResult.after_percent}%)</div>
                    </div>
                `,
                timer: 5000,
                showConfirmButton: true,
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'เคลียร์ไม่ได้',
                text: cmdResult.error || 'ไม่ทราบสาเหตุ',
            });
        }
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    }
};


// ==========================================
// 🔄 CHROME AUTO-REFRESH CONFIG
// ==========================================
let globalChromeRefreshConfig = {};

async function fetchChromeRefreshConfig() {
    if (!document.getElementById('chromeRefreshHours')) return;
    try {
        let _chromeRaw = await window.getSettingCached('chrome_refresh_config');
        if (!_chromeRaw) {
            const { data: _dbChrome } = await appDB.from('settings').select('value').eq('key', 'chrome_refresh_config').maybeSingle();
            _chromeRaw = _dbChrome?.value ?? null;
        }
        if (_chromeRaw) {
            // [FIX] แก้บัค: ใช้ _chromeRaw แทน _tgRaw ที่ไม่มีอยู่ใน scope นี้
            globalChromeRefreshConfig = JSON.parse(_chromeRaw);
        } else {
            globalChromeRefreshConfig = { enabled: false, interval_seconds: 7200, stagger: true };
        }
    } catch(e) {
        globalChromeRefreshConfig = { enabled: false, interval_seconds: 7200, stagger: true };
    }
    renderChromeRefreshConfig();
    fetchChromeRefreshHistory();

    // auto refresh ประวัติทุก 30 วิ
    if (_refreshHistoryTimer) clearInterval(_refreshHistoryTimer);
    _refreshHistoryTimer = setInterval(fetchChromeRefreshHistory, 30 * 1000);
    // [FIX] เดิมไม่ได้ลงทะเบียน ทำให้ยิง DB ทุก 30 วิ ต่อไปเรื่อย ๆ แม้ออกจากหน้านี้ไปแล้ว
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(_refreshHistoryTimer);
}

function renderChromeRefreshConfig() {
    const hoursEl = document.getElementById('chromeRefreshHours');
    if (!hoursEl) return;

    const totalSec = globalChromeRefreshConfig.interval_seconds || 7200;
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    hoursEl.value = hours;
    document.getElementById('chromeRefreshMinutes').value = minutes;
    document.getElementById('chromeRefreshEnabled').checked = globalChromeRefreshConfig.enabled === true;

    const badge = document.getElementById('chromeRefreshBadge');
    if (badge) {
        if (globalChromeRefreshConfig.enabled) {
            badge.textContent = `✅ เปิด — ทุก ${hours} ชม ${minutes} นาที`;
            badge.className = 'bg-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-300/50';
        } else {
            badge.textContent = '⏸ ปิดใช้งาน';
            badge.className = 'bg-red-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-red-300/50';
        }
    }
}

window.saveChromeRefreshConfig = async function(e) {
    if (e) e.preventDefault();
    const hours = parseInt(document.getElementById('chromeRefreshHours').value) || 0;
    const minutes = parseInt(document.getElementById('chromeRefreshMinutes').value) || 0;
    const enabled = document.getElementById('chromeRefreshEnabled').checked;
    const totalSec = hours * 3600 + minutes * 60;

    if (enabled && totalSec < 60) {
        return Swal.fire('ตั้งสั้นเกินไป', 'ต้องอย่างน้อย 1 นาที', 'warning');
    }
    if (totalSec > 24 * 3600) {
        return Swal.fire('ตั้งนานเกินไป', 'ไม่ควรเกิน 24 ชม (session อาจหมดก่อน)', 'warning');
    }

    const config = {
        enabled: enabled,
        interval_seconds: totalSec,
        stagger: true,
        updated_at: new Date().toISOString()
    };

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    try {
        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'chrome_refresh_config', value: JSON.stringify(config) }]);
        globalChromeRefreshConfig = config;
        renderChromeRefreshConfig();
        Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ!',
            html: enabled
                ? `Chrome จะรีเฟรชทุก <b>${hours} ชม ${minutes} นาที</b><br><span class="text-xs">มีผลภายใน 60 วินาที</span>`
                : `<b>ปิด</b>การรีเฟรชอัตโนมัติแล้ว`,
            timer: 3000,
            showConfirmButton: false
        });
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    }
};


// ─── 📜 ประวัติการรีเฟรช ────────────────────────────────────────
let _refreshHistoryTimer = null;

window.fetchChromeRefreshHistory = async function(manual = false) {
    const listEl = document.getElementById('chromeRefreshHistoryList');
    if (!listEl) return;

    const btn = manual ? document.querySelector('#refreshHistoryBtn .material-icons') : null;
    if (btn) btn.classList.add('animate-spin');

    try {
        let _histRaw = await window.getSettingCached('chrome_refresh_history');
        if (!_histRaw) {
            const { data: _dbHist } = await appDB.from('settings').select('value').eq('key', 'chrome_refresh_history').maybeSingle();
            _histRaw = _dbHist?.value ?? null;
        }
        let history = [];
        if (_histRaw) {
            history = JSON.parse(_histRaw);
        }
        renderRefreshHistory(history);
    } catch(e) {
        renderRefreshHistory([]);
    } finally {
        if (btn) setTimeout(() => btn.classList.remove('animate-spin'), 600);
    }
};

function renderRefreshHistory(history) {
    const listEl = document.getElementById('chromeRefreshHistoryList');
    if (!listEl) return;

    if (!Array.isArray(history) || history.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-6 text-gray-400 text-xs flex flex-col items-center gap-2">
                <span class="material-icons opacity-30 text-3xl">history</span>
                <span>ยังไม่มีประวัติการรีเฟรช</span>
            </div>
        `;
        return;
    }

    // แสดง 10 ตัวล่าสุด (เรียงใหม่ → เก่า)
    const recent = history.slice(-10).reverse();
    listEl.innerHTML = recent.map(h => {
        const at = h.refreshed_at ? new Date(h.refreshed_at) : null;
        const timeText = at ? `${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}:${String(at.getSeconds()).padStart(2,'0')}` : '—';
        const dateText = at ? `${at.getDate()}/${at.getMonth()+1}` : '';
        const ago = at ? timeAgoShort(at) : '';
        return `
            <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-fuchsia-500 text-[16px]">refresh</span>
                    <div>
                        <div class="font-black text-slate-700 dark:text-gray-200">${h.machine_id || '—'}</div>
                        <div class="text-[10px] text-gray-500">${dateText} · ${timeText}</div>
                    </div>
                </div>
                <span class="text-[10px] text-gray-400 font-bold">${ago}</span>
            </div>
        `;
    }).join('');
}

function timeAgoShort(date) {
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec} วิ`;
    if (diffSec < 3600) return `${Math.floor(diffSec/60)} นาที`;
    if (diffSec < 86400) return `${Math.floor(diffSec/3600)} ชม.`;
    return `${Math.floor(diffSec/86400)} วัน`;
}
