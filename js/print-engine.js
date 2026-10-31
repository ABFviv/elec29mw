/**
 * ================================================================
 *  29MW Plant EMS — Universal Print & Report Engine
 *  Generates formatted, publication-ready reports for plant management,
 *  audits, shifts, equipment dossiers, and engineer work history.
 * ================================================================
 */

const PrintEngine = (() => {

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getActiveUser() {
    const s = (typeof DB !== 'undefined' && DB.Session) ? DB.Session.get() : null;
    return s?.user?.name || 'Administrator';
  }

  function getLetterhead(reportTitle, filterDesc = '') {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const user = getActiveUser();

    return `
      <div class="print-header-banner">
        <div class="plant-title">
          <span>⚡ 29MW POWER PLANT — ELECTRICAL MAINTENANCE DEPT</span>
          <span style="font-size:11pt;color:#0284c7;">OFFICIAL REPORT</span>
        </div>
        <div class="plant-sub">
          <span>Document: <strong>${esc(reportTitle)}</strong> ${filterDesc ? '• ' + esc(filterDesc) : ''}</span>
          <span>Generated: ${dateStr} ${timeStr} • Prepared by: ${esc(user)}</span>
        </div>
      </div>
    `;
  }

  function getSignatureBlock() {
    return `
      <div class="print-signature-block">
        <div class="sig-col">
          <div class="sig-label">1. Executing Technician</div>
          <div class="sig-line">Signature & Date</div>
        </div>
        <div class="sig-col">
          <div class="sig-label">2. Electrical Supervisor (Hameed Tahsin)</div>
          <div class="sig-line">Verification & Approval</div>
        </div>
        <div class="sig-col">
          <div class="sig-label">3. Plant Operations Manager</div>
          <div class="sig-line">Official Stamp & Date</div>
        </div>
      </div>
    `;
  }

  /**
   * Generates and prints a complete report in a clean print-ready popup window
   */
  function printDocument(title, filterDesc, htmlContent) {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('Please allow popups to generate and print reports.');
      return;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${esc(title)} — 29MW Plant EMS</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 12mm 10mm 15mm 10mm; }
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: 'Outfit', -apple-system, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 20px 24px;
            font-size: 10pt;
            line-height: 1.35;
          }
          .print-header-banner {
            border-bottom: 2pt solid #0f172a;
            padding-bottom: 8pt;
            margin-bottom: 14pt;
          }
          .plant-title {
            font-size: 15pt;
            font-weight: 800;
            color: #0f172a;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .plant-sub {
            font-size: 8.5pt;
            color: #475569;
            margin-top: 3pt;
            display: flex;
            justify-content: space-between;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10pt 0;
            font-size: 8.5pt;
          }
          th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            border: 1pt solid #cbd5e1;
            padding: 6pt 8pt;
            text-align: left;
            text-transform: uppercase;
            font-size: 7.5pt;
            letter-spacing: 0.3pt;
          }
          td {
            border: 0.75pt solid #cbd5e1;
            padding: 5.5pt 8pt;
            vertical-align: top;
          }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          .badge {
            border: 0.75pt solid #64748b;
            padding: 1.5pt 5pt;
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
            border-radius: 3pt;
          }
          .badge-green { background: #dcfce7; color: #166534; border-color: #86efac; }
          .badge-yellow { background: #fef9c3; color: #854d0e; border-color: #fde047; }
          .badge-red { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
          .badge-blue { background: #e0f2fe; color: #075985; border-color: #7dd3fc; }
          .kpi-row {
            display: flex;
            gap: 12pt;
            margin-bottom: 14pt;
          }
          .kpi-box {
            flex: 1;
            border: 1pt solid #cbd5e1;
            background: #f8fafc;
            border-radius: 4pt;
            padding: 8pt 10pt;
          }
          .kpi-box-val { font-size: 16pt; font-weight: 800; color: #0f172a; }
          .kpi-box-lbl { font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .print-signature-block {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20pt;
            margin-top: 24pt;
            padding-top: 14pt;
            border-top: 1pt solid #cbd5e1;
            page-break-inside: avoid;
          }
          .sig-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #334155; }
          .sig-line {
            border-bottom: 1pt solid #0f172a;
            margin-top: 30pt;
            font-size: 7.5pt;
            color: #64748b;
            padding-top: 2pt;
          }
          @media print {
            .no-print-btn { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print-btn" style="position:fixed;top:10px;right:10px;z-index:9999;background:#0f172a;padding:8px 16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:8px 16px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;">🖨️ Print / Save as PDF</button>
          <button onclick="window.close()" style="background:#475569;color:#fff;border:none;padding:8px 14px;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;margin-left:6px;">Close</button>
        </div>

        ${getLetterhead(title, filterDesc)}
        ${htmlContent}
        ${getSignatureBlock()}

        <script>
          window.addEventListener('load', () => {
            setTimeout(() => { window.print(); }, 400);
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  }

  // ================================================
  //  REPORT BUILDERS (ALL MODULES)
  // ================================================

  /**
   * 1. EXECUTIVE PLANT MAINTENANCE SUMMARY
   */
  function printExecutiveSummary() {
    const today = DB.fmt.today();
    const cmStats = DB.Corrective.getStats();
    const pmStats = DB.Preventive.getStats();
    const spStats = DB.SpareParts.getStats();
    const trStats = DB.Training.getStats();
    const cmOpen = DB.Corrective.getAll().filter(r => r.status !== 'closed');
    const pmWatch = DB.Preventive.getAll();

    const html = `
      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-box-val">${cmStats.open}</div>
          <div class="kpi-box-lbl">Open CM Faults</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${cmStats.closed}</div>
          <div class="kpi-box-lbl">Resolved CM Jobs</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${pmWatch.length}</div>
          <div class="kpi-box-lbl">PM Equipment on Watch</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${spStats.lowStock}</div>
          <div class="kpi-box-lbl">Parts Low in Stock</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${trStats.total}</div>
          <div class="kpi-box-lbl">Training Sessions</div>
        </div>
      </div>

      <h3 style="font-size:11pt;margin:14pt 0 4pt;font-weight:700;">1. Active Corrective Maintenance (Work Orders)</h3>
      ${cmOpen.length ? `
        <table>
          <thead>
            <tr>
              <th style="width:12%;">WO Number</th>
              <th style="width:12%;">Date</th>
              <th style="width:20%;">Equipment</th>
              <th style="width:28%;">Problem Description</th>
              <th style="width:14%;">Technician</th>
              <th style="width:14%;">Priority / Status</th>
            </tr>
          </thead>
          <tbody>
            ${cmOpen.map(r => `
              <tr>
                <td><strong>${esc(r.workOrderNumber)}</strong></td>
                <td>${esc(r.date)}</td>
                <td><strong>${esc(r.equipment)}</strong></td>
                <td>${esc(r.problemDescription)}</td>
                <td>${esc(r.technician)}</td>
                <td><span class="badge ${r.priority === 'critical' ? 'badge-red' : 'badge-yellow'}">${esc(r.priority)}</span> · ${esc(r.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#64748b;font-style:italic;">All corrective work orders resolved. No active faults.</p>'}

      <h3 style="font-size:11pt;margin:14pt 0 4pt;font-weight:700;">2. Equipment on Watchlist (Preventive Maintenance)</h3>
      ${pmWatch.length ? `
        <table>
          <thead>
            <tr>
              <th style="width:20%;">Equipment</th>
              <th style="width:40%;">Observation / Monitoring Reason</th>
              <th style="width:18%;">Added Date</th>
              <th style="width:22%;">Logged By</th>
            </tr>
          </thead>
          <tbody>
            ${pmWatch.map(r => `
              <tr>
                <td><strong>${esc(r.equipment)}</strong></td>
                <td>${esc(r.notes || r.task || 'Near wear limits; monitor daily.')}</td>
                <td>${esc(r.scheduledDate || r.createdAt?.split('T')[0] || today)}</td>
                <td>${esc(r.assignedTo || 'Electrical Team')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#64748b;font-style:italic;">No equipment currently on PM watch.</p>'}
    `;

    printDocument('Executive Plant Maintenance Summary', `All Modules • As of ${today}`, html);
  }

  /**
   * 2. PRINT DAILY CHECKS REPORT (FILTERABLE BY MONTH/YEAR/ENGINEER)
   */
  function printDailyChecks(year, month, filterEmployee = '') {
    const y = year || new Date().getFullYear();
    const m = month || (new Date().getMonth() + 1);
    const sched = DB.MonthlySchedule.load(y, m);

    if (!sched || !sched.days) {
      alert(`No schedule found for ${y}-${String(m).padStart(2,'0')}.`);
      return;
    }

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const title = `Daily Checks Inspection Schedule & Log`;
    const filterDesc = `${monthNames[m]} ${y}${filterEmployee ? ' • Filtered by: ' + filterEmployee : ' • All Engineers'}`;

    let rowsHtml = '';
    let totalChecks = 0, doneChecks = 0;

    sched.days.forEach(d => {
      const slots = [
        { k: '1a', label: 'Morning (A)' },
        { k: '1b', label: 'Morning (B)' },
        { k: '2a', label: 'Afternoon (A)' },
        { k: '2b', label: 'Afternoon (B)' },
        { k: '3a', label: 'Night (A)' },
        { k: '3b', label: 'Night (B)' },
      ];

      slots.forEach(slot => {
        const taskId = d[`task${slot.k}`];
        const status = d[`status${slot.k}`] || 'pending';
        const doneBy = d[`doneBy${slot.k}`] || '';
        const doneAt = d[`doneAt${slot.k}`] || '';
        const notes = d[`notes${slot.k}`] || '';

        if (filterEmployee && doneBy.toLowerCase() !== filterEmployee.toLowerCase()) {
          return;
        }

        totalChecks++;
        if (status === 'done') doneChecks++;

        let taskName = taskId;
        if (typeof Scheduler !== 'undefined' && Scheduler.getTask) {
          const t = Scheduler.getTask(taskId);
          if (t) taskName = `${t.code}: ${t.name}`;
        }

        const badgeClass = status === 'done' ? 'badge-green' : (status === 'skipped' ? 'badge-yellow' : 'badge-blue');

        rowsHtml += `
          <tr>
            <td><strong>${esc(d.date)}</strong></td>
            <td>${esc(slot.label)}</td>
            <td><strong>${esc(taskName)}</strong></td>
            <td><span class="badge ${badgeClass}">${esc(status.toUpperCase())}</span></td>
            <td>${esc(doneBy || '—')}</td>
            <td>${doneAt ? esc(doneAt.split('T')[1]?.slice(0,5) || doneAt) : '—'}</td>
            <td>${esc(notes || '—')}</td>
          </tr>
        `;
      });
    });

    const completionPct = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0;

    const html = `
      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-box-val">${doneChecks} / ${totalChecks}</div>
          <div class="kpi-box-lbl">Checks Completed</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${completionPct}%</div>
          <div class="kpi-box-lbl">Completion Rate</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${monthNames[m]} ${y}</div>
          <div class="kpi-box-lbl">Reporting Period</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:10%;">Date</th>
            <th style="width:14%;">Shift Slot</th>
            <th style="width:34%;">Task Description</th>
            <th style="width:10%;">Status</th>
            <th style="width:14%;">Executed By</th>
            <th style="width:8%;">Time</th>
            <th style="width:10%;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="text-align:center;color:#64748b;">No matching checks found for this filter.</td></tr>'}
        </tbody>
      </table>
    `;

    printDocument(title, filterDesc, html);
  }

  /**
   * 3. PRINT CORRECTIVE MAINTENANCE REPORT (FILTERABLE BY DATE/TECH/STATUS)
   */
  function printCorrective(dateFrom = '', dateTo = '', filterTech = '', filterStatus = '') {
    let list = DB.Corrective.getAll();

    if (dateFrom) list = list.filter(r => (r.date || '') >= dateFrom);
    if (dateTo) list = list.filter(r => (r.date || '') <= dateTo);
    if (filterTech) list = list.filter(r => (r.technician && r.technician.toLowerCase() === filterTech.toLowerCase()) || (r.reportedBy && r.reportedBy.toLowerCase() === filterTech.toLowerCase()));
    if (filterStatus) list = list.filter(r => (r.status || '') === filterStatus);

    const desc = [
      dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : (dateFrom ? `From ${dateFrom}` : (dateTo ? `Up to ${dateTo}` : 'All Dates')),
      filterTech ? `Technician: ${filterTech}` : '',
      filterStatus ? `Status: ${filterStatus}` : ''
    ].filter(Boolean).join(' • ');

    const html = `
      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-box-val">${list.length}</div>
          <div class="kpi-box-lbl">Total Work Orders</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${list.filter(r => r.status === 'open').length}</div>
          <div class="kpi-box-lbl">Open</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${list.filter(r => r.status === 'in-progress').length}</div>
          <div class="kpi-box-lbl">In Progress</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${list.filter(r => r.status === 'closed').length}</div>
          <div class="kpi-box-lbl">Resolved / Closed</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:11%;">WO #</th>
            <th style="width:10%;">Date</th>
            <th style="width:17%;">Equipment</th>
            <th style="width:24%;">Fault Description</th>
            <th style="width:20%;">Action Taken</th>
            <th style="width:10%;">Technician</th>
            <th style="width:8%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r => `
            <tr>
              <td><strong>${esc(r.workOrderNumber)}</strong></td>
              <td>${esc(r.date)}</td>
              <td><strong>${esc(r.equipment)}</strong></td>
              <td>${esc(r.problemDescription)}</td>
              <td>${esc(r.actionTaken || '—')}</td>
              <td>${esc(r.technician)}</td>
              <td><span class="badge ${r.status === 'closed' ? 'badge-green' : (r.status === 'open' ? 'badge-red' : 'badge-yellow')}">${esc(r.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printDocument('Corrective Maintenance Work Orders Log', desc, html);
  }

  /**
   * 4. PRINT PREVENTIVE WATCHLIST REPORT
   */
  function printPreventive() {
    const list = DB.Preventive.getAll();
    const html = `
      <table>
        <thead>
          <tr>
            <th style="width:20%;">Equipment Name</th>
            <th style="width:40%;">Observation / Monitoring Reason</th>
            <th style="width:20%;">Date Added</th>
            <th style="width:20%;">Assigned Observer</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r => `
            <tr>
              <td><strong>${esc(r.equipment)}</strong></td>
              <td>${esc(r.notes || r.task || 'Watch wear condition')}</td>
              <td>${esc(r.scheduledDate || r.createdAt?.split('T')[0] || '—')}</td>
              <td>${esc(r.assignedTo || 'Electrical Team')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printDocument('Preventive Maintenance Watchlist', `Total: ${list.length} Monitored Units`, html);
  }

  /**
   * 5. PRINT SPARE PARTS INVENTORY & LOW STOCK REPORT
   */
  function printSpareParts(lowStockOnly = false) {
    let list = DB.SpareParts.getAll();
    if (lowStockOnly) list = list.filter(p => Number(p.quantity) <= Number(p.minStock));

    const html = `
      <table>
        <thead>
          <tr>
            <th style="width:25%;">Part Name / Spec</th>
            <th style="width:15%;">Part Code</th>
            <th style="width:15%;">Storage Location</th>
            <th style="width:15%;">Current Qty</th>
            <th style="width:15%;">Min Threshold</th>
            <th style="width:15%;">Stock Status</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(p => {
            const isLow = Number(p.quantity) <= Number(p.minStock);
            return `
              <tr>
                <td><strong>${esc(p.partName)}</strong></td>
                <td>${esc(p.partNumber || p.id)}</td>
                <td>${esc(p.location || 'Warehouse')}</td>
                <td><strong>${esc(p.quantity)}</strong> ${esc(p.unit || 'pcs')}</td>
                <td>${esc(p.minStock)} ${esc(p.unit || 'pcs')}</td>
                <td><span class="badge ${isLow ? 'badge-red' : 'badge-green'}">${isLow ? 'REORDER NEEDED' : 'IN STOCK'}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    printDocument('Spare Parts Inventory & Stock Report', lowStockOnly ? 'Low Stock Critical Items Only' : 'Full Storage Inventory', html);
  }

  /**
   * 6. PRINT AUDIT HISTORY TRAIL (WITH ADVANCED MULTI-FILTERING)
   */
  function printAuditHistory(moduleFilter = '', dateFrom = '', dateTo = '', personFilter = '', search = '') {
    let list = DB.History.getAll();

    if (moduleFilter) list = list.filter(h => h.module === moduleFilter);
    if (dateFrom) list = list.filter(h => (h.date || '') >= dateFrom);
    if (dateTo) list = list.filter(h => (h.date || '') <= dateTo);
    if (personFilter) list = list.filter(h => (h.person && h.person.toLowerCase().includes(personFilter.toLowerCase())) || (h.user && h.user.toLowerCase().includes(personFilter.toLowerCase())));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(h =>
        (h.title && h.title.toLowerCase().includes(q)) ||
        (h.detail && h.detail.toLowerCase().includes(q)) ||
        (h.details && h.details.toLowerCase().includes(q)) ||
        (h.person && h.person.toLowerCase().includes(q))
      );
    }

    const desc = [
      moduleFilter || 'All Modules',
      dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : '',
      personFilter ? `Staff: ${personFilter}` : '',
      search ? `Keyword: "${search}"` : ''
    ].filter(Boolean).join(' • ');

    const html = `
      <table>
        <thead>
          <tr>
            <th style="width:12%;">Date / Time</th>
            <th style="width:14%;">Module</th>
            <th style="width:24%;">Activity / Equipment</th>
            <th style="width:36%;">Details & Sign-off</th>
            <th style="width:14%;">Engineer / Staff</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(h => `
            <tr>
              <td><strong>${esc(h.date ? (DB.fmt.datetime ? DB.fmt.datetime(h.date) : h.date) : '—')}</strong></td>
              <td><span class="badge badge-blue">${esc(h.module || 'System')}</span></td>
              <td><strong>${esc(h.title || h.action || 'Log Entry')}</strong></td>
              <td>${esc(h.detail || h.details || '—')}</td>
              <td>${esc(h.person || h.user || 'System')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printDocument('Comprehensive Audit Trail & Activity Log', desc, html);
  }

  /**
   * 7. PRINT ENGINEER PORTFOLIO & WORK HISTORY
   */
  function printEngineerProfile(name) {
    if (!name) return;
    const now = new Date();
    const teamStatus = typeof Schedule !== 'undefined' ? Schedule.getTeamStatus(now) : null;
    const member = teamStatus ? teamStatus.members.find(m => m.name.toLowerCase() === name.toLowerCase()) : null;
    const role = member?.role || 'Electrical Engineer';

    // Aggregate work history
    const history = [];

    // Daily checks from schedules
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pc_sched_')) {
        try {
          const sched = JSON.parse(localStorage.getItem(k));
          sched?.days?.forEach(day => {
            ['1a','1b','2a','2b','3a','3b'].forEach(slotKey => {
              if (day[`doneBy${slotKey}`] && day[`doneBy${slotKey}`].toLowerCase() === name.toLowerCase()) {
                const taskId = day[`task${slotKey}`];
                let taskName = taskId;
                if (typeof Scheduler !== 'undefined' && Scheduler.getTask) {
                  const t = Scheduler.getTask(taskId);
                  if (t) taskName = `${t.code}: ${t.name}`;
                }
                history.push({
                  date: day[`doneAt${slotKey}`] || day.date,
                  type: 'Daily Check',
                  title: taskName,
                  detail: `Shift Slot: ${slotKey.toUpperCase()} • Notes: ${day[`notes${slotKey}`] || 'None'}`,
                  status: 'DONE'
                });
              }
            });
          });
        } catch (e) {}
      }
    }

    // CM
    DB.Corrective.getAll().forEach(cm => {
      if ((cm.technician && cm.technician.toLowerCase() === name.toLowerCase()) || (cm.reportedBy && cm.reportedBy.toLowerCase() === name.toLowerCase())) {
        history.push({
          date: cm.date || cm.createdAt?.split('T')[0],
          type: 'Corrective Maint.',
          title: `${cm.workOrderNumber}: ${cm.equipment} — ${cm.problemDescription}`,
          detail: `Action: ${cm.actionTaken || 'Pending'} • Role: ${cm.technician === name ? 'Technician' : 'Reporter'}`,
          status: cm.status.toUpperCase()
        });
      }
    });

    // Training
    DB.Training.getAll().forEach(tr => {
      if (tr.employeeName && tr.employeeName.toLowerCase() === name.toLowerCase()) {
        history.push({
          date: tr.date,
          type: 'Training Course',
          title: tr.seminarTitle || tr.topic,
          detail: `Topic: ${tr.topic} • Duration: ${tr.duration || 1} hrs • Certificate: ${tr.certificate || 'Completed'}`,
          status: 'CERTIFIED'
        });
      }
    });

    history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const html = `
      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-box-val">${history.filter(h => h.type === 'Daily Check').length}</div>
          <div class="kpi-box-lbl">Daily Checks Completed</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${history.filter(h => h.type === 'Corrective Maint.').length}</div>
          <div class="kpi-box-lbl">CM Work Orders</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${history.filter(h => h.type === 'Training Course').length}</div>
          <div class="kpi-box-lbl">Training Certifications</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${history.length}</div>
          <div class="kpi-box-lbl">Total Work Records</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:12%;">Date</th>
            <th style="width:14%;">Module</th>
            <th style="width:34%;">Activity / Task / Work Order</th>
            <th style="width:30%;">Details & Actions</th>
            <th style="width:10%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${history.map(h => `
            <tr>
              <td><strong>${esc(h.date)}</strong></td>
              <td><span class="badge badge-blue">${esc(h.type)}</span></td>
              <td><strong>${esc(h.title)}</strong></td>
              <td>${esc(h.detail)}</td>
              <td><span class="badge badge-green">${esc(h.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printDocument(`Engineer Work Portfolio: ${name}`, `Role: ${role} • 29MW Electrical Maintenance Team`, html);
  }

  // ================================================
  //  UNIVERSAL PRINT MODAL UI
  // ================================================
  function openUniversalPrintModal() {
    let modal = document.getElementById('universalPrintModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'universalPrintModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal modal-lg" style="max-width: 680px; background:#090e1a; border: 1px solid rgba(0,240,255,0.3); box-shadow: 0 25px 70px rgba(0,0,0,0.85);">
          <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.1); padding: 18px 24px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:38px;height:38px;border-radius:8px;background:rgba(0,240,255,0.15);border:1px solid rgba(0,240,255,0.3);display:flex;align-items:center;justify-content:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </div>
              <div>
                <h2 style="font-size:18px;font-weight:800;color:#fff;margin:0;">Print & Export Official Report</h2>
                <span style="font-size:12px;color:var(--text-muted);">29MW Electrical Maintenance Official Publication</span>
              </div>
            </div>
            <button class="modal-close" onclick="closeModal('universalPrintModal')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="modal-body" style="padding: 20px 24px; display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Select Report Category</label>
              <select id="upr_type" class="filter-select" style="width:100%;padding:10px 14px;background:#0d162c;border:1px solid var(--border);border-radius:8px;color:#fff;font-size:14px;outline:none;" onchange="PrintEngine._handleTypeChange()">
                <option value="executive">⚡ Executive Plant Maintenance Summary (1-Page Brief)</option>
                <option value="daily">📋 Daily Checks Inspection Schedule & Log</option>
                <option value="corrective">🔧 Corrective Maintenance (Work Orders Log)</option>
                <option value="preventive">🔍 Preventive Maintenance Watchlist</option>
                <option value="parts">📦 Spare Parts Storage & Low Stock Report</option>
                <option value="audit">📜 Comprehensive Audit Trail & History</option>
                <option value="engineer">👷 Individual Engineer Work Portfolio</option>
                <option value="equipment">🏭 Specific Equipment Dossier & History</option>
              </select>
            </div>

            <!-- Dynamic Filter Controls -->
            <div id="upr_filters" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label style="font-size:11.5px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Date From</label>
                <input type="date" id="upr_from" class="filter-select" style="width:100%;padding:8px 12px;background:#0d162c;border:1px solid var(--border);border-radius:6px;color:#fff;" />
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Date To</label>
                <input type="date" id="upr_to" class="filter-select" style="width:100%;padding:8px 12px;background:#0d162c;border:1px solid var(--border);border-radius:6px;color:#fff;" />
              </div>
            </div>

            <div id="upr_person_row">
              <label style="font-size:11.5px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Filter by Staff / Engineer</label>
              <select id="upr_person" class="filter-select" style="width:100%;padding:8px 12px;background:#0d162c;border:1px solid var(--border);border-radius:6px;color:#fff;">
                <option value="">All Engineers</option>
                <option value="Hameed Tahsin">Hameed Tahsin (Electrical Supervisor)</option>
                <option value="Namo Hoshyar">Namo Hoshyar (Electrical Engineer)</option>
                <option value="Mohammed Baqi">Mohammed Baqi (Electrical Engineer)</option>
                <option value="Mohammed Shwan">Mohammed Shwan (Electrical Engineer)</option>
                <option value="Zamwa Pshtiwan">Zamwa Pshtiwan (Electrical Engineer)</option>
              </select>
            </div>

            <div id="upr_equipment_row" style="display:none;">
              <label style="font-size:11.5px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Select Equipment</label>
              <select id="upr_equipment" class="filter-select" style="width:100%;padding:8px 12px;background:#0d162c;border:1px solid var(--border);border-radius:6px;color:#fff;">
                <option value="DAS #1">DAS #1 (Engine, HT/LT, LO & FO)</option>
                <option value="DAS #2">DAS #2 (Engine, HT/LT, LO & FO)</option>
                <option value="DAS #3">DAS #3 (Engine, HT/LT, LO & FO)</option>
                <option value="DAS #4">DAS #4 (Engine, HT/LT, LO & FO)</option>
                <option value="Unit #1 Generator">Unit #1 Generator</option>
                <option value="Unit #2 Generator">Unit #2 Generator</option>
                <option value="Main Step-up Transformers">Main Step-up Transformers</option>
                <option value="MV Switchgear Panels">MV Switchgear Panels</option>
                <option value="RCS MCC">RCS Motor Control Center (MCC)</option>
                <option value="Air Compressors">Starting Air & Service Air Compressors</option>
                <option value="DC & Battery System">DC & Battery UPS System</option>
              </select>
            </div>
          </div>

          <div class="modal-footer" style="padding: 14px 24px; border-top:1px solid rgba(255,255,255,0.1); justify-content:space-between;">
            <button class="btn-secondary" onclick="closeModal('universalPrintModal')">Cancel</button>
            <button class="btn-primary" onclick="PrintEngine._executePrint()" style="background:var(--grad-primary);color:#fff;font-weight:700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Generate & Print Report
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Set default dates
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const fromEl = document.getElementById('upr_from');
    const toEl = document.getElementById('upr_to');
    if (fromEl) fromEl.value = firstDay;
    if (toEl) toEl.value = today;

    PrintEngine._handleTypeChange();
    if (typeof openModal === 'function') openModal('universalPrintModal');
  }

  function _handleTypeChange() {
    const type = document.getElementById('upr_type')?.value;
    const eqRow = document.getElementById('upr_equipment_row');
    const personRow = document.getElementById('upr_person_row');
    const filterRow = document.getElementById('upr_filters');

    if (eqRow) eqRow.style.display = type === 'equipment' ? 'block' : 'none';
    if (personRow) personRow.style.display = (type === 'equipment' || type === 'parts') ? 'none' : 'block';
    if (filterRow) filterRow.style.display = (type === 'parts' || type === 'preventive' || type === 'equipment') ? 'none' : 'grid';
  }

  function _executePrint() {
    const type = document.getElementById('upr_type')?.value;
    const from = document.getElementById('upr_from')?.value || '';
    const to = document.getElementById('upr_to')?.value || '';
    const person = document.getElementById('upr_person')?.value || '';
    const equipment = document.getElementById('upr_equipment')?.value || '';

    closeModal('universalPrintModal');

    switch (type) {
      case 'executive':
        printExecutiveSummary();
        break;
      case 'daily':
        const [y, m] = from ? from.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
        printDailyChecks(y, m, person);
        break;
      case 'corrective':
        printCorrective(from, to, person);
        break;
      case 'preventive':
        printPreventive();
        break;
      case 'parts':
        printSpareParts(false);
        break;
      case 'audit':
        printAuditHistory('', from, to, person);
        break;
      case 'engineer':
        printEngineerProfile(person || 'Hameed Tahsin');
        break;
      case 'equipment':
        if (typeof EquipmentDossier !== 'undefined' && EquipmentDossier.printDossier) {
          EquipmentDossier.printDossier(equipment);
        } else {
          alert('Equipment Dossier module loading...');
        }
        break;
      default:
        printExecutiveSummary();
    }
  }

  return {
    printDocument,
    printExecutiveSummary,
    printDailyChecks,
    printCorrective,
    printPreventive,
    printSpareParts,
    printAuditHistory,
    printEngineerProfile,
    openUniversalPrintModal,
    _handleTypeChange,
    _executePrint,
  };
})();
