// ฟังก์ชันเริ่มทำงานเมื่อเปิดหน้านี้
window.initKbizBotPage = async function() {
    const select = document.getElementById('botSelectAcc');
    if (!select) return;

    // ดึงบัญชีบอทที่บันทึกไว้ในฐานข้อมูลมาใส่ Dropdown
    try {
        if(typeof appDB !== 'undefined') {
            const { data } = await appDB.from('settings').select('value').eq('key', 'kbiz_bots_data').single();
            if (data && data.value) {
                const bots = JSON.parse(data.value);
                // เอามาโชว์เฉพาะบอทที่ "เปิดใช้งาน" อยู่
                select.innerHTML = '<option value="">-- พิมพ์เองด้านล่าง --</option>'; // Reset
                bots.filter(b => b.is_active).forEach(b => {
                    const val = JSON.stringify({ u: b.username, p: b.password });
                    select.innerHTML += `<option value='${val}'>${b.machine_id} - ${b.display_name || 'ไม่ระบุชื่อ'}</option>`;
                });
            }
        }
    } catch(e) { console.error('Load Bots Error:', e); }

    // สมัครรับข้อมูลแจ้งเตือน (Log) ตอบกลับมาจาก Extension
    window.removeEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
    window.addEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
};

function handleBotStatusUpdate(e) {
    addBotLog(e.detail.message, e.detail.status);
}

// กรอกข้อมูลล็อกอินอัตโนมัติเมื่อเลือกบอท
window.autoFillBotLogin = function() {
    const val = document.getElementById('botSelectAcc').value;
    if (val) {
        const creds = JSON.parse(val);
        document.getElementById('botUsername').value = creds.u;
        document.getElementById('botPassword').value = creds.p;
    } else {
        document.getElementById('botUsername').value = '';
        document.getElementById('botPassword').value = '';
    }
};

// ฟังก์ชันเพิ่ม Log หน้าจอ
function addBotLog(message, status = 'info') {
    const logArea = document.getElementById('botLogArea');
    if (!logArea) return;
    
    const time = new Date().toLocaleTimeString('th-TH');
    let colorClass = 'text-green-400';
    if (status === 'error') colorClass = 'text-red-400';
    if (status === 'warning') colorClass = 'text-yellow-400';
    if (status === 'success') colorClass = 'text-sky-400 font-bold';

    logArea.innerHTML += `<div><span class="text-gray-500">[${time}]</span> <span class="${colorClass}">>> ${message}</span></div>`;
    logArea.scrollTop = logArea.scrollHeight;
}

// ฟังก์ชันเริ่มสั่งงาน
window.startKbizBotProcess = function() {
    const u = document.getElementById('botUsername').value.trim();
    const p = document.getElementById('botPassword').value.trim();

    if (!u || !p) {
        return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกรหัสผู้ใช้งาน และ รหัสผ่าน K BIZ ก่อนเริ่มรันบอทครับ', 'warning');
    }

    addBotLog('กำลังส่งคำสั่งไปที่ Extension ให้เริ่มสแกนระบบหลังบ้าน...', 'info');

    // ส่ง Event ออกไปให้ Chrome Extension (ที่เป็นเสาอากาศรับเรื่อง)
    // ส่งไปแค่ข้อมูลล็อกอิน K BIZ ส่วนข้อมูลบัญชีให้ตัว Extension หาเอง
    window.dispatchEvent(new CustomEvent('START_KBIZ_BOT', {
        detail: {
            username: u,
            password: p
        }
    }));
};
