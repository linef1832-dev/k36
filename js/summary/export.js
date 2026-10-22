window.loadDutyAssignmentMap = async function(filteredData, shiftFilterUi) {
  const map = {};
  if (typeof appDB === 'undefined') return map;
  try {
    const dates = [ ...new Set((filteredData || []).map((r => r.date)).filter(Boolean)) ];
    if (dates.length === 0) {
      const dEl = document.getElementById('summaryDateFilter');
      if (dEl && dEl.value) dates.push(dEl.value);
    }
    if (dates.length === 0) return map;
    const deptsToTry = [ 'AM', 'OD', 'AMQL', 'ODQL' ];
    const myDept = typeof currentUser !== 'undefined' && currentUser ? currentUser.department || currentUser.dept : '';
    if (myDept && !deptsToTry.includes(myDept)) deptsToTry.unshift(myDept);
    const shiftsToTry = shiftFilterUi && shiftFilterUi !== 'ALL' ? [ shiftFilterUi ] : [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
    const keys = [];
    dates.forEach((date => {
      deptsToTry.forEach((dept => {
        shiftsToTry.forEach((shift => {
          keys.push(`duty_roster_${dept}_${date}_${shift}`);
        }));
      }));
    }));
    if (keys.length === 0) return map;
    const {data: data, error: error} = await appDB.from('settings').select('key, value').in('key', keys);
    if (error || !data) return map;
    data.forEach((row => {
      if (!row.value) return;
      try {
        const rosterData = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        Object.keys(rosterData).forEach((primaryTeam => {
          const arr = rosterData[primaryTeam];
          if (!Array.isArray(arr)) return;
          arr.forEach((u => {
            if (!u || !u.username) return;
            if (String(u.username).includes('ขาดคน')) return;
            const key = String(u.username).toLowerCase().trim();
            if (!map[key]) {
              map[key] = {
                main: primaryTeam,
                secondary: u.secondary_team || null
              };
            }
          }));
        }));
      } catch (e) {
        console.warn('parse roster failed:', row.key, e);
      }
    }));
  } catch (e) {
    console.error('loadDutyAssignmentMap error:', e);
  }
  return map;
};

window.exportSummaryToExcel = async function() {
  if (!pendingSummaryData || pendingSummaryData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลสำหรับดาวน์โหลด กรุณาอัปโหลดไฟล์ให้เรียบร้อย', 'warning');
  window.loadExcelLibrary((async function() {
    Swal.fire({
      title: 'กำลังสร้างไฟล์ Excel...',
      text: 'จัดระเบียบตามรูปแบบใหม่...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      const shiftFilter = document.getElementById('summaryShiftFilter') ? document.getElementById('summaryShiftFilter').value : 'ALL';
      const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
      let filteredData = pendingSummaryData;
      if (shiftFilter !== 'ALL') filteredData = filteredData.filter((item => smShiftMatch(item, shiftFilter)));
      if (odFilter !== 'ALL') filteredData = filteredData.filter((item => item.odType === odFilter || item.odType === undefined && odFilter === 'ปกติ'));
      if (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') filteredData = filteredData.filter((item => item.website === summaryActiveWebFilter));
      const targetWebOrder = [ 'Jun88', 'MK8', 'VV72', 'TH26', 'F168', 'PG688', 'JL69', 'NM9', 'BT678', 'K188' ];
      smWebList().concat(filteredData.map((x => x.website))).forEach((w => {
        if (w && !targetWebOrder.some((t => t.toLowerCase() === String(w).toLowerCase()))) targetWebOrder.push(w);
      }));
      const B0 = 3;
      const E = B0 + targetWebOrder.length * 3;
      const dutyAssignmentMap = await window.loadDutyAssignmentMap(filteredData, shiftFilter);
      let empGroups = {};
      filteredData.forEach((item => {
        if (!empGroups[item.empName]) {
          empGroups[item.empName] = {
            name: item.empName,
            shift: !item.shift || item.shift === 'UNKNOWN' ? 'UNKNOWN' : String(item.shift).replace('กะ', ''),
            odType: item.odType || 'ปกติ',
            totalApproved: 0,
            totalReject: 0,
            grandTotal: 0,
            websData: {}
          };
          targetWebOrder.forEach((w => {
            empGroups[item.empName].websData[w] = {
              approved: 0,
              reject: 0,
              total: 0
            };
          }));
        }
        empGroups[item.empName].totalApproved += item.approvedCount || 0;
        empGroups[item.empName].totalReject += item.rejectCount || 0;
        empGroups[item.empName].grandTotal += item.count || 0;
        const webKey = targetWebOrder.find((w => w.toLowerCase() === item.website.toLowerCase()));
        if (webKey) {
          empGroups[item.empName].websData[webKey].approved += item.approvedCount || 0;
          empGroups[item.empName].websData[webKey].reject += item.rejectCount || 0;
          empGroups[item.empName].websData[webKey].total += item.count || 0;
        }
      }));
      const wb = new ExcelJS.Workbook;
      const ws2 = wb.addWorksheet('ตารางอ้างอิง');
      const ws = wb.addWorksheet(`สรุปยอดแยกเว็บ`);
      wb.views = [ {
        activeTab: 0,
        firstSheet: 0
      } ];
      let headers = [ 'ลำดับ', 'ชื่อพนักงาน', 'กะ' ];
      targetWebOrder.forEach((w => {
        headers.push(`${w} (สำเร็จ)`);
        headers.push(`${w} (ปฏิเสธ)`);
        headers.push(`${w} (รวม)`);
      }));
      headers.push('รวมสำเร็จ');
      headers.push('รวมปฏิเสธ');
      headers.push('รวมทั้งสิ้น');
      const LASTCOL = headers.length;
      let titleDateStr = '';
      if (viewMode === 'preview' && window.uploadedFileDates && window.uploadedFileDates.size > 0) {
        const datesArr = Array.from(window.uploadedFileDates).sort();
        if (datesArr.length === 1) {
          const [y, m, d] = datesArr[0].split('-');
          titleDateStr = `วันที่ ${d} เดือน ${m} ${y}`;
        } else {
          const formattedDates = datesArr.map((d => {
            const [yy, mm, dd] = d.split('-');
            return `${dd}/${mm}/${yy}`;
          }));
          titleDateStr = `ข้อมูลรวมหลายวัน: ${formattedDates.join(', ')}`;
        }
      } else {
        const dateVal = document.getElementById('summaryDateFilter').value;
        if (dateVal) {
          const [y, m, d] = dateVal.split('-');
          titleDateStr = `วันที่ ${d} เดือน ${m} ${y}`;
        } else {
          titleDateStr = 'ข้อมูลพรีวิว (ยังไม่ได้บันทึก)';
        }
      }
      const thin = c => ({
        style: 'thin',
        color: {
          argb: c
        }
      });
      const solid = c => ({
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: c
        }
      });
      const shiftCellStyle = cell => {
        cell.font = {
          bold: true
        };
        if (cell.value === 'เช้า') {
          cell.fill = solid('FFFFEDD5');
          cell.font.color = {
            argb: 'FFEA580C'
          };
        } else if (cell.value === 'กลาง') {
          cell.fill = solid('FFEFF6FF');
          cell.font.color = {
            argb: 'FF2563EB'
          };
        } else if (cell.value === 'ดึก') {
          cell.fill = solid('FFF3E8FF');
          cell.font.color = {
            argb: 'FF9333EA'
          };
        } else if (cell.value === 'อิสระ' || cell.value === 'all') {
          cell.fill = solid('FFECFDF5');
          cell.font.color = {
            argb: 'FF059669'
          };
          cell.value = 'อิสระ';
        }
      };
      const titleRow = ws.addRow([ titleDateStr ]);
      ws.mergeCells(1, 1, 1, LASTCOL);
      titleRow.height = 30;
      titleRow.getCell(1).font = {
        size: 16,
        bold: true,
        color: {
          argb: 'FF000000'
        }
      };
      titleRow.getCell(1).fill = solid('FFFFFF00');
      titleRow.getCell(1).alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
      titleRow.getCell(1).border = {
        top: {
          style: 'medium'
        },
        left: {
          style: 'medium'
        },
        bottom: {
          style: 'medium'
        },
        right: {
          style: 'medium'
        }
      };
      const headerRow = ws.addRow(headers);
      headerRow.height = 25;
      const headerColors = [ 'FFDBEAFE', 'FFDCFCE7', 'FFFEE2E2', 'FFFEF3C7', 'FFF3E8FF', 'FFFFEDD5', 'FFCCFBF1', 'FFE0E7FF', 'FFFCE7F3', 'FFE2E8F0' ];
      const dataBgColors = [ 'FFF0F9FF', 'FFF0FDF4', 'FFFEF2F2', 'FFFFFBEB', 'FFFAF5FF', 'FFFFF7ED', 'FFF0FDFA', 'FFEEF2FF', 'FFFDF2F8', 'FFF8FAFC' ];
      headerRow.eachCell(((cell, colNumber) => {
        cell.font = {
          bold: true
        };
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };
        if (colNumber <= B0) {
          cell.fill = solid('FF1F2937');
          cell.font.color = {
            argb: 'FFFFFFFF'
          };
          cell.border = {
            top: {
              style: 'medium'
            },
            left: {
              style: 'medium'
            },
            bottom: {
              style: 'medium'
            },
            right: thin('FF94A3B8')
          };
        } else if (colNumber <= E) {
          const webIndex = Math.floor((colNumber - B0 - 1) / 3);
          const isLastInGroup = (colNumber - B0 - 1) % 3 === 2;
          const isFirstInGroup = (colNumber - B0 - 1) % 3 === 0;
          cell.fill = solid(headerColors[webIndex % headerColors.length]);
          cell.font.color = {
            argb: 'FF0F172A'
          };
          cell.border = {
            top: {
              style: 'medium'
            },
            bottom: {
              style: 'medium'
            },
            right: {
              style: isLastInGroup ? 'medium' : 'thin',
              color: {
                argb: 'FF94A3B8'
              }
            },
            left: {
              style: isFirstInGroup ? 'medium' : 'thin',
              color: {
                argb: 'FF94A3B8'
              }
            }
          };
        } else {
          cell.fill = solid('FFDC2626');
          cell.font.color = {
            argb: 'FFFFFFFF'
          };
          cell.border = {
            top: {
              style: 'medium'
            },
            left: {
              style: 'medium'
            },
            bottom: {
              style: 'medium'
            },
            right: {
              style: 'medium'
            }
          };
        }
      }));
      ws.views = [ {
        state: 'frozen',
        xSplit: B0,
        ySplit: 2,
        zoomScale: 80,
        zoomScaleNormal: 80,
        showGridLines: false
      } ];
      const SHIFT_ORDER = [ 'เช้า', 'กลาง', 'ดึก', 'อิสระ', 'all', 'UNKNOWN' ];
      const shiftRank = sh => {
        const i = SHIFT_ORDER.indexOf(String(sh || 'UNKNOWN'));
        return i === -1 ? 99 : i;
      };
      const _uList = typeof GLOBAL_USER_LIST !== 'undefined' && Array.isArray(GLOBAL_USER_LIST) ? GLOBAL_USER_LIST : [];
      const _uDept = {};
      _uList.forEach((u => {
        if (u && u.username) _uDept[String(u.username).toLowerCase().trim()] = String(u.department || 'AM').toUpperCase().trim();
      }));
      Object.values(empGroups).forEach((e => {
        e.dept = _uDept[String(e.name).toLowerCase().trim()] || 'ไม่ระบุแผนก';
      }));
      const deptRank = d => {
        const pre = d.startsWith('AM') ? 0 : d.startsWith('OD') ? 1 : 2;
        const base = d === 'AM' || d === 'OD' ? 0 : 1;
        return [ pre, base, d ];
      };
      const deptCmp = (a, b) => {
        const x = deptRank(a), y = deptRank(b);
        return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]);
      };
      const sortedEmps = Object.values(empGroups).sort(((a, b) => shiftRank(a.shift) - shiftRank(b.shift) || deptCmp(a.dept, b.dept) || b.totalApproved - a.totalApproved));
      const groupKey = e => `${e.shift}|${e.dept}`;
      const groupCount = {};
      sortedEmps.forEach((e => {
        groupCount[groupKey(e)] = (groupCount[groupKey(e)] || 0) + 1;
      }));
      const shiftLabel = sh => sh === 'UNKNOWN' ? 'ไม่ระบุกะ' : sh === 'all' || sh === 'อิสระ' ? 'กะอิสระ' : 'กะ' + sh;
      const seqInShift = (() => {
        const c = {};
        return k => c[k] = (c[k] || 0) + 1;
      })();
      const addShiftDivider = (sheet, lastCol, emp) => {
        const row = sheet.addRow([]);
        row.height = 15;
        for (let c = 1; c <= lastCol; c++) row.getCell(c).fill = solid('FF000000');
        const k = groupKey(emp);
        const cell = row.getCell(2);
        cell.value = `${shiftLabel(emp.shift)} · ${emp.dept} · ${groupCount[k]} คน`;
        cell.font = {
          size: 9,
          bold: true,
          color: {
            argb: 'FFFDE047'
          }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left'
        };
      };
      let prevShiftMain = null;
      sortedEmps.forEach((emp => {
        if (prevShiftMain !== groupKey(emp)) addShiftDivider(ws, LASTCOL, emp);
        prevShiftMain = groupKey(emp);
        let displayName = emp.name;
        const dutyInfo = dutyAssignmentMap[emp.name.toLowerCase()];
        if (dutyInfo) {
          const parts = [];
          if (dutyInfo.main) parts.push(`หลัก ${dutyInfo.main}`);
          if (dutyInfo.secondary) parts.push(`รอง ${dutyInfo.secondary}`);
          if (parts.length > 0) displayName = `${emp.name} (${parts.join(') (')})`;
        }
        let rowData = [ seqInShift(groupKey(emp)), displayName, emp.shift ];
        targetWebOrder.forEach((w => {
          rowData.push(emp.websData[w].approved);
          rowData.push(emp.websData[w].reject);
          rowData.push(emp.websData[w].total);
        }));
        rowData.push(emp.totalApproved);
        rowData.push(emp.totalReject);
        rowData.push(emp.grandTotal);
        const empRow = ws.addRow(rowData);
        empRow.eachCell(((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };
          if (colNumber <= B0) {
            cell.border = {
              top: thin('FFCBD5E1'),
              bottom: thin('FFCBD5E1'),
              left: thin('FFCBD5E1'),
              right: thin('FFCBD5E1')
            };
            if (colNumber === 2) {
              cell.font = {
                bold: true
              };
              cell.alignment = {
                vertical: 'middle',
                horizontal: 'left'
              };
            }
            if (colNumber === 3) shiftCellStyle(cell);
          } else if (colNumber <= E) {
            const webIndex = Math.floor((colNumber - B0 - 1) / 3);
            const colIdxInGroup = (colNumber - B0 - 1) % 3;
            cell.fill = solid(dataBgColors[webIndex % dataBgColors.length]);
            cell.border = {
              top: thin('FFCBD5E1'),
              bottom: thin('FFCBD5E1'),
              right: {
                style: colIdxInGroup === 2 ? 'medium' : 'thin',
                color: {
                  argb: 'FF94A3B8'
                }
              },
              left: {
                style: colIdxInGroup === 0 ? 'medium' : 'thin',
                color: {
                  argb: 'FF94A3B8'
                }
              }
            };
            if (cell.value > 0) {
              if (colIdxInGroup === 0) cell.font = {
                color: {
                  argb: 'FF16A34A'
                },
                bold: true
              };
              if (colIdxInGroup === 1) cell.font = {
                color: {
                  argb: 'FFDC2626'
                },
                bold: true
              };
              if (colIdxInGroup === 2) cell.font = {
                color: {
                  argb: 'FF2563EB'
                },
                bold: true
              };
            } else {
              cell.font = {
                color: {
                  argb: 'FF94A3B8'
                }
              };
            }
          } else {
            cell.border = {
              top: thin('FFCBD5E1'),
              bottom: thin('FFCBD5E1'),
              left: thin('FFCBD5E1'),
              right: thin('FFCBD5E1')
            };
            if (colNumber === E + 3) cell.fill = solid('FFFDE047');
            if (cell.value > 0) {
              if (colNumber === E + 1) cell.font = {
                color: {
                  argb: 'FF16A34A'
                },
                bold: true
              };
              if (colNumber === E + 2) cell.font = {
                color: {
                  argb: 'FFDC2626'
                },
                bold: true
              };
              if (colNumber === E + 3) cell.font = {
                color: {
                  argb: 'FF000000'
                },
                bold: true
              };
            }
          }
        }));
      }));
      const refTitle = ws2.addRow([ 'ตารางอ้างอิง — ชื่อพนักงาน / กะ / ยอดรวมแต่ละเว็บ   ·   ' + titleDateStr ]);
      const REF_TOT = 4 + targetWebOrder.length;
      ws2.mergeCells(refTitle.number, 1, refTitle.number, REF_TOT);
      refTitle.height = 24;
      refTitle.getCell(1).font = {
        size: 13,
        bold: true,
        color: {
          argb: 'FFFFFFFF'
        }
      };
      refTitle.getCell(1).fill = solid('FF1F2937');
      refTitle.getCell(1).alignment = {
        horizontal: 'left',
        vertical: 'middle',
        indent: 1
      };
      const refHead = ws2.addRow([ 'ลำดับ', 'ชื่อพนักงาน (อ้างอิง)', 'กะ (อ้างอิง)' ].concat(targetWebOrder.map((w => `${w} (สรุปยอด)`)), [ 'รวม (สรุปยอด)' ]));
      refHead.height = 25;
      refHead.eachCell(((cell, colNumber) => {
        cell.font = {
          bold: true
        };
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };
        if (colNumber <= 3) {
          cell.fill = solid('FF1F2937');
          cell.font.color = {
            argb: 'FFFFFFFF'
          };
        } else if (colNumber === REF_TOT) {
          cell.fill = solid('FFDC2626');
          cell.font.color = {
            argb: 'FFFFFFFF'
          };
        } else {
          cell.fill = solid(headerColors[(colNumber - 4) % headerColors.length]);
          cell.font.color = {
            argb: 'FF0F172A'
          };
        }
        cell.border = {
          top: {
            style: 'medium'
          },
          bottom: {
            style: 'medium'
          },
          left: thin('FF94A3B8'),
          right: thin('FF94A3B8')
        };
      }));
      const refColTot = new Array(targetWebOrder.length).fill(0);
      const refSeq = (() => {
        const c = {};
        return k => c[k] = (c[k] || 0) + 1;
      })();
      let prevShiftRef = null;
      sortedEmps.forEach(((emp, i) => {
        if (prevShiftRef !== groupKey(emp)) addShiftDivider(ws2, REF_TOT, emp);
        prevShiftRef = groupKey(emp);
        const webVals = targetWebOrder.map((w => emp.websData[w].total));
        webVals.forEach(((v, j) => {
          refColTot[j] += v;
        }));
        const r = ws2.addRow([ refSeq(groupKey(emp)), emp.name, emp.shift ].concat(webVals, [ webVals.reduce(((a, b) => a + b), 0) ]));
        r.eachCell(((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 2 ? 'left' : 'center'
          };
          cell.border = {
            top: thin('FFCBD5E1'),
            bottom: thin('FFCBD5E1'),
            left: thin('FFCBD5E1'),
            right: thin('FFCBD5E1')
          };
          if (colNumber === 2) cell.font = {
            bold: true
          }; else if (colNumber === 3) shiftCellStyle(cell); else if (colNumber === REF_TOT) {
            cell.fill = solid('FFFDE047');
            cell.font = {
              bold: true,
              color: {
                argb: 'FF000000'
              }
            };
          } else if (colNumber > 3) {
            cell.fill = solid(dataBgColors[(colNumber - 4) % dataBgColors.length]);
            cell.font = cell.value > 0 ? {
              color: {
                argb: 'FF2563EB'
              },
              bold: true
            } : {
              color: {
                argb: 'FF94A3B8'
              }
            };
          }
        }));
      }));
      {
        const grand = refColTot.reduce(((a, b) => a + b), 0);
        const tr = ws2.addRow([ '', 'รวมทุกคน', '' ].concat(refColTot, [ grand ]));
        tr.height = 22;
        tr.eachCell({
          includeEmpty: true
        }, ((cell, colNumber) => {
          if (colNumber > REF_TOT) return;
          cell.font = {
            bold: true,
            color: {
              argb: 'FFFFFFFF'
            }
          };
          cell.fill = solid('FF1F2937');
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 2 ? 'left' : 'center'
          };
          cell.border = {
            top: {
              style: 'medium'
            },
            bottom: {
              style: 'medium'
            },
            left: thin('FF475569'),
            right: thin('FF475569')
          };
          if (colNumber === REF_TOT) {
            cell.fill = solid('FFDC2626');
          }
        }));
      }
      ws2.views = [ {
        state: 'frozen',
        xSplit: 3,
        ySplit: 2,
        zoomScale: 80,
        zoomScaleNormal: 80,
        showGridLines: false
      } ];
      for (let c = 1; c <= REF_TOT; c++) ws2.getColumn(c).width = c === 1 ? 8 : c === 2 ? 30 : c === 3 ? 11 : c === REF_TOT ? 14 : 12;
      for (let c = 1; c <= LASTCOL; c++) {
        const col = ws.getColumn(c);
        if (c === 1) col.width = 8; else if (c === 2) col.width = 30; else if (c === 3) col.width = 11; else if (c > E) col.width = 14; else col.width = 11;
      }
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([ buffer ], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `สรุปยอดรวมแต่ละเว็บ_${titleDateStr.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout((() => URL.revokeObjectURL(url)), 2e3);
      Swal.fire({
        icon: 'success',
        title: 'ดาวน์โหลดไฟล์ Excel สำเร็จ!',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire('เกิดข้อผิดพลาด', 'ดาวน์โหลด Excel ไม่สำเร็จ: ' + error.message, 'error');
    }
  }));
};

window.openManageSystemModal = async function() {
  if (!window.smWebSystems && typeof window.smLoadWebSystems === 'function') await window.smLoadWebSystems();
  const cs = Object.assign({}, smCustomSystems());
  const esc = v => String(v).replace(/[&<>"']/g, (c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c])));
  const SYS = [ [ 'K36', '#60a5fa' ], [ 'WG', '#34d399' ], [ 'TCG', '#f472b6' ], [ 'SYSTEM', '#94a3b8' ] ];
  const segs = (web, cur) => SYS.map((([k, c]) => `<button type="button" data-web="${esc(web)}" data-sys="${k}" class="mws-seg${cur === k ? ' on' : ''}" style="--c:${c}">${k === 'SYSTEM' ? 'ไม่ระบุ' : k}</button>`)).join('');
  const row = (web, isNew) => `<div class="mws-row" data-web="${esc(web)}"><b>${esc(web)}${isNew ? ' <small>ใหม่</small>' : ''}</b><div class="mws-segs">${segs(web, smSystemOf(web, cs))}</div></div>`;
  const base = typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length ? TEAM_LIST : SM_DEFAULT_WEBS;
  const html = `\n        <style>\n            .mws-list{display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow-y:auto;padding:2px;text-align:left}\n            .mws-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:12px;background:var(--k-panel2,#0f1829);border:1px solid var(--k-line,#1e293b)}\n            .mws-row b{font-size:14px;font-weight:900;color:var(--k-tx-strong,#fff)} .mws-row small{font-size:10px;padding:1px 6px;border-radius:99px;background:#E8C15A;color:#1b1406;margin-left:4px}\n            .mws-segs{display:flex;gap:3px;padding:3px;border-radius:10px;background:var(--k-sunk,#0b1222)}\n            .mws-seg{height:28px;padding:0 10px;border-radius:8px;font-size:12px;font-weight:800;color:var(--k-mute,#94a3b8)}\n            .mws-seg.on{background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--c);box-shadow:inset 0 0 0 1px var(--c)}\n            .mws-add{display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--k-line2,#334155)}\n            .mws-add input{flex:1;min-width:0;height:38px;padding:0 12px;border-radius:10px;background:var(--k-field,#0b1222);border:1px solid var(--k-line3,#334155);color:var(--k-tx-strong,#fff);font-weight:800;outline:none}\n            .mws-add select{height:38px;padding:0 8px;border-radius:10px;background:var(--k-field,#0b1222);border:1px solid var(--k-line3,#334155);color:var(--k-tx-strong,#fff);font-weight:800}\n            .mws-add button{height:38px;padding:0 14px;border-radius:10px;background:#E8C15A;color:#1b1406;font-weight:900}\n            .mws-tip{font-size:12px;color:var(--k-mute,#94a3b8);margin:0 0 10px;text-align:left;line-height:1.5}\n        </style>\n        <p class="mws-tip">ระบบจะอ่านไฟล์ Excel ตามที่ตั้งตรงนี้ (ดูจากชื่อเว็บในชื่อไฟล์) · มีเว็บใหม่ → เพิ่มด้านล่างแล้วเลือกหลังบ้าน</p>\n        <div class="mws-list" id="mwsList">${smWebList().map((w => row(w, !base.some((x => x.toLowerCase() === w.toLowerCase()))))).join('')}</div>\n        <div class="mws-add">\n            <input id="mwsNewWeb" placeholder="ชื่อเว็บใหม่ เช่น AB99" maxlength="20">\n            <select id="mwsNewSys"><option value="K36">K36</option><option value="WG">WG</option><option value="TCG">TCG</option></select>\n            <button type="button" id="mwsAddBtn">+ เพิ่ม</button>\n        </div>`;
  const {isConfirmed: isConfirmed} = await Swal.fire({
    title: 'ตั้งค่าหลังบ้านให้เว็บไซต์',
    html: html,
    width: 560,
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ปิด',
    confirmButtonColor: '#E8C15A',
    cancelButtonColor: '#64748b',
    customClass: {
      popup: 'rounded-3xl'
    },
    didOpen: pop => {
      const list = pop.querySelector('#mwsList');
      list.addEventListener('click', (e => {
        const b = e.target.closest('.mws-seg');
        if (!b) return;
        cs[b.dataset.web] = b.dataset.sys;
        list.querySelectorAll(`.mws-seg[data-web="${CSS.escape(b.dataset.web)}"]`).forEach((x => x.classList.toggle('on', x === b)));
      }));
      const add = () => {
        const inp = pop.querySelector('#mwsNewWeb');
        const name = inp.value.trim().replace(/\s+/g, '');
        if (!name) return inp.focus();
        if (!/^[A-Za-z0-9ก-๙]{2,20}$/.test(name)) {
          Swal.showValidationMessage('ชื่อเว็บใช้ได้เฉพาะตัวอักษร/ตัวเลข 2–20 ตัว');
          return;
        }
        if (smWebList().concat(Object.keys(cs)).some((w => w.toLowerCase() === name.toLowerCase()))) {
          Swal.showValidationMessage(`มีเว็บ ${name} อยู่แล้ว`);
          return;
        }
        Swal.resetValidationMessage();
        cs[name] = pop.querySelector('#mwsNewSys').value;
        list.insertAdjacentHTML('beforeend', row(name, true));
        list.lastElementChild.scrollIntoView({
          block: 'nearest'
        });
        inp.value = '';
      };
      pop.querySelector('#mwsAddBtn').addEventListener('click', add);
      pop.querySelector('#mwsNewWeb').addEventListener('keydown', (e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      }));
    }
  });
  if (!isConfirmed) return;
  try {
    const {error: error} = await appDB.from('settings').upsert([ {
      key: 'summary_web_systems',
      value: JSON.stringify(cs)
    } ]);
    if (error) throw error;
    window.smWebSystems = cs;
    try {
      window.safeSetItem('custom_web_systems', JSON.stringify(cs));
    } catch (e) {}
    if (window.clearQueryCache) window.clearQueryCache('sum_websys');
    if (typeof pendingSummaryData !== 'undefined') pendingSummaryData.forEach((item => {
      const v = smSystemOf(item.website, cs);
      if (v !== 'SYSTEM') item.system = v;
    }));
    const lbw = document.getElementById('leaderboardWebFilter');
    if (lbw) {
      const cur = lbw.value;
      lbw.innerHTML = '<option value="ALL">ทุกเว็บ</option>' + smWebList().map((w => `<option value="${esc(w)}">${esc(w)}</option>`)).join('');
      lbw.value = cur;
    }
    Swal.fire({
      icon: 'success',
      title: 'บันทึกแล้ว',
      text: 'อัปโหลดไฟล์ครั้งต่อไป ระบบจะอ่านตามหลังบ้านที่ตั้งไว้',
      timer: 1800,
      showConfirmButton: false
    });
    if (typeof window.renderSummaryDashboard === 'function') window.renderSummaryDashboard();
  } catch (e) {
    Swal.fire('บันทึกไม่สำเร็จ', e.message || String(e), 'error');
  }
};

window.openManageLogoModal = function(webName) {
  const webs = smWebList();
  const logos = window.summaryWebLogos || {};
  const esc = v => String(v).replace(/[&<>"']/g, (c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c])));
  const picker = document.getElementById('webLogoPicker');
  if (picker) picker.innerHTML = webs.map((w => `<button type="button" class="lg-w" data-web="${esc(w)}" onclick="smPickLogoWeb('${esc(w)}')">\n            <span class="lg-img">${logos[w] ? `<img src="${esc(logos[w])}" alt="">` : `<i>${esc(String(w).slice(0, 3))}</i>`}</span>${esc(w)}</button>`)).join('');
  const first = webName || (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL' ? summaryActiveWebFilter : webs[0]);
  window.smPickLogoWeb(first);
  document.getElementById('webLogoModal').classList.remove('hidden');
};

window.smPickLogoWeb = function(web) {
  document.getElementById('webLogoKey').value = web;
  document.getElementById('webLogoTargetName').innerText = web;
  document.getElementById('webLogoUrlInput').value = '';
  document.getElementById('webLogoFileInput').value = '';
  document.querySelectorAll('#webLogoPicker .lg-w').forEach((b => b.classList.toggle('on', b.dataset.web === web)));
  const currentLogo = window.summaryWebLogos && window.summaryWebLogos[web];
  const previewBox = document.getElementById('currentWebLogoPreviewBox');
  const previewImg = document.getElementById('currentWebLogoPreview');
  if (currentLogo) {
    previewImg.src = currentLogo;
    previewBox.classList.remove('hidden');
  } else {
    previewBox.classList.add('hidden');
  }
};

window.fetchMultipleHistoricalSummary = async function() {
  const dates = Array.from(window.selectedSummaryDates);
  if (dates.length === 0) return Swal.fire('เตือน', 'กรุณาเลือกวันที่อย่างน้อย 1 วัน', 'warning');
  Swal.fire({
    title: 'กำลังรวมข้อมูล...',
    text: `ดึงข้อมูล ${dates.length} วันมาบวกทบกัน`,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    if (typeof window.refreshUserListForSummary === 'function') {
      await window.refreshUserListForSummary();
    } else if (typeof fetchUsers === 'function') {
      try {
        await fetchUsers(true);
      } catch (e) {
        console.warn('fetchUsers refresh failed', e);
      }
    }
    const yesterdayDates = dates.map((d => window.getYesterdayDateStr(d)));
    const [mainRes, schRes, yestRes] = await Promise.all([ window.selectAllRows((() => appDB.from('transaction_daily_summary').select('date, employee_name, website, count, approved_count, reject_count, total_amount').in('date', dates).order('id', {
      ascending: true
    }))), window.selectAllRows((() => appDB.from('schedules').select('work_date, staff_name, shift_name').in('work_date', dates).order('id', {
      ascending: true
    }))), window.selectAllRows((() => appDB.from('transaction_daily_summary').select('date, employee_name, website, count').in('date', yesterdayDates).order('id', {
      ascending: true
    }))) ]);
    if (mainRes.error) throw mainRes.error;
    const data = mainRes.data || [];
    const schData = schRes.data || [];
    const yestData = yestRes.data || [];
    let schMap = {};
    schData.forEach((s => schMap[`${s.work_date}_${(s.staff_name || '').toLowerCase().trim()}`] = s.shift_name));
    let yestMap = {};
    yestData.forEach((r => {
      const key = window.cleanKeyStr(r.employee_name, r.website);
      if (!yestMap[key]) yestMap[key] = 0;
      yestMap[key] += parseInt(r.count) || 0;
    }));
    let groupedData = {};
    const sortedDatesForTitle = dates.sort(((a, b) => new Date(b) - new Date(a))).map((d => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    })).join(', ');
    const combinedDateLabel = `ข้อมูลรวมหลายวัน: ${sortedDatesForTitle}`;
    if (data && data.length > 0) {
      data.forEach((r => {
        const key = window.cleanKeyStr(r.employee_name, r.website);
        let empKey = (r.employee_name || '').toLowerCase().trim();
        const realUser = typeof getRealDbUser === 'function' ? getRealDbUser(r.employee_name) : null;
        let actualShift;
        if (realUser && realUser.allowed_shift) {
          const rawShift = String(realUser.allowed_shift).trim().toLowerCase();
          if (rawShift && rawShift !== 'all' && rawShift !== 'กะอิสระ' && rawShift !== 'อิสระ') {
            actualShift = realUser.allowed_shift;
          } else {
            actualShift = schMap[`${r.date}_${empKey}`] || realUser.allowed_shift;
          }
        } else {
          actualShift = schMap[`${r.date}_${empKey}`] || (typeof getShiftFromName === 'function' ? getShiftFromName(r.employee_name) : 'UNKNOWN');
        }
        actualShift = window.normalizeShiftName(actualShift);
        if (!groupedData[key]) {
          groupedData[key] = {
            date: combinedDateLabel,
            empName: r.employee_name,
            website: r.website,
            system: r.system || 'UNKNOWN',
            count: 0,
            totalAmount: 0,
            approvedCount: 0,
            rejectCount: 0,
            shift: actualShift,
            yestCount: yestMap[key] || 0
          };
        }
        groupedData[key].count += parseInt(r.count) || 0;
        groupedData[key].totalAmount += parseFloat(r.total_amount) || 0;
        groupedData[key].approvedCount += r.approved_count !== null ? parseInt(r.approved_count) : parseInt(r.count) || 0;
        groupedData[key].rejectCount += parseInt(r.reject_count) || 0;
      }));
    }
    pendingSummaryData = Object.values(groupedData);
    viewMode = 'monthly_history';
    window.uploadedFileDates.clear();
    renderSummaryDashboard();
    fetchLeaderboardData();
    Swal.close();
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.deleteSummaryDate = function(dateStr) {
  const [y, m, day] = dateStr.split('-');
  const displayDate = `${day}/${m}/${y}`;
  Swal.fire({
    title: `ลบข้อมูลวันที่ ${displayDate}?`,
    text: "ข้อมูลสรุปยอดของวันนี้จะถูกลบทิ้งอย่างถาวร!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ลบทิ้งเลย',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  }).then((async result => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'กำลังลบ...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      try {
        const {error: delErr} = await appDB.from('transaction_daily_summary').delete().eq('date', dateStr);
        if (delErr) throw delErr;
        await appDB.from('settings').update({
          value: '[]'
        }).eq('key', 'saved_excel_files');
        if (window.clearQueryCache) window.clearQueryCache('sum_');
        if (window._sumCache) delete window._sumCache[`daily_${dateStr}`];
        window.selectedSummaryDates.delete(dateStr);
        window.pendingFileNames = [];
        window.uploadedFileDates.clear();
        if (typeof fetchAvailableDates === 'function') await fetchAvailableDates(true);
        if (pendingSummaryData.length === 0) {
          renderSummaryDashboard();
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          clearSummaryData();
          Swal.close();
        }
      } catch (e) {
        Swal.fire('Error', e.message, 'error');
      }
    }
  }));
};

window.toggleSummaryDate = function(dateStr) {
  if (window.selectedSummaryDates.has(dateStr)) window.selectedSummaryDates.delete(dateStr); else window.selectedSummaryDates.add(dateStr);
  window.renderDateSelector();
};

window.saveWebLogo = async function() {
  const web = document.getElementById('webLogoKey').value;
  const urlInput = document.getElementById('webLogoUrlInput').value.trim();
  const fileInput = document.getElementById('webLogoFileInput');
  if (!urlInput && (!fileInput.files || fileInput.files.length === 0)) {
    return Swal.fire('เตือน', 'กรุณาใส่ลิงก์ URL หรือ อัปโหลดรูปภาพ', 'warning');
  }
  Swal.fire({
    title: 'กำลังบันทึกโลโก้...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  let finalUrl = urlInput;
  try {
    if (fileInput.files && fileInput.files.length > 0) {
      let file = fileInput.files[0];
      if (typeof window.compressImage === 'function') {
        const before = file.size;
        file = await window.compressImage(file, {
          maxWidth: 400,
          maxHeight: 400,
          quality: .9,
          skipUnderKB: 60
        });
        if (file.size < before) {
          Swal.update({
            html: `<div class="text-sm">ย่อรูปจาก ${(before / 1024).toFixed(0)} KB → <b class="text-emerald-400">${(file.size / 1024).toFixed(0)} KB</b><br>กำลังอัปโหลด...</div>`
          });
        }
      }
      const fileExt = file.name.split('.').pop() || 'webp';
      const fileName = `logo_${web}_${Date.now()}.${fileExt}`;
      const {error: uploadError} = await appDB.storage.from('staff_images').upload(`logos/${fileName}`, await window.compressImageFile(file, {
        maxDim: 900,
        quality: .85
      }), {
        cacheControl: '31536000',
        upsert: true
      });
      if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + uploadError.message);
      const {data: publicUrlData} = appDB.storage.from('staff_images').getPublicUrl(`logos/${fileName}`);
      finalUrl = publicUrlData.publicUrl;
    }
    window.summaryWebLogos = window.summaryWebLogos || {};
    window.summaryWebLogos[web] = finalUrl;
    if (typeof SETTINGS !== 'undefined') {
      SETTINGS['summary_web_logos'] = JSON.stringify(window.summaryWebLogos);
    }
    await appDB.from('settings').upsert([ {
      key: 'summary_web_logos',
      value: JSON.stringify(window.summaryWebLogos)
    } ]);
    if (window.clearQueryCache) window.clearQueryCache('sum_logos');
    document.getElementById('webLogoModal').classList.add('hidden');
    if (typeof window.renderSummaryDashboard === 'function') window.renderSummaryDashboard();
    Swal.fire({
      icon: 'success',
      title: 'บันทึกโลโก้สำเร็จ!',
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
};
