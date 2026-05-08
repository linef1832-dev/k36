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
    // โหลด employees ก่อน เพราะ active_sessions ต้องใช้ข้อมูลพนักงานมา map
    await brk_loadEmployees();
    await Promise.all([
        brk_loadActiveSessions(),
        brk_loadStatToday(),
    ]);
}

// ฟังก์ชันแสดง error เป็น toast (ใช้ SweetAlert2 ถ้ามี)
function brk_showError(title, error) {
    const msg = error?.message || error?.code || 'ไม่ทราบสาเหตุ';
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title,
            text: msg,
            toast: true,
            position: 'top-end',
            timer: 5000,
            showConfirmButton: false,
        });
    }
}

async function brk_loadEmployees() {
    const { data, error } = await appDB
        .from('break_employees')
        .select('*')
        .order('display_name');
    if (error) {
        console.error('[breaks] loadEmployees error:', error);
        brk_showError('โหลดข้อมูลพนักงานไม่สำเร็จ', error);
    }
    brk_employees = data || [];
    const totalEl = document.getElementById('brk_statTotalEmp');
    if (totalEl) totalEl.textContent = brk_employees.length;
    if (!document.getElementById('brk_paneEmployees').classList.contains('hidden')) {
        brk_renderEmployees();
    }
    brk_renderLiveSessions();
}

async function brk_loadActiveSessions() {
    // ดึง active_sessions ก่อน — ไม่ join เพื่อกัน FK error
    const { data, error } = await appDB
        .from('break_active_sessions')
        .select('*')
        .order('started_at');
    if (error) {
        console.error('[breaks] loadActiveSessions error:', error);
        brk_showError('โหลดสถานะปัจจุบันไม่สำเร็จ', error);
        brk_activeSessions = [];
    } else {
        // map employee data จาก cache (brk_employees) แทนการ join
        brk_activeSessions = (data || []).map(s => ({
            ...s,
            break_employees: brk_employees.find(e => e.id === s.employee_id) || {}
        }));
    }
    const activeEl = document.getElementById('brk_statActive');
    if (activeEl) activeEl.textContent = brk_activeSessions.length;
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

        const { icon: activityIcon, label: activityLabel } = brk_activityDisplay(s.activity);
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
// 🎨 Map activity name → icon + label
// ==========================================================
function brk_activityDisplay(activity) {
    const a = (activity || '').toLowerCase();
    if (a.includes('สูบบุหรี่')) return { icon: '🚬', label: activity };
    if (a.includes('ปวดน้อย') || a.includes('ปวดหนัก') || a.includes('ห้องน้ำ') || a.includes('toilet')) {
        return { icon: '🚽', label: activity };
    }
    if (a.includes('กินข้าว') || a.includes('ทาน') || a.includes('อาหาร')) {
        return { icon: '🍱', label: activity };
    }
    return { icon: '⏸️', label: activity || '—' };
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
                ? 'ยังไม่มีพนักงาน — กดปุ่ม <b class="text-emerald-400">+ เพิ่มพนักงาน</b> ด้านบนขวา หรือรอ userbot ตรวจพบกิจกรรม'
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

    document.getElementById('brk_empModalTitle').textContent = 'แก้ไขข้อมูลพนักงาน';
    document.getElementById('brk_empModalIcon').textContent = 'edit';
    document.getElementById('brk_empNameHint').textContent = '(จาก Telegram)';

    document.getElementById('brk_empId').value = emp.id;
    const nameInput = document.getElementById('brk_empName');
    const tgIdInput = document.getElementById('brk_empTelegramId');
    nameInput.value = emp.display_name;
    tgIdInput.value = emp.telegram_id;
    // อนุญาตแก้ชื่อได้ แต่ telegram_id ห้ามแก้ (เป็น primary key)
    nameInput.disabled = false;
    tgIdInput.disabled = true;

    document.getElementById('brk_empTeam').value = emp.team || '';
    document.getElementById('brk_empWebhook').value = emp.discord_webhook_url || '';
    document.getElementById('brk_empRoomName').value = emp.discord_room_name || '';
    document.getElementById('brk_empActive').checked = emp.is_active !== false;

    const modal = document.getElementById('brk_empModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};


window.brk_openAddEmpModal = function() {
    document.getElementById('brk_empModalTitle').textContent = 'เพิ่มพนักงานใหม่';
    document.getElementById('brk_empModalIcon').textContent = 'person_add';
    document.getElementById('brk_empNameHint').textContent = '(พิมพ์เอง)';

    document.getElementById('brk_empId').value = '';  // ว่าง = add mode
    const nameInput = document.getElementById('brk_empName');
    const tgIdInput = document.getElementById('brk_empTelegramId');
    nameInput.value = '';
    tgIdInput.value = '';
    nameInput.disabled = false;
    tgIdInput.disabled = false;

    document.getElementById('brk_empTeam').value = '';
    document.getElementById('brk_empWebhook').value = '';
    document.getElementById('brk_empRoomName').value = '';
    document.getElementById('brk_empActive').checked = true;

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
    const idStr = document.getElementById('brk_empId').value;
    const isEdit = !!idStr;
    const webhook = document.getElementById('brk_empWebhook').value.trim();
    const displayName = document.getElementById('brk_empName').value.trim();
    const telegramIdStr = document.getElementById('brk_empTelegramId').value.trim();

    // validate
    if (!displayName) {
        Swal.fire({ icon: 'error', title: 'กรุณาใส่ชื่อพนักงาน' });
        return;
    }
    if (!telegramIdStr || isNaN(parseInt(telegramIdStr))) {
        Swal.fire({ icon: 'error', title: 'Telegram ID ต้องเป็นตัวเลข' });
        return;
    }
    if (webhook && !webhook.startsWith('https://discord.com/api/webhooks/')) {
        Swal.fire({ icon: 'error', title: 'URL ไม่ถูกต้อง',
            text: 'Webhook URL ต้องขึ้นต้นด้วย https://discord.com/api/webhooks/' });
        return;
    }

    const data = {
        display_name: displayName,
        team: document.getElementById('brk_empTeam').value || null,
        discord_webhook_url: webhook || null,
        discord_room_name: document.getElementById('brk_empRoomName').value.trim() || null,
        is_active: document.getElementById('brk_empActive').checked,
    };

    let error;
    if (isEdit) {
        // UPDATE
        const id = parseInt(idStr);
        ({ error } = await appDB.from('break_employees').update(data).eq('id', id));
    } else {
        // INSERT — ต้องมี telegram_id
        data.telegram_id = parseInt(telegramIdStr);
        ({ error } = await appDB.from('break_employees').insert(data));
    }

    if (error) {
        const msg = (error.code === '23505')
            ? 'Telegram ID นี้มีอยู่ในระบบแล้ว'
            : error.message;
        Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: msg });
        return;
    }

    Swal.fire({ icon: 'success', title: isEdit ? 'แก้ไขแล้ว' : 'เพิ่มแล้ว',
        timer: 1200, showConfirmButton: false });
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
    if (filterAct !== 'all') {
        rows = rows.filter(r => {
            const a = (r.activity || '').toLowerCase();
            if (filterAct === 'toilet') return a.includes('ปวด') || a.includes('ห้องน้ำ') || a.includes('toilet');
            if (filterAct === 'smoke')  return a.includes('สูบบุหรี่');
            if (filterAct === 'eat')    return a.includes('กินข้าว') || a.includes('ทาน');
            return true;
        });
    }
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

        const { icon: activityIcon, label: activityLabel } = brk_activityDisplay(r.activity);
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
