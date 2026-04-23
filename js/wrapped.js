// ====================================================
// 🎵 ระบบ Employee Wrapped (สรุปผลงานสไตล์ Spotify)
// ====================================================

let wrappedSlideIndex = 0;
let wrappedTotalSlides = 5;
let wrappedTimer = null;
let wrappedSlideDuration = 5000; // 5 วินาทีต่อ 1 หน้า

window.openEmployeeWrapped = async function() {
    if (typeof currentUser === 'undefined' || !currentUser) {
        return Swal.fire('ข้อผิดพลาด', 'กรุณาล็อกอินก่อนใช้งานฟีเจอร์นี้ครับ', 'error');
    }

    Swal.fire({
        title: 'กำลังประมวลผลงานของคุณ...',
        html: 'รอสักครู่ ระบบกำลังรวบรวมสถิติประจำเดือนนี้ ✨',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-3xl' }
    });

    try {
        // 1. ดึงข้อมูลของเดือนปัจจุบัน
        const now = new Date();
        const year = now.getFullYear();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const startOfMonth = `${year}-${monthStr}-01`;
        
        // 🌟 เพิ่มตัวแปรคำนวณวันสิ้นเดือน
        const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
        const endOfMonth = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
        
        const monthName = now.toLocaleString('th-TH', { month: 'long' });

        // ดึงสถิติทำรายการจาก summary
        const { data: summaryData } = await appDB.from('transaction_daily_summary')
            .select('*')
            .eq('employee_name', currentUser.username)
            .gte('date', startOfMonth)
            .lte('date', endOfMonth); // 🌟 ล็อกไม่ให้เกินวันสิ้นเดือน
            
        // ดึงสถิติวันหยุดจาก leave_requests
        const { data: leaveData } = await appDB.from('leave_requests')
            .select('*')
            .eq('user_name', currentUser.username)
            .gte('leave_date', startOfMonth)
            .lte('leave_date', endOfMonth); // 🌟 ล็อกไม่ให้ดึงวันหยุดที่จองล่วงหน้าของเดือนถัดไปมานับ

        let totalBills = 0;
        let totalApproved = 0;
        let webStats = {};
        
        if (summaryData) {
            summaryData.forEach(r => {
                let c = parseInt(r.count) || 0;
                let appCount = (r.approved_count !== undefined && r.approved_count !== null) ? parseInt(r.approved_count) : c;
                
                totalBills += c;
                totalApproved += appCount;

                if (!webStats[r.website]) webStats[r.website] = 0;
                webStats[r.website] += c;
            });
        }

        // หาเว็บที่ทำบ่อยสุด
        let topWeb = '-';
        let topWebCount = 0;
        for (const [w, c] of Object.entries(webStats)) {
            if (c > topWebCount) { topWeb = w; topWebCount = c; }
        }

        // สรุปยอดวันหยุด
        let totalLeaves = 0;
        let leaveBreakdown = {};
        if (leaveData) {
            leaveData.forEach(l => {
                let rsn = l.reason || 'X';
                if (rsn === 'Table-Booking') rsn = 'X';
                totalLeaves++;
                if (!leaveBreakdown[rsn]) leaveBreakdown[rsn] = 0;
                leaveBreakdown[rsn]++;
            });
        }

        Swal.close();

        // 2. สร้างหน้าจอ UI
        const wrapData = {
            month: monthName,
            year: year + 543,
            totalBills: totalBills,
            totalApproved: totalApproved,
            topWeb: topWeb,
            topWebCount: topWebCount,
            totalLeaves: totalLeaves,
            leaveBreakdown: leaveBreakdown
        };

        buildWrappedUI(wrapData);

    } catch (e) {
        Swal.fire('เกิดข้อผิดพลาด', e.message, 'error');
    }
};

function buildWrappedUI(data) {
    // ลบอันเก่าถ้ามีค้าง
    const oldOverlay = document.getElementById('wrapped-overlay');
    if (oldOverlay) oldOverlay.remove();
    clearInterval(wrappedTimer);

    wrappedSlideIndex = 0;

    // ชุดสีและข้อความของแต่ละ Slide
    const slidesHTML = `
        <!-- Slide 0: Intro -->
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-center transition-opacity duration-500 opacity-100 z-10" id="slide-0">
            <div class="text-6xl mb-6 animate-bounce">👋</div>
            <h2 class="text-3xl font-black text-white mb-2 drop-shadow-lg">สวัสดี, ${currentUser.username}</h2>
            <p class="text-lg text-purple-200 font-bold">เดือน ${data.month} นี้ผ่านไปไวเหมือนโกหก...</p>
            <p class="text-md text-gray-400 mt-4">มาดูกันดีกว่าว่าคุณลุยงานไปแค่ไหน!</p>
        </div>

        <!-- Slide 1: ยอดบิลรวม -->
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-tr from-emerald-900 via-teal-800 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-1">
            <div class="text-7xl mb-6 animate-pulse">🔥</div>
            <p class="text-xl text-emerald-200 font-bold mb-2">ตลอดทั้งเดือนนี้ คุณทำรายการไปทั้งหมด</p>
            <h2 class="text-6xl font-black text-white mb-2 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]">${data.totalBills.toLocaleString()} <span class="text-2xl">บิล</span></h2>
            <p class="text-md text-emerald-300/80 mt-2">และเป็นบิลที่สำเร็จถึง ${data.totalApproved.toLocaleString()} รายการ!</p>
            <p class="text-sm text-gray-400 mt-6">(แอดมินปลื้มใจมาก 👏)</p>
        </div>

        <!-- Slide 2: เว็บตัวท็อป -->
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-bl from-orange-900 via-rose-900 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-2">
            <div class="text-7xl mb-6 scale-110 drop-shadow-xl">👑</div>
            <p class="text-xl text-orange-200 font-bold mb-2">เว็บที่คุณดูแลบ่อยและผูกพันที่สุดคือ</p>
            <h2 class="text-6xl font-black text-white mb-2 drop-shadow-[0_0_15px_rgba(251,146,60,0.8)]">${data.topWeb}</h2>
            <p class="text-lg text-orange-300/80 mt-2">ทำรายการให้เว็บนี้ไปถึง <b class="text-white">${data.topWebCount.toLocaleString()}</b> บิล</p>
        </div>

        <!-- Slide 3: สถิติวันหยุด -->
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-tr from-pink-900 via-rose-900 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-3">
            <div class="text-7xl mb-6 scale-110 drop-shadow-xl">${data.totalLeaves === 0 ? '🏆' : '🏖️'}</div>
            <p class="text-xl text-pink-200 font-bold mb-2">เรื่องพักผ่อนในเดือนนี้...</p>
            <h2 class="text-5xl font-black text-white mb-4 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">${data.totalLeaves === 0 ? 'คุณไม่เคยหยุดเลย!' : 'หยุดไป <span class="text-6xl">' + data.totalLeaves + '</span> วัน'}</h2>
            <div class="flex flex-wrap justify-center gap-2 mt-2">
                ${Object.entries(data.leaveBreakdown).map(([k, v]) => {
                    let label = k;
                    if(k === 'X') label = 'หยุดปกติ'; else if(k === 'KL') label = 'ลากิจ'; else if(k === 'PN') label = 'พักร้อน';
                    else if(k === 'XX') label = 'เปลี่ยนกะ'; else if(k === 'X4') label = 'ลาครึ่งวัน'; else if(k === 'TL' || k === 'TX') label = 'สลับวันหยุด';
                    return '<span class="bg-white/20 px-3 py-1 rounded-full text-sm font-bold text-white border border-white/30">' + label + ': ' + v + ' วัน</span>';
                }).join('') || '<span class="bg-white/20 px-3 py-1 rounded-full text-sm font-bold text-white border border-white/30">ขยันทำงาน 100% 👏</span>'}
            </div>
        </div>

        <!-- Slide 4: Outro -->
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-sky-900 via-blue-900 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-4">
            <div class="text-7xl mb-6 animate-bounce">💖</div>
            <h2 class="text-4xl font-black text-white mb-4 drop-shadow-lg">ขอบคุณที่ทุ่มเท!</h2>
            <p class="text-lg text-blue-200 font-bold">ทีมจะขับเคลื่อนไปไม่ได้เลย ถ้าไม่มีคุณ</p>
            <p class="text-md text-blue-300 mt-4">เตรียมตัวลุยต่อในเดือนหน้านะครับ 🚀</p>
            <button onclick="closeWrapped()" class="mt-10 px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-full backdrop-blur-md border border-white/30 transition shadow-lg">ปิดหน้าต่างนี้</button>
        </div>
    `;

    // หลอด Progress Bar ด้านบน
    let barsHtml = '';
    for (let i = 0; i < wrappedTotalSlides; i++) {
        barsHtml += `<div class="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden relative">
                        <div id="wrap-bar-${i}" class="absolute left-0 top-0 bottom-0 bg-white w-0 transition-all duration-100 ease-linear"></div>
                     </div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'wrapped-overlay';
    overlay.className = 'fixed inset-0 z-[99999] bg-black text-white overflow-hidden select-none font-sans';
    overlay.innerHTML = `
        <div class="absolute top-4 left-4 right-4 flex gap-2 z-50">${barsHtml}</div>
        <div class="absolute inset-0 z-40 flex">
            <div class="w-1/3 h-full cursor-pointer" onclick="prevWrappedSlide()"></div>
            <div class="w-2/3 h-full cursor-pointer" onclick="nextWrappedSlide()"></div>
        </div>
        ${slidesHTML}
    `;

    document.body.appendChild(overlay);
    
    // เริ่มเล่น Slide
    playWrappedSlide();
}

function playWrappedSlide() {
    // แสดงเนื้อหาของ Slide ปัจจุบัน
    document.querySelectorAll('.wrapped-slide').forEach((el, index) => {
        if (index === wrappedSlideIndex) {
            el.classList.replace('opacity-0', 'opacity-100');
            el.classList.replace('z-0', 'z-10');
        } else {
            el.classList.replace('opacity-100', 'opacity-0');
            el.classList.replace('z-10', 'z-0');
        }
    });

    // จัดการหลอด Progress
    document.querySelectorAll('[id^="wrap-bar-"]').forEach((bar, index) => {
        bar.style.transition = 'none'; // reset
        if (index < wrappedSlideIndex) bar.style.width = '100%';
        else if (index > wrappedSlideIndex) bar.style.width = '0%';
        else {
            bar.style.width = '0%';
            setTimeout(() => {
                bar.style.transition = `width ${wrappedSlideDuration}ms linear`;
                bar.style.width = '100%';
            }, 50);
        }
    });

    clearInterval(wrappedTimer);
    wrappedTimer = setInterval(nextWrappedSlide, wrappedSlideDuration);
}

window.nextWrappedSlide = function() {
    if (wrappedSlideIndex < wrappedTotalSlides - 1) { wrappedSlideIndex++; playWrappedSlide(); } 
    else { closeWrapped(); }
};

window.prevWrappedSlide = function() {
    if (wrappedSlideIndex > 0) { wrappedSlideIndex--; playWrappedSlide(); }
};

window.closeWrapped = function() {
    clearInterval(wrappedTimer);
    const overlay = document.getElementById('wrapped-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 500);
    }
};