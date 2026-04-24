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

        // 🌟 ดึงสถิติเข้างานจากตาราง Dashboard (schedules) เพื่อนับวันทำงาน
        const { data: scheduleData } = await appDB.from('schedules')
            .select('work_date, team')
            .eq('staff_name', currentUser.username)
            .gte('work_date', startOfMonth)
            .lte('work_date', endOfMonth);

        // 🌟 ดึงสถิติจากระบบจัดหน้าที่ (Duty Roster) เพื่อหา "เว็บที่ทำบ่อยสุด"
        const { data: dutyData } = await appDB.from('settings')
            .select('key, value')
            .like('key', `duty_roster_%_${year}-${monthStr}-%`);

        let totalWorkingDaysSet = new Set();
        if (scheduleData) {
            scheduleData.forEach(s => {
                totalWorkingDaysSet.add(s.work_date); // นับวันทำงานแบบไม่ซ้ำกัน
            });
        }
        
        let dutyTeamCount = {};
        if (dutyData) {
            dutyData.forEach(row => {
                try {
                    const roster = JSON.parse(row.value);
                    for (const team in roster) {
                        const users = roster[team];
                        if (users && Array.isArray(users)) {
                            const isAssigned = users.some(u => String(u.username).toLowerCase() === String(currentUser.username).toLowerCase());
                            if (isAssigned) {
                                if (!dutyTeamCount[team]) dutyTeamCount[team] = 0;
                                dutyTeamCount[team]++;
                            }
                        }
                    }
                } catch(e) {}
            });
        }

        let topTeam = '-';
        let topTeamDays = 0;
        for (const [t, count] of Object.entries(dutyTeamCount)) {
            if (count > topTeamDays) {
                topTeam = t;
                topTeamDays = count;
            }
        }

        // ดึงสถิติใบปรับ
        const { data: fineData } = await appDB.from('fines')
            .select('amount, offense_date, created_at')
            .eq('user_name', currentUser.username);

        let totalBills = 0;
        let totalApproved = 0;
        
        if (summaryData) {
            summaryData.forEach(r => {
                let c = parseInt(r.count) || 0;
                let appCount = (r.approved_count !== undefined && r.approved_count !== null) ? parseInt(r.approved_count) : c;
                
                totalBills += c;
                totalApproved += appCount;
            });
        }

        // สรุปยอดใบปรับ
        let totalFineCount = 0;
        let totalFineAmount = 0;
        if (fineData) {
            fineData.forEach(f => {
                const d = f.offense_date ? new Date(f.offense_date) : new Date(f.created_at);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                if (`${y}-${m}` === `${year}-${monthStr}`) {
                    totalFineCount++;
                    if (f.amount > 0) totalFineAmount += Number(f.amount);
                }
            });
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
            topWeb: topTeam,
            topWebDays: topTeamDays,
            totalWorkingDays: totalWorkingDaysSet.size,
            totalFineCount: totalFineCount,
            totalFineAmount: totalFineAmount,
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

    let slidesHTML = '';
    let slideCount = 0;

    // Slide 0: Intro
    slidesHTML += `
        <!-- Slide 0: Intro -->
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-center transition-opacity duration-500 opacity-100 z-10" id="slide-${slideCount++}">
            <div class="text-5xl mb-4 animate-bounce">👋</div>
            <h2 class="text-2xl font-black text-white mb-2 drop-shadow-lg">สวัสดี, ${currentUser.username}</h2>
            <p class="text-base text-purple-200 font-bold">เดือน ${data.month} นี้ผ่านไปไวเหมือนโกหก...</p>
            <p class="text-sm text-gray-400 mt-4">มาดูกันดีกว่าว่าคุณลุยงานไปแค่ไหน!</p>
        </div>
    `;

    // 🌟 แยกเงื่อนไข: ถ้ามีการจัดหน้าที่ ให้โชว์ "เจ้าแห่งเว็บ" ก่อน
    if (data.topWebDays > 0) {
        // Slide 1: เจ้าแห่งเว็บ (จากระบบจัดหน้าที่ Duty)
        slidesHTML += `
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-bl from-orange-900 via-rose-900 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-${slideCount++}">
            <div class="text-7xl mb-4 scale-110 drop-shadow-[0_0_20px_rgba(251,146,60,0.8)] animate-pulse">👑</div>
            <p class="text-xl text-orange-200 font-bold mb-2">ฉายาของคุณเดือนนี้คือ...</p>
            <h2 class="text-4xl font-black text-white mb-2 drop-shadow-lg">เจ้าแห่งเว็บ<br><span class="text-6xl text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)] leading-tight mt-2 block">${data.topWeb}</span></h2>
            <div class="mt-4 bg-black/20 px-5 py-3 rounded-2xl border border-orange-500/30 backdrop-blur-sm shadow-inner">
                <p class="text-sm text-orange-200">ถูกจัดหน้าที่ให้ดูแลเว็บนี้ถึง</p>
                <p class="text-4xl font-black text-white mt-1">${data.topWebDays} <span class="text-base font-normal text-orange-100">ครั้ง!</span></p>
            </div>
        </div>
        `;
    }

    if (data.totalBills > 0) {
        // Slide 1: ยอดบิลรวม
        slidesHTML += `
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-tr from-emerald-900 via-teal-800 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-${slideCount++}">
            <div class="text-6xl mb-4 animate-pulse">🔥</div>
            <p class="text-lg text-emerald-200 font-bold mb-2">${data.totalWorkingDays > 0 ? 'และ' : ''}ตลอดทั้งเดือนนี้ คุณทำรายการไป</p>
            <h2 class="text-5xl font-black text-white mb-2 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]">${data.totalBills.toLocaleString()} <span class="text-xl">บิล</span></h2>
            <p class="text-sm text-emerald-300/80 mt-2">และสำเร็จถึง ${data.totalApproved.toLocaleString()} รายการ!</p>
            <p class="text-xs text-gray-400 mt-6">(สุดยอดมือทำรายการ 👏)</p>
        </div>
        `;
    }
    
    if (data.totalWorkingDays === 0 && data.totalBills === 0) {
        // Slide สำหรับ Admin / พนักงานที่ไม่ได้ทำบิลและไม่ได้ลงเวลา (ออฟฟิศ/Support)
        slidesHTML += `
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-tr from-blue-900 via-indigo-800 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-${slideCount++}">
            <div class="text-6xl mb-4 animate-pulse">🛡️</div>
            <p class="text-lg text-blue-200 font-bold mb-2">ในฐานะทีมซัพพอร์ต / แอดมิน</p>
            <h2 class="text-3xl font-black text-white mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]">คุณคือเบื้องหลังความสำเร็จ!</h2>
            <p class="text-sm text-blue-300/80 mt-2">คอยดูแลและสนับสนุนทีมงานตลอดทั้งเดือน</p>
            <p class="text-xs text-gray-400 mt-6">(เหนื่อยหน่อยนะเดือนนี้ ✌️)</p>
        </div>
        `;
    }

    // Slide: สถิติวันหยุด
    slidesHTML += `
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-tr from-pink-900 via-rose-900 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-${slideCount++}">
            <div class="text-6xl mb-4 scale-110 drop-shadow-xl">${data.totalLeaves === 0 ? '🏆' : '🏖️'}</div>
            <p class="text-lg text-pink-200 font-bold mb-2">เรื่องพักผ่อนในเดือนนี้...</p>
            <h2 class="text-3xl font-black text-white mb-4 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">${data.totalLeaves === 0 ? 'คุณไม่เคยหยุดเลย!' : 'หยุดไป <span class="text-5xl">' + data.totalLeaves + '</span> วัน'}</h2>
            <div class="flex flex-wrap justify-center gap-1.5 mt-2">
                ${Object.entries(data.leaveBreakdown).map(([k, v]) => {
                    let label = k;
                    if(k === 'X') label = 'หยุดปกติ'; else if(k === 'KL') label = 'ลากิจ'; else if(k === 'PN') label = 'พักร้อน';
                    else if(k === 'XX') label = 'เปลี่ยนกะ'; else if(k === 'X4') label = 'ลาครึ่งวัน'; else if(k === 'TL' || k === 'TX') label = 'สลับวันหยุด';
                    return '<span class="bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold text-white border border-white/30">' + label + ': ' + v + ' วัน</span>';
                }).join('') || '<span class="bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white border border-white/30">ขยันทำงาน 100% 👏</span>'}
            </div>
        </div>
    `;

    // Slide: สถิติใบปรับ
    if (data.totalFineCount > 0) {
        slidesHTML += `
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-tr from-red-900 via-rose-900 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-${slideCount++}">
            <div class="text-6xl mb-4 animate-pulse">🚨</div>
            <p class="text-lg text-red-200 font-bold mb-2">โอ๊ะโอ... เดือนนี้แอบพลาดไปนิด</p>
            <h2 class="text-3xl font-black text-white mb-2 drop-shadow-lg">โดนใบปรับไป <span class="text-5xl text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.8)]">${data.totalFineCount}</span> ครั้ง</h2>
            <div class="mt-4 bg-black/20 px-5 py-3 rounded-2xl border border-red-500/30 backdrop-blur-sm shadow-inner">
                <p class="text-sm text-red-200">รวมเป็นเงินทั้งสิ้น</p>
                <p class="text-4xl font-black text-white mt-1">฿${data.totalFineAmount.toLocaleString('en-US')} <span class="text-base font-normal text-red-100">บาท</span></p>
            </div>
            <p class="text-xs text-gray-400 mt-6">(เดือนหน้าเอาใหม่นะ ✌️)</p>
        </div>
        `;
    } else {
        slidesHTML += `
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-tr from-emerald-900 via-green-800 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-${slideCount++}">
            <div class="text-6xl mb-4 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)] animate-bounce">🛡️</div>
            <p class="text-lg text-emerald-200 font-bold mb-2">เรื่องระเบียบวินัยในเดือนนี้...</p>
            <h2 class="text-3xl font-black text-white mb-2 drop-shadow-lg">คุณรอดพ้นจาก<br><span class="text-5xl text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)] leading-tight mt-2 block">ใบปรับ 100%</span></h2>
            <p class="text-sm text-emerald-300/80 mt-4">การทำงานไร้ที่ติ แอดมินขอคารวะ 👏</p>
        </div>
        `;
    }

    // Slide: Outro
    slidesHTML += `
        <div class="wrapped-slide absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-sky-900 via-blue-900 to-slate-900 text-center transition-opacity duration-500 opacity-0 z-0" id="slide-${slideCount++}">
            <div class="text-6xl mb-4 animate-bounce">💖</div>
            <h2 class="text-3xl font-black text-white mb-3 drop-shadow-lg">ขอบคุณที่ทุ่มเท!</h2>
            <p class="text-base text-blue-200 font-bold">ทีมจะไปต่อไม่ได้เลย ถ้าไม่มีคุณ</p>
            <p class="text-sm text-blue-300 mt-4">เตรียมลุยต่อในเดือนหน้านะครับ 🚀</p>
            <button onclick="closeWrapped()" class="mt-8 px-6 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-full backdrop-blur-md border border-white/30 transition shadow-lg relative z-50">ปิดหน้าต่าง</button>
        </div>
    `;

    // 🌟 ให้อัปเดตจำนวนสไลด์ทั้งหมดให้ตรงกับที่สร้างจริงๆ
    wrappedTotalSlides = slideCount; 

    // หลอด Progress Bar ด้านบน
    let barsHtml = '';
    for (let i = 0; i < wrappedTotalSlides; i++) {
        barsHtml += `<div class="flex-1 h-1 bg-white/30 rounded-full overflow-hidden relative">
                        <div id="wrap-bar-${i}" class="absolute left-0 top-0 bottom-0 bg-white w-0 transition-all duration-100 ease-linear"></div>
                     </div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'wrapped-overlay';
    overlay.className = 'fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 text-white select-none font-sans transition-opacity duration-300 opacity-0';
    overlay.onclick = closeWrapped;
    
    overlay.innerHTML = `
        <div class="relative w-full max-w-[360px] h-[600px] sm:h-[650px] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)] border border-slate-700/50" onclick="event.stopPropagation()">
            <div class="absolute top-4 left-5 right-5 flex items-center gap-3 z-50">
                <div class="flex flex-1 gap-1.5">${barsHtml}</div>
                <button onclick="closeWrapped()" class="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors shrink-0 backdrop-blur-sm"><span class="material-icons text-[14px]">close</span></button>
            </div>
            
            <div class="absolute inset-0 z-40 flex mt-12">
                <div class="w-1/3 h-full cursor-pointer" onclick="prevWrappedSlide()"></div>
                <div class="w-2/3 h-full cursor-pointer" onclick="nextWrappedSlide()"></div>
            </div>
            
            ${slidesHTML}
        </div>
    `;

    document.body.appendChild(overlay);
    
    setTimeout(() => { overlay.classList.remove('opacity-0'); }, 10);

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
        setTimeout(() => overlay.remove(), 300);
    }
};