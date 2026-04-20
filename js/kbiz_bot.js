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
                bots.filter(b => b.is_active).forEach(b => {
                    const val = JSON.stringify({ u: b.username, p: b.password });
                    select.innerHTML += `<option value='${val}'>${b.machine_id} - ${b.display_name || 'ไม่ระบุชื่อ'}</option>`;
                });
            }
        }
    } catch(e) { console.error('Load Bots Error:', e); }

    // สมัครรับข้อมูลแจ้งเตือน (Log) ตอบกลับมาจาก Extension
    window.addEventListener('BOT_STATUS_UPDATE', function(e) {
        addBotLog(e.detail.message, e.detail.status);
    });
};

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
    const bank = document.getElementById('botTargetBank').value;
    const acc = document.getElementById('botTargetAcc').value.trim();
    const name = document.getElementById('botTargetName').value.trim();

    if (!u || !p || !acc || !name) {
        return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบทุกช่องก่อนเริ่มรันบอทครับ', 'warning');
    }

    addBotLog('กำลังส่งคำสั่งไปที่ Extension...', 'info');

    // ส่ง Event ออกไปให้ Chrome Extension (ที่เป็นเสาอากาศ) รับทราบ
    window.dispatchEvent(new CustomEvent('START_KBIZ_BOT', {
        detail: {
            username: u,
            password: p,
            bank_name: bank,
            acc_no: acc,
            target_name: name
        }
    }));
};
