// ==========================================
// 🧠 ตัวแปรส่วนกลาง (Global Variables)
// ==========================================
const DB_URL = 'https://zedbbtjxuidfubpiauyb.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZGJidGp4dWlkZnVicGlhdXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjQ2ODgsImV4cCI6MjA4MzIwMDY4OH0.4orJyfFcOwnZcnHFjLOTLXaqFNeapCVe9yCxj3rLMBM';

let appDB;
let currentUser = {};
let TEAM_LIST = ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188'];
let GLOBAL_USER_LIST = [];

// ==========================================
// 🚀 เริ่มทำงานเมื่อเปิดเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme');
    if(savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        const themeIcon = document.getElementById('themeIcon');
        if(themeIcon) themeIcon.innerText = 'light_mode';
        const cb = document.getElementById('themeToggleCb');
        if(cb) cb.checked = true;
    }

    if (window.supabase) {
        appDB = window.supabase.createClient(DB_URL, DB_KEY);
    }

    const savedUser = sessionStorage.getItem('user_platinum_plus');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('main-layout').classList.remove('hidden');
        showPage('dashboard');
    } else {
        showLogin();
    }
});

// ==========================================
// 🔄 ระบบดึงหน้าเว็บ (Router) และกระตุ้นสมองกล
// ==========================================
async function showLogin() {
    const loading = document.getElementById('loading');
    if(loading) loading.classList.remove('hidden');
    try {
        const response = await fetch('./pages/login.html');
        const html = await response.text();
        document.getElementById('login-container').innerHTML = html;
        
        if(typeof setupPinInputs === 'function') setupPinInputs();
        
        const savedName = localStorage.getItem('remember_me_name');
        if (savedName && document.getElementById('loginName')) {
            document.getElementById('loginName').value = savedName;
            document.getElementById('rememberMe').checked = true;
        }
    } catch (err) {
        console.error('Error loading login:', err);
    } finally {
        if(loading) loading.classList.add('hidden');
    }
}

// 1. สร้างตัวแปรเก็บ Cache สำหรับ HTML String
const pageCache = {};

async function showPage(pageName) {
    const loading = document.getElementById('loading');
    
    try {
        if (!pageCache[pageName] && loading) loading.classList.remove('hidden');
        
        if (!pageCache[pageName]) {
            const response = await fetch(`./pages/${pageName}.html`);
            if (!response.ok) throw new Error('Page not found');
            pageCache[pageName] = await response.text();
        }
        
        const htmlContent = pageCache[pageName];

        // 🌟 ฟังก์ชันอัปเดตหน้าจอและการรันสคริปต์
        const updateDOM = () => {
            const appContent = document.getElementById('app-content');
            appContent.innerHTML = htmlContent;
            appContent.classList.remove('hidden'); // ป้องกันหน้าจอดำ
            
            document.querySelectorAll('.nm-menu-title').forEach(el => el.classList.remove('active'));
            const activeBtn = document.querySelector(`button[onclick*="showPage('${pageName}')"]`);
            if (activeBtn) activeBtn.classList.add('active');

            requestAnimationFrame(async () => {
                if(document.getElementById('uName') && currentUser && currentUser.username) {
                    document.getElementById('uName').innerText = currentUser.username;
                }

                if (pageName === 'dashboard') {
                    if (typeof initDashboard === 'function') initDashboard(); // 👈 เพิ่มบรรทัดนี้เข้าไปครับ
                    if (typeof refreshAdminData === 'function') refreshAdminData();
                    if (typeof fetchData === 'function') fetchData();
                    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
                        if (document.getElementById('userManagerUIBlock')) {
                            document.getElementById('userManagerUIBlock').classList.remove('hidden');
                            document.getElementById('userManagerUIBlock').classList.add('flex');
                        }
                    }
                }
                else if (pageName === 'fine') {
                    if (typeof initFineApp === 'function') await initFineApp();
                }
                else if (pageName === 'kb') {
                    if (typeof initKbApp === 'function') await initKbApp();
                }
                else if (pageName === 'leave') {
                    if (typeof initLeaveTable === 'function') await initLeaveTable();
                }
                else if (pageName === 'gallery') {
                    if (typeof initGalleryApp === 'function') initGalleryApp();
                }
                else if (pageName === 'duty') {
                    if (typeof initDutyApp === 'function') await initDutyApp();
                }
                else if (pageName === 'discord') {
                    if (typeof applyDiscordPermissions === 'function') applyDiscordPermissions();
                }
                else if (pageName === 'summary') {
                    if (typeof initSummaryDate === 'function') initSummaryDate();
                    if (typeof fetchAvailableDates === 'function') fetchAvailableDates(); 
                    if (typeof fetchHistoricalSummary === 'function') await fetchHistoricalSummary(true); 
                }
                else if (pageName === 'telegram') {
                    if (typeof initTelegramApp === 'function') await initTelegramApp();
                }
                else if (pageName === 'password') {
                    if (typeof initPasswordApp === 'function') await initPasswordApp();
                }
                else if (pageName === 'files') {
                    if (typeof initFilesApp === 'function') await initFilesApp(); 
                }
                else if (pageName === 'sheet') {
                    if (typeof fetchSheets === 'function') await fetchSheets(); 
                    if (typeof renderSheetMenu === 'function') renderSheetMenu();
                    if (typeof renderRecentTabs === 'function') renderRecentTabs();
                    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
                        if(document.getElementById('sheetAdminControls')) document.getElementById('sheetAdminControls').classList.remove('hidden');
                    }
                    
                    // 🌟 เพิ่มโค้ดตรงนี้: เพื่อปลดล็อกให้กรอบตารางงาน (sheetApp) แสดงขึ้นมา
                    const sheetApp = document.getElementById('sheetApp');
                    if (sheetApp) {
                        sheetApp.classList.remove('hidden');
                        sheetApp.classList.add('flex');
                    }

                    // โค้ดเดิม
                    if (document.getElementById('sheetMenu')) document.getElementById('sheetMenu').classList.remove('hidden');
                    if (document.getElementById('sheetViewer')) {
                        document.getElementById('sheetViewer').classList.add('hidden');
                        document.getElementById('sheetViewer').classList.remove('flex');
                    }
                }
                else if (pageName === 'kbiz') {
                    if (typeof fetchKbizData === 'function') await fetchKbizData();
                }
                else if (pageName === 'announcement') {
                    if (typeof renderAnnouncementUI === 'function') renderAnnouncementUI();
                    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
                        if(document.getElementById('adminAnnouncementControls')) document.getElementById('adminAnnouncementControls').classList.remove('hidden');
                    }
                }
                else if (pageName === 'swap') {
                    if (typeof openAutoSwapModal === 'function') await openAutoSwapModal();
                }
            });
        };

        // ใช้ View Transitions สลับหน้าแบบสมูท (ถ้าบราวเซอร์รองรับ)
        if (document.startViewTransition) {
            document.startViewTransition(() => updateDOM());
        } else {
            updateDOM();
        }

    } catch (err) {
        console.error(err);
        document.getElementById('app-content').innerHTML = `<div class="p-10 text-center text-red-500 font-bold">เกิดข้อผิดพลาดในการโหลดหน้า ${pageName}<br><br><span class="text-xs text-gray-500">${err.message}</span></div>`;
    } finally {
        if(loading) loading.classList.add('hidden');
    }
}

// ==========================================
// 🎨 ระบบเปลี่ยนโหมดสี
// ==========================================
function toggleTheme() {
    const cb = document.getElementById('themeToggleCb');
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = 'light_mode';
        localStorage.setItem('theme', 'light');
        if(cb) cb.checked = false;
    } else {
        document.documentElement.classList.add('dark');
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = 'dark_mode';
        localStorage.setItem('theme', 'dark');
        if(cb) cb.checked = true;
    }
}

// ==========================================
// 🧩 ระบบดึง HTML Template (ต้องอยู่ไฟล์ global.js)
// ==========================================
window.renderTemplate = function(templateId, data = {}) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return '';
    let html = tpl.innerHTML;
    for (const key in data) {
        html = html.split(`{{${key}}}`).join(data[key] !== undefined && data[key] !== null ? data[key] : '');
    }
    return html;
};

// ==========================================
// 🛠️ ฟังก์ชันเพิ่มแผนก และ Role ลงฐานข้อมูล (ดึงจากช่อง Input)
// ==========================================

window.addCustomPermDept = async function() {
    const inputEl = document.getElementById('newDeptInput');
    if (!inputEl) return Swal.fire('Error', 'ไม่พบช่องกรอกชื่อแผนก', 'error');
    
    const deptName = inputEl.value.toUpperCase().trim();
    if (!deptName) return Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์ชื่อแผนกก่อนกดเพิ่มครับ', 'warning');

    // ดึงค่าเดิมจากระบบมาก่อน
    let currentDepts = [];
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'custom_departments').single();
        if(data && data.value) currentDepts = JSON.parse(data.value);
    } catch(e) {}

    if (!currentDepts.includes(deptName)) {
        currentDepts.push(deptName);
        Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        await appDB.from('settings').upsert([{ key: 'custom_departments', value: JSON.stringify(currentDepts) }]);
        
        inputEl.value = ''; // เคลียร์ช่องพิมพ์
        await window.loadSettings(); // โหลดข้อมูลและวาดตารางใหม่
        
        Swal.fire({icon: 'success', title: 'สำเร็จ', text: `เพิ่มแผนก ${deptName} แล้ว`, timer: 1500, showConfirmButton: false});
    } else {
        Swal.fire('เตือน', 'มีแผนกนี้ในระบบแล้ว', 'warning');
    }
};

window.addCustomPermRole = async function() {
    const inputEl = document.getElementById('newRoleInput');
    if (!inputEl) return Swal.fire('Error', 'ไม่พบช่องกรอกชื่อ Role', 'error');
    
    const roleName = inputEl.value.toLowerCase().trim();
    if (!roleName) return Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์ชื่อ Role ก่อนกดเพิ่มครับ', 'warning');

    let currentRoles = [];
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'custom_roles').single();
        if(data && data.value) currentRoles = JSON.parse(data.value);
    } catch(e) {}

    if (!currentRoles.includes(roleName)) {
        currentRoles.push(roleName);
        Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        await appDB.from('settings').upsert([{ key: 'custom_roles', value: JSON.stringify(currentRoles) }]);
        
        inputEl.value = ''; // เคลียร์ช่องพิมพ์
        await window.loadSettings(); // โหลดข้อมูลและวาดตารางใหม่
        
        Swal.fire({icon: 'success', title: 'สำเร็จ', text: `เพิ่มตำแหน่ง ${roleName.toUpperCase()} แล้ว`, timer: 1500, showConfirmButton: false});
    } else {
        Swal.fire('เตือน', 'มีตำแหน่งนี้ในระบบแล้ว', 'warning');
    }
};