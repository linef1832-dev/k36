// ฟังก์ชันนี้จะถูกเรียกใช้ตอนที่หน้า Dashboard โหลดขึ้นมา (ถูกสั่งจาก global.js)
function fetchData() {
    // ดึงชื่อคนที่ล็อกอินมาแสดง
    if (currentUser && currentUser.username) {
        const nameEl = document.getElementById('dashboard-username');
        if (nameEl) nameEl.innerText = currentUser.username;
    }
    
    // ปิดตัวโหลด (เอาสปินเนอร์ที่หมุนค้างออก)
    document.getElementById('loading').classList.add('hidden');
    
    console.log("หน้า Dashboard โหลดสำเร็จเรียบร้อย!");
}