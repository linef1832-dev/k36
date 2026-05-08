// ==========================================================
// 🧴 ระบบลงเวลาห้องน้ำ / สูบบุหรี่ — Frontend
// ใช้ Supabase ร่วมกับ Telegram Bot
// ==========================================================

let brk_employees = [];     // cache พนักงานทั้งหมด
let brk_activeSessions = []; // cache active sessions
let brk_historyData = [];    // cache history

let brk_clockInterval = null; // อัปเดตเวลาที่ผ่านไปทุกวินาที


// ==========================================================
// 🚀 Init — เรียกตอนเข้าหน้านี้
// ==========================================================
async function initBreaksApp() {
    // ตรวจสิทธิ์ — เฉพาะ admin/manager
    if (currentUser.role !== 'manager' && currentUser.role !== 'admin') {
        document.getElementById('breaksApp').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 p-10">
                <span class="material-icons text-6xl mb-3 opacity-30">lock</span>
                <p class="font-bold text-xl">เฉพาะ Admin / Manager เท่านั้น</p>
            </div>`;
        return;
    }

    // ตั้งค่าวันที่ default = วันนี้
    const dateInput = document.getElementById('brk_histDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // เติม TEAM_LIST ลงใน dropdown ทีม
    const teamSelect = document.getElementById('brk_empTeam');
    if (teamSelect && typeof TEAM_LIST !== 'undefined') {
        TEAM_LIST.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            teamSelect.appendChild(opt);
        });
    }

    // เริ่มที่ tab live
    brk_switchTab('live');

    // โหลดข้อมูลครั้งแรก
    await brk_loadAll();

    // Subscribe realtime — อัปเดตอัตโนมัติเมื่อมี checkin/checkout
    const channel = appDB
        .channel('breaks-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'break_active_sessions' }, () => {
            brk_loadActiveSessions();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'break_employees' }, () => {
            brk_loadEmployees();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'break_activity_log' }, () => {
            brk_loadStatToday();
            // ถ้าอยู่ tab history ของวันนี้ ก็โหลดใหม่
            const histDate = document.getElementById('brk_histDate')?.value;
            const today = new Date().toISOString().split('T')[0];
            if (histDate === today) brk_loadHistory();
        })
        .subscribe();
    if (typeof window.registerPageSubscription === 'function') {
        window.registerPageSubscription(channel);
    }

    // อัปเดตเวลาที่ผ่านไปทุก 1 วินาที
    brk_clockInterval = setInterval(() => {
        brk_renderLiveSessions();  // วาดใหม่ทั้งตาราง (จะอัปเดตคอลัมน์ "เวลาที่ใช้")
    }, 1000);
    if (typeof window.registerPageInterval === 'function') {
        window.registerPageInterval(brk_clockInterval);
    }
}

// ทำให้ window เห็น (สำหรับเรียกจาก global.js showPage)
window.initBreaksApp = initBreaksApp;


// ==========================================================
// 🔁 สลับ Tab
// ==========================================================
window.brk_switchTab = function(tab) {
    const tabs = ['live', 'employees', 'history'];
    tabs.forEach(t => {
        const btn = document.getElementById(`brk_tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const pane = document.getElementById(`brk_pane${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (!btn || !pane) return;
        if (t === tab) {
            btn.classList.add('bg-white', 'text-cyan-700', 'shadow');
            btn.classList.remove('text-white/80');
            pane.classList.remove('hidden');
            pane.classList.add('flex');
        } else {
            btn.classList.remove('bg-white', 'text-cyan-700', 'shadow');
            btn.classList.add('text-white/80');
            pane.classList.add('hidden');
            pane.classList.remove('flex');
        }
    });

    // โหลดข้อมูลของ tab ที่เพิ่งเปิด
    if (tab === 'employees') brk_renderEmployees();
    else if (tab === 'history') brk_loadHistory();
};


// ==========================================================
// 📥 โหลดข้อมูลทั้งหมด
// ==========================================================
async function brk_loadAll() {
    await Promise.all([
        brk_loadEmployees(),
        brk_loadActiveSessions(),
        brk_loadStatToday(),
    ]);
}

async function brk_loadEmployees() {
    const { data, error } = await appDB
        .from('break_employees')
        .select('*')
        .order('display_name');
    if (error) { console.error(error); return; }
    brk_employees = data || [];
    document.getElementById('brk_statTotalEmp').textContent = brk_employees.length;
    if (!document.getElementById('brk_paneEmployees').classList.contains('hidden')) {
        brk_renderEmployees();
    }
    brk_renderLiveSessions(); // เพื่ออัปเดต join ข้อมูล
}

async function brk_loadActiveSessions() {
    const { data, error } = await appDB
        .from('break_active_sessions')
        .select('*, break_employees(display_name, team, telegram_username, discord_room_name)')
        .order('started_at');
    if (error) { console.error(error); return; }
    brk_activeSessions = data || [];
    document.getElementById('brk_statActive').textContent = brk_activeSessions.length;
    brk_renderLiveSessions();
}

async function brk_loadStatToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count, error } = await appDB
        .from('break_activity_log')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', start.toISOString());
    if (!error) document.getElementById('brk_statToday').textContent = count || 0;
}


// ==========================================================
// 🔴 Tab: Live Monitor
// ==========================================================
function brk_renderLiveSessions() {
    const tbody = document.getElementById('brk_liveBody');
    if (!tbody) return;

    if (brk_activeSessions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-10 text-gray-500">
            <span class="material-icons text-5xl block mb-2 opacity-30">check_circle</span>
            ✅ ตอนนี้ไม่มีใครออกจากที่นั่ง
        </td></tr>`;
        document.getElementById('brk_statOverTime').textContent = '0';
        return;
    }

    let overTimeCount = 0;
    const now = Date.now();

    tbody.innerHTML = brk_activeSessions.map(s => {
        const emp = s.break_employees || {};
        const started = new Date(s.started_at);
        const elapsedSec = Math.floor((now - started.getTime()) / 1000);
        const limitSec = s.time_limit_minutes * 60;
        const isOver = elapsedSec > limitSec;
        if (isOver) overTimeCount++;

        const min = Math.floor(elapsedSec / 60);
        const sec = elapsedSec % 60;
        const elapsedStr = `${min}:${String(sec).padStart(2, '0')}`;

        const activityIcon = s.activity === 'toilet' ? '🚽' : '🚬';
        const activityLabel = s.activity === 'toilet' ? 'ห้องน้ำ' : 'สูบบุหรี่';
        const rowBg = isOver ? 'bg-red-900/30 hover:bg-red-900/40' : 'hover:bg-slate-700/50';
        const timeClass = isOver ? 'text-red-400 font-black' : 'text-cyan-300 font-bold';
        const overBadge = isOver
            ? `<span class="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-black animate-pulse">เกิน!</span>`
            : '';

        return `
            <tr class="${rowBg} transition">
                <td class="p-3 font-bold text-white">${emp.display_name || '—'}</td>
                <td class="p-3 text-gray-400">${emp.team || '—'}</td>
                <td class="p-3"><span class="text-lg">${activityIcon}</span> ${activityLabel}</td>
                <td class="p-3 font-mono text-gray-300">${started.toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                <td class="p-3 ${timeClass} font-mono text-base">${elapsedStr} / ${s.time_limit_minutes}:00 ${overBadge}</td>
                <td class="p-3 text-gray-400 text-xs">${emp.discord_room_name || '<span class="text-amber-400">ยังไม่ตั้งค่า</span>'}</td>
            </tr>`;
    }).join('');

    document.getElementById('brk_statOverTime').textContent = overTimeCount;
}


// ==========================================================
// 👥 Tab: Employees
// ==========================================================
window.brk_renderEmployees = function() {
    const tbody = document.getElementById('brk_empBody');
    if (!tbody) return;

    const search = (document.getElementById('brk_empSearch')?.value || '').toLowerCase().trim();
    const filtered = brk_employees.filter(e => {
        if (!search) return true;
        return (e.display_name || '').toLowerCase().includes(search)
            || (e.team || '').toLowerCase().includes(search)
            || (e.telegram_username || '').toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-10 text-gray-500">
            <span class="material-icons text-5xl block mb-2 opacity-30">person_off</span>
            ${brk_employees.length === 0
                ? 'ยังไม่มีพนักงานลงทะเบียน — ให้พนักงานพิมพ์ /start ใน Telegram'
                : 'ไม่พบพนักงานที่ค้นหา'}
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(e => {
        const hasWebhook = !!e.discord_webhook_url;
        const hasTeam = !!e.team;
        const statusBadge = e.is_active
            ? '<span class="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 text-[10px] rounded-full font-bold border border-emerald-700">ใช้งาน</span>'
            : '<span class="px-2 py-0.5 bg-gray-700 text-gray-400 text-[10px] rounded-full font-bold">ปิด</span>';

        let configBadges = '';
        configBadges += hasTeam
            ? '<span class="text-emerald-400" title="ตั้งทีมแล้ว">🟢</span>'
            : '<span class="text-amber-400" title="ยังไม่ตั้งทีม">🟡</span>';
        configBadges += hasWebhook
            ? ' <span class="text-emerald-400" title="ตั้ง Discord แล้ว">🟢</span>'
            : ' <span class="text-amber-400" title="ยังไม่ตั้ง Discord">🟡</span>';

        return `
            <tr class="hover:bg-slate-700/50 transition">
                <td class="p-3 font-bold text-white">${e.display_name}</td>
                <td class="p-3 text-gray-400 text-xs">${e.telegram_username ? '@' + e.telegram_username : '—'}</td>
                <td class="p-3 text-gray-400 font-mono text-xs">${e.telegram_id}</td>
                <td class="p-3">${e.team ? `<span class="px-2 py-1 bg-indigo-900/50 text-indigo-300 rounded font-bold text-xs">${e.team}</span>` : '<span class="text-amber-400 text-xs">—</span>'}</td>
                <td class="p-3 text-xs ${hasWebhook ? 'text-cyan-300' : 'text-amber-400'}">${e.discord_room_name || (hasWebhook ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง')}</td>
                <td class="p-3">${statusBadge} ${configBadges}</td>
                <td class="p-3 text-center">
                    <button onclick="brk_openEmpModal(${e.id})" class="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition active:scale-95">
                        <span class="material-icons text-sm align-middle">edit</span> แก้ไข
                    </button>
                </td>
            </tr>`;
    }).join('');
};


window.brk_openEmpModal = function(empId) {
    const emp = brk_employees.find(e => e.id === empId);
    if (!emp) return;

    document.getElementById('brk_empId').value = emp.id;
    document.getElementById('brk_empName').value = emp.display_name;
    document.getElementById('brk_empTelegramId').value = emp.telegram_id;
    document.getElementById('brk_empTeam').value = emp.team || '';
    document.getElementById('brk_empWebhook').value = emp.discord_webhook_url || '';
    document.getElementById('brk_empRoomName').value = emp.discord_room_name || '';
    document.getElementById('brk_empActive').checked = emp.is_active !== false;

    const modal = document.getElementById('brk_empModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};


window.brk_closeEmpModal = function() {
    const modal = document.getElementById('brk_empModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};


window.brk_saveEmp = async function(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('brk_empId').value);
    const webhook = document.getElementById('brk_empWebhook').value.trim();

    // validate webhook URL
    if (webhook && !webhook.startsWith('https://discord.com/api/webhooks/')) {
        Swal.fire({ icon: 'error', title: 'URL ไม่ถูกต้อง',
            text: 'Webhook URL ต้องขึ้นต้นด้วย https://discord.com/api/webhooks/' });
        return;
    }

    const updateData = {
        team: document.getElementById('brk_empTeam').value || null,
        discord_webhook_url: webhook || null,
        discord_room_name: document.getElementById('brk_empRoomName').value.trim() || null,
        is_active: document.getElementById('brk_empActive').checked,
    };

    const { error } = await appDB.from('break_employees').update(updateData).eq('id', id);
    if (error) {
        Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message });
        return;
    }

    Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1200, showConfirmButton: false });
    brk_closeEmpModal();
    await brk_loadEmployees();
};


// ==========================================================
// 📚 Tab: History
// ==========================================================
window.brk_loadHistory = async function() {
    const dateStr = document.getElementById('brk_histDate')?.value;
    if (!dateStr) return;

    const tbody = document.getElementById('brk_histBody');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-10 text-gray-500">
        <span class="material-icons animate-spin text-4xl mb-2 block">sync</span>
        กำลังโหลด...
    </td></tr>`;

    const startOfDay = new Date(dateStr + 'T00:00:00').toISOString();
    const endOfDay = new Date(dateStr + 'T23:59:59').toISOString();

    const { data, error } = await appDB
        .from('break_activity_log')
        .select('*')
        .gte('started_at', startOfDay)
        .lte('started_at', endOfDay)
        .order('started_at', { ascending: false })
        .limit(500);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-10 text-red-400">โหลดผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    brk_historyData = data || [];
    brk_renderHistory();
};


window.brk_renderHistory = function() {
    const tbody = document.getElementById('brk_histBody');
    if (!tbody) return;

    const filterAct = document.getElementById('brk_histActivity')?.value || 'all';
    const filterExc = document.getElementById('brk_histExceeded')?.value || 'all';
    const search = (document.getElementById('brk_histSearch')?.value || '').toLowerCase().trim();

    let rows = brk_historyData;
    if (filterAct !== 'all') rows = rows.filter(r => r.activity === filterAct);
    if (filterExc === 'exceeded') rows = rows.filter(r => r.exceeded_limit);
    if (search) rows = rows.filter(r => (r.employee_name || '').toLowerCase().includes(search));

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-10 text-gray-500">
            <span class="material-icons text-5xl block mb-2 opacity-30">inbox</span>
            ไม่มีข้อมูลในวันที่เลือก
        </td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const started = new Date(r.started_at);
        const ended = new Date(r.ended_at);
        const min = Math.floor(r.duration_seconds / 60);
        const sec = r.duration_seconds % 60;
        const durationStr = `${min}:${String(sec).padStart(2,'0')}`;

        const activityIcon = r.activity === 'toilet' ? '🚽' : '🚬';
        const activityLabel = r.activity === 'toilet' ? 'ห้องน้ำ' : 'สูบบุหรี่';
        const statusBadge = r.exceeded_limit
            ? '<span class="px-2 py-0.5 bg-red-900/50 text-red-400 text-[10px] rounded-full font-bold border border-red-700">⚠️ เกินเวลา</span>'
            : '<span class="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 text-[10px] rounded-full font-bold border border-emerald-700">✅ ปกติ</span>';

        return `
            <tr class="hover:bg-slate-700/50 transition">
                <td class="p-3 font-mono text-xs text-gray-300">${started.toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                <td class="p-3 font-mono text-xs text-gray-300">${ended.toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                <td class="p-3 font-bold text-white">${r.employee_name}</td>
                <td class="p-3 text-gray-400 text-xs">${r.team || '—'}</td>
                <td class="p-3"><span class="text-lg">${activityIcon}</span> ${activityLabel}</td>
                <td class="p-3 font-mono ${r.exceeded_limit ? 'text-red-400 font-black' : 'text-cyan-300 font-bold'}">${durationStr}</td>
                <td class="p-3">${statusBadge}</td>
            </tr>`;
    }).join('');
};
