// ==========================================
// 🚀 1. ศูนย์รวมกลุ่มงาน (TELEGRAM HUB)
// ==========================================
let globalTeleLinks = [];
let currentTeleFilter = 'all';

// ฟังก์ชันเตรียมความพร้อมก่อนเปิดหน้า Telegram
async function initTelegramApp() {
    const catSelect = document.getElementById('teleCategory');
    if (catSelect) {
        // ใส่รายชื่อทีมลงใน Dropdown เลือกหมวดหมู่ตอนสร้างกลุ่มใหม่
        catSelect.innerHTML = TEAM_LIST.map(t => `<option value="${t}">${t}</option>`).join('') + `<option value="General">กลุ่มกลาง</option>`;
    }
    
    // โชว์ปุ่มแอดมินเฉพาะแอดมิน
    if (currentUser.role === 'manager' || currentUser.role === 'admin') {
        document.getElementById('teleAdminControls')?.classList.remove('hidden');
    }
    
    await fetchTeleLinks();
}

// ฟังก์ชันดึงข้อมูลลิงก์ Telegram จาก Supabase
async function fetchTeleLinks() {
    const grid = document.getElementById('teleGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="col-span-full text-center py-10"><span class="material-icons animate-spin text-sky-500 text-4xl">sync</span></div>`;
    
    const { data, error } = await appDB.from('telegram_links').select('*').order('created_at', { ascending: false });
    if (data) {
        globalTeleLinks = data;
        renderTeleFilter();
        renderTeleGrid();
    }
}

// ฟังก์ชันสร้างปุ่มตัวกรอง (Filter) ด้านบน
function renderTeleFilter() {
    const container = document.getElementById('teleFilterContainer');
    if (!container) return;
    
    // ดึงหมวดหมู่ที่มีอยู่มาสร้างเป็นปุ่มกรอง โดยเอาคำว่า "General" ไว้หน้าสุด
    const webs = [...new Set(globalTeleLinks.map(l => l.category))].sort();
    if (!webs.includes('General')) webs.unshift('General'); 

    let html = `<button onclick="filterTele('all')" class="px-3 py-1 rounded-full text-sm font-bold border transition ${currentTeleFilter === 'all' ? 'bg-sky-600 text-white border-sky-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}">ทั้งหมด</button>`;
    
    webs.forEach(w => {
        const isActive = currentTeleFilter === w;
        const activeClass = isActive ? 'bg-sky-600 text-white border-sky-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
        const label = w === 'General' ? '🌐 กลุ่มกลาง' : w;
        html += `<button onclick="filterTele('${w}')" class="px-3 py-1 rounded-full text-sm font-bold border transition ${activeClass}">${label}</button>`;
    });
    
    container.innerHTML = html;
}

// ฟังก์ชันเมื่อกดปุ่มกรอง
window.filterTele = function(category) {
    currentTeleFilter = category;
    renderTeleFilter(); // อัปเดตสีปุ่ม
    renderTeleGrid();   // วาดตารางใหม่ตามการกรอง
}

// 🌟 ฟังก์ชันวาดการ์ดแสดงลิงก์ Telegram (ใช้ระบบ Template)
function renderTeleGrid() {
    const grid = document.getElementById('teleGrid');
    if (!grid) return;
    let links = globalTeleLinks;

    // กรองตามหมวด
    if (currentTeleFilter !== 'all') links = links.filter(l => l.category === currentTeleFilter);

    // กรองตาม search
    const searchVal = (document.getElementById('teleSearch')?.value || '').toLowerCase().trim();
    if (searchVal) links = links.filter(l => (l.name || '').toLowerCase().includes(searchVal) || (l.category || '').toLowerCase().includes(searchVal));

    // กรองตาม status
    const statusFilter = document.getElementById('teleStatusFilter')?.value || 'all';
    if (statusFilter !== 'all') links = links.filter(l => (l.status || 'active') === statusFilter);

    if (links.length === 0) {
        grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400"><span class="material-icons text-6xl mb-2 opacity-20">sentiment_dissatisfied</span><p>ไม่พบกลุ่มงานในหมวดนี้</p></div>`;
        return;
    }

    const colorMap = { blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', red: 'bg-red-100 text-red-600', orange: 'bg-orange-100 text-orange-600', purple: 'bg-purple-100 text-purple-600', gray: 'bg-gray-100 text-gray-600' };
    const statusMap = {
        active:   '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800">🟢 Active</span>',
        paused:   '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">🟡 ปิดชั่วคราว</span>',
        archived: '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-600">⚫ เก็บถาวร</span>',
    };
    const isAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');

    grid.innerHTML = links.map(link => {
        const colorClass  = colorMap[link.icon_color] || colorMap['blue'];
        const statusBadge = statusMap[link.status || 'active'] || statusMap['active'];
        const isInactive  = link.status === 'archived' || link.status === 'paused';

        const adminBtns = isAdmin ? `
            <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                <button onclick="editTeleLink(${link.id})" class="text-gray-400 hover:text-orange-500 p-1 bg-white/50 dark:bg-black/20 rounded-md transition" title="แก้ไข"><span class="material-icons text-[18px]">edit</span></button>
                <button onclick="deleteTeleLink(${link.id})" class="text-gray-400 hover:text-red-500 p-1 bg-white/50 dark:bg-black/20 rounded-md transition" title="ลบ"><span class="material-icons text-[18px]">delete</span></button>
            </div>` : '';

        return window.renderTemplate('tpl-tele-card', {
            adminBtns,
            colorClass: colorClass + (isInactive ? ' opacity-50' : ''),
            category:   link.category === 'General' ? '🌐 กลุ่มกลาง' : link.category,
            name:       link.name,
            url:        link.url,
            statusBadge,
        });
    }).join('');
}

// ฟังก์ชันเปิดป๊อปอัปสำหรับเพิ่มลิงก์ใหม่
window.openAddTeleModal = function() {
    document.getElementById('teleModal').classList.remove('hidden');
    document.getElementById('teleId').value = ''; 
    document.getElementById('teleName').value = '';
    document.getElementById('teleUrl').value = '';
    document.getElementById('teleModalTitle').innerHTML = '<span class="material-icons">add_link</span> เพิ่มลิงก์ใหม่';
    document.getElementById('teleSubmitBtn').innerText = 'บันทึกข้อมูล';
}

// ฟังก์ชันเปิดป๊อปอัปสำหรับแก้ไขลิงก์เดิม
window.editTeleLink = function(id) {
    const link = globalTeleLinks.find(l => l.id === id);
    if (!link) return;
    document.getElementById('teleId').value = link.id;
    document.getElementById('teleName').value = link.name;
    document.getElementById('teleCategory').value = link.category;
    document.getElementById('teleColor').value = link.icon_color;
    document.getElementById('teleUrl').value = link.url;
    if (document.getElementById('teleStatus')) document.getElementById('teleStatus').value = link.status || 'active';

    document.getElementById('teleModalTitle').innerHTML = '<span class="material-icons text-orange-400">edit</span> แก้ไขข้อมูลลิงก์';
    document.getElementById('teleSubmitBtn').innerText = 'บันทึกการแก้ไข';
    document.getElementById('teleSubmitBtn').className = "w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg transition transform active:scale-95 mt-2";
    document.getElementById('teleModal').classList.remove('hidden');
}

// ฟังก์ชันปิดป๊อปอัป
window.closeTeleModal = function() {
    document.getElementById('teleModal').classList.add('hidden');
    document.getElementById('teleSubmitBtn').className = "w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl shadow-lg transition transform active:scale-95 mt-2";
}

// ฟังก์ชันบันทึกข้อมูลลิงก์ลง Database (Supabase)
window.saveTeleLink = async function(e) {
    e.preventDefault();
    const id = document.getElementById('teleId').value;
    const payload = {
        name: document.getElementById('teleName').value,
        url: document.getElementById('teleUrl').value,
        category: document.getElementById('teleCategory').value,
        icon_color: document.getElementById('teleColor').value,
        status: document.getElementById('teleStatus')?.value || 'active'
    };
    if (!payload.name || !payload.url) return;

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    let error;
    if (id) { 
        // อัปเดตข้อมูล
        const res = await appDB.from('telegram_links').update(payload).eq('id', id); 
        error = res.error; 
    } 
    else { 
        // สร้างข้อมูลใหม่
        const res = await appDB.from('telegram_links').insert([payload]); 
        error = res.error; 
    }

    if (error) Swal.fire('Error', error.message, 'error');
    else {
        closeTeleModal(); 
        await fetchTeleLinks(); // รีเฟรชตารางใหม่
        Swal.fire({ icon: 'success', title: id ? 'อัปเดตเรียบร้อย' : 'เพิ่มเรียบร้อย', timer: 1500, showConfirmButton: false });
    }
}

// ฟังก์ชันลบลิงก์
window.deleteTeleLink = async function(id) {
    const result = await Swal.fire({ title: 'ลบกลุ่มนี้?', text: "เอาจริงดิ?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย' });
    if (result.isConfirmed) {
        await appDB.from('telegram_links').delete().eq('id', id);
        fetchTeleLinks();
        Swal.fire('Deleted', '', 'success');
    }
}

// ฟังก์ชันคัดลอกลิงก์เก็บไว้ใน Clipboard
window.copyToClip = function(text) {
    navigator.clipboard.writeText(text);
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 }).fire({ icon: 'success', title: 'คัดลอกลิงก์แล้ว' });
}
