/**
 * ================================================================
 *  29MW Plant EMS — Equipment Dossier Engine
 *  Aggregates complete lifecycle history, inspections, fault repairs,
 *  PM watchlist status, and attached technical documents per machine.
 * ================================================================
 */

const EquipmentDossier = (() => {

  const EQUIPMENT_REGISTRY = [
    { id: 'DAS #1', name: 'DAS #1 Generator Engine', category: 'Engine & Auxiliary', location: 'Turbine Hall Bay 1', specs: 'V18 Diesel Engine • HT/LT Cooling • FO Booster', critical: true },
    { id: 'DAS #2', name: 'DAS #2 Generator Engine', category: 'Engine & Auxiliary', location: 'Turbine Hall Bay 2', specs: 'V18 Diesel Engine • HT/LT Cooling • FO Booster', critical: true },
    { id: 'DAS #3', name: 'DAS #3 Generator Engine', category: 'Engine & Auxiliary', location: 'Turbine Hall Bay 3', specs: 'V18 Diesel Engine • HT/LT Cooling • FO Booster', critical: true },
    { id: 'DAS #4', name: 'DAS #4 Generator Engine', category: 'Engine & Auxiliary', location: 'Turbine Hall Bay 4', specs: 'V18 Diesel Engine • LO Separator 4 • Tightness Monitoring', critical: true },
    { id: 'Unit #1 Generator', name: 'Unit #1 Alternator', category: 'Electrical Generation', location: 'Turbine Hall Unit 1', specs: '14.5MW 6.3kV Synchronous Generator', critical: true },
    { id: 'Unit #2 Generator', name: 'Unit #2 Alternator', category: 'Electrical Generation', location: 'Turbine Hall Unit 2', specs: '14.5MW 6.3kV Synchronous Generator', critical: true },
    { id: 'Main Step-up Transformers', name: 'Step-up Transformers (TR-1 / TR-2)', category: 'High Voltage', location: 'Outdoor Switchyard', specs: '6.3kV to 33kV • Buchholz Relay • ONAN Oil Cooling', critical: true },
    { id: 'MV Switchgear Panels', name: 'Medium Voltage Switchgear', category: 'Switchgear', location: 'MV Switchgear Room', specs: '6.3kV Incomers & 33kV Outgoing Feeders • Busbars', critical: true },
    { id: 'RCS MCC', name: 'RCS & Motor Control Center (MCC)', category: 'Control & Distribution', location: 'Auxiliary Electrical Room', specs: 'Motor starters • RCS visual & tightness checks', critical: false },
    { id: 'Air Compressors', name: 'Starting Air & Service Air Compressors', category: 'Air Systems', location: 'Compressor Room', specs: '30 Bar Starting Air • 8 Bar Service Air', critical: false },
    { id: 'DC & Battery System', name: '110V DC System & Battery UPS', category: 'Protection & DC', location: 'Battery Room', specs: '110V DC Float Charge • Critical Trip Power', critical: true },
  ];

  let currentDossierData = null;

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getEquipmentInfo(name) {
    const found = EQUIPMENT_REGISTRY.find(e => name.toLowerCase().includes(e.id.toLowerCase()) || e.name.toLowerCase().includes(name.toLowerCase()));
    return found || {
      id: name,
      name: name,
      category: 'Plant System',
      location: '29MW Plant',
      specs: 'Industrial Electrical Equipment',
      critical: false,
    };
  }

  function open(equipmentName) {
    const eq = getEquipmentInfo(equipmentName);
    const key = eq.id;

    // 1. Gather all CM tickets for this equipment
    const allCm = (typeof DB !== 'undefined' && DB.Corrective) ? DB.Corrective.getAll() : [];
    const cmMatches = allCm.filter(c => (c.equipment && c.equipment.toLowerCase().includes(key.toLowerCase())) || (key.toLowerCase().includes(c.equipment?.toLowerCase())));

    // 2. Gather all PM watchlist items for this equipment
    const allPm = (typeof DB !== 'undefined' && DB.Preventive) ? DB.Preventive.getAll() : [];
    const pmMatches = allPm.filter(p => (p.equipment && p.equipment.toLowerCase().includes(key.toLowerCase())) || (key.toLowerCase().includes(p.equipment?.toLowerCase())));

    // 3. Gather daily check occurrences matching this equipment
    const checkMatches = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pc_sched_')) {
        try {
          const s = JSON.parse(localStorage.getItem(k));
          s?.days?.forEach(day => {
            ['1a','1b','2a','2b','3a','3b'].forEach(slot => {
              const taskId = day[`task${slot}`];
              let tName = taskId;
              if (typeof Scheduler !== 'undefined' && Scheduler.getTask) {
                const t = Scheduler.getTask(taskId);
                if (t) tName = `${t.code}: ${t.name}`;
              }
              if (tName.toLowerCase().includes(key.toLowerCase()) || (eq.category && tName.toLowerCase().includes(eq.category.toLowerCase()))) {
                checkMatches.push({
                  date: day.date,
                  shift: slot,
                  task: tName,
                  status: day[`status${slot}`] || 'pending',
                  doneBy: day[`doneBy${slot}`] || '',
                  notes: day[`notes${slot}`] || '',
                });
              }
            });
          });
        } catch (e) {}
      }
    }

    // 4. Gather attached documents / photos across CM and direct docs
    const documents = [];
    cmMatches.forEach(cm => {
      if (cm.attachments && Array.isArray(cm.attachments)) {
        cm.attachments.forEach(att => {
          documents.push({
            ...att,
            source: `CM WO: ${cm.workOrderNumber}`,
            equipment: eq.name,
            date: cm.date || '—',
          });
        });
      }
    });

    // Determine current health status
    let healthStatus = 'normal';
    let healthLabel = '🟢 Normal Operation';
    if (cmMatches.some(c => c.status === 'open' && c.priority === 'critical')) {
      healthStatus = 'critical';
      healthLabel = '🔴 Critical Fault Active';
    } else if (cmMatches.some(c => c.status === 'open' || c.status === 'in-progress')) {
      healthStatus = 'open-work';
      healthLabel = '🟡 Active Work Order';
    } else if (pmMatches.length > 0) {
      healthStatus = 'watchlist';
      healthLabel = '⚠️ On PM Watchlist';
    }

    currentDossierData = {
      equipment: eq,
      healthStatus,
      healthLabel,
      cmMatches,
      pmMatches,
      checkMatches,
      documents,
      currentTab: 'all',
    };

    renderDossierModal();
    if (typeof openModal === 'function') openModal('equipmentModal');
  }

  function renderDossierModal() {
    let modal = document.getElementById('equipmentModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'equipmentModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const { equipment: eq, healthLabel, cmMatches, pmMatches, checkMatches, documents } = currentDossierData;

    modal.innerHTML = `
      <div class="modal modal-lg" style="max-width: 860px; background:#090e1a; border: 1px solid rgba(0,240,255,0.3); box-shadow: 0 30px 80px rgba(0,0,0,0.85);">
        <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.1); padding: 18px 24px;">
          <div style="display:flex;align-items:center;gap:14px;flex:1;">
            <div style="width:46px;height:46px;border-radius:12px;background:rgba(0,240,255,0.12);border:1px solid rgba(0,240,255,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <h2 style="font-size:20px;font-weight:800;color:#fff;margin:0;">${esc(eq.name)}</h2>
                <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:100px;background:rgba(0,240,255,0.15);color:#00f0ff;border:1px solid rgba(0,240,255,0.3);">${esc(eq.category)}</span>
                <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:100px;background:rgba(255,255,255,0.06);color:#e2e8f0;">${esc(healthLabel)}</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:3px;font-family:'JetBrains Mono',monospace;">
                Location: ${esc(eq.location)} • ${esc(eq.specs)}
              </div>
            </div>
          </div>
          <button class="modal-close" onclick="closeModal('equipmentModal')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-body" style="padding: 20px 24px;">
          <!-- 4 KPI Cards -->
          <div class="eng-kpi-grid" style="margin-bottom:18px;">
            <div class="eng-kpi-card kpi-cyan">
              <div class="eng-kpi-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="eng-kpi-body">
                <div class="eng-kpi-val">${checkMatches.length}</div>
                <div class="eng-kpi-lbl">Inspections Checked</div>
              </div>
            </div>
            <div class="eng-kpi-card kpi-rose">
              <div class="eng-kpi-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3366" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </div>
              <div class="eng-kpi-body">
                <div class="eng-kpi-val">${cmMatches.length}</div>
                <div class="eng-kpi-lbl">CM Work Orders</div>
              </div>
            </div>
            <div class="eng-kpi-card kpi-amber">
              <div class="eng-kpi-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffb300" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div class="eng-kpi-body">
                <div class="eng-kpi-val">${pmMatches.length}</div>
                <div class="eng-kpi-lbl">PM Watch Items</div>
              </div>
            </div>
            <div class="eng-kpi-card kpi-pink">
              <div class="eng-kpi-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb7185" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div class="eng-kpi-body">
                <div class="eng-kpi-val">${documents.length}</div>
                <div class="eng-kpi-lbl">Photos & Docs</div>
              </div>
            </div>
          </div>

          <!-- Dossier Filter Tabs -->
          <div class="eng-filter-row" style="margin-bottom:12px;">
            <div class="eng-tabs" role="tablist">
              <button class="eng-tab ${currentDossierData.currentTab === 'all' ? 'active' : ''}" onclick="EquipmentDossier.setTab('all')">
                All History <span class="eng-tab-badge">${cmMatches.length + pmMatches.length + checkMatches.length}</span>
              </button>
              <button class="eng-tab ${currentDossierData.currentTab === 'cm' ? 'active' : ''}" onclick="EquipmentDossier.setTab('cm')">
                CM Repairs <span class="eng-tab-badge">${cmMatches.length}</span>
              </button>
              <button class="eng-tab ${currentDossierData.currentTab === 'daily' ? 'active' : ''}" onclick="EquipmentDossier.setTab('daily')">
                Daily Checks <span class="eng-tab-badge">${checkMatches.length}</span>
              </button>
              <button class="eng-tab ${currentDossierData.currentTab === 'docs' ? 'active' : ''}" onclick="EquipmentDossier.setTab('docs')">
                Attached Photos & Files <span class="eng-tab-badge">${documents.length}</span>
              </button>
            </div>
            <button class="btn-secondary" style="padding:6px 14px;font-size:12px;gap:6px;" onclick="EquipmentDossier.printDossier('${esc(eq.id)}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Machine Dossier
            </button>
          </div>

          <!-- Tab Content Body -->
          <div class="eng-history-list" id="eqDossierFeed">
            ${renderTabContent()}
          </div>
        </div>

        <div class="modal-footer" style="padding:14px 24px;border-top:1px solid rgba(255,255,255,0.1);justify-content:space-between;">
          <span style="font-size:12px;color:var(--text-muted);">29MW Plant Asset Management System</span>
          <button class="btn-secondary" onclick="closeModal('equipmentModal')">Close Dossier</button>
        </div>
      </div>
    `;
  }

  function setTab(tab) {
    if (!currentDossierData) return;
    currentDossierData.currentTab = tab;
    document.querySelectorAll('#equipmentModal .eng-tab').forEach(b => {
      b.classList.remove('active');
    });
    const feed = document.getElementById('eqDossierFeed');
    if (feed) feed.innerHTML = renderTabContent();
  }

  function renderTabContent() {
    const { cmMatches, pmMatches, checkMatches, documents, currentTab, equipment: eq } = currentDossierData;

    if (currentTab === 'docs') {
      if (!documents.length) {
        return `
          <div class="eng-empty-state">
            <div class="eng-empty-icon">📁</div>
            <div class="eng-empty-text">No technical photos or documents attached yet for ${esc(eq.name)}.</div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">When logging CM faults or maintenance jobs, tap "Attach Photo / Document" to save damaged parts images, vendor specs, or test sheets.</div>
          </div>
        `;
      }
      return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;">
          ${documents.map((doc, idx) => `
            <div style="background:rgba(13,22,44,0.6);border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;">
              ${doc.dataUrl && doc.dataUrl.startsWith('data:image') ? `
                <img src="${doc.dataUrl}" alt="${esc(doc.name)}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;" onclick="EquipmentDossier.viewImage('${doc.dataUrl}')" />
              ` : `
                <div style="height:120px;background:rgba(255,255,255,0.04);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:28px;">📄</div>
              `}
              <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(doc.name)}</div>
              <div style="font-size:10.5px;color:var(--text-muted);">${esc(doc.source)} • ${esc(doc.date)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (currentTab === 'cm') {
      if (!cmMatches.length) return emptyNotice('No corrective maintenance work orders recorded on this equipment.');
      return cmMatches.map(c => `
        <div class="eng-history-item type-cm">
          <div class="eng-item-header">
            <div class="eng-item-meta">
              <span class="eng-type-tag tag-cm">Corrective WO</span>
              <span class="eng-item-date">${esc(c.date)}</span>
            </div>
            <span class="eng-item-status ${c.status === 'closed' ? 'status-pill-done' : 'status-pill-open'}">${esc(c.status.toUpperCase())}</span>
          </div>
          <div class="eng-item-title">${esc(c.workOrderNumber)}: ${esc(c.problemDescription)}</div>
          <div class="eng-item-sub">Assigned Tech: ${esc(c.technician || '—')} • Priority: ${esc(c.priority)}</div>
          ${c.actionTaken ? `<div class="eng-item-notes">Action Taken: ${esc(c.actionTaken)}</div>` : ''}
        </div>
      `).join('');
    }

    if (currentTab === 'daily') {
      if (!checkMatches.length) return emptyNotice('No daily inspection checklist events recorded for this unit.');
      return checkMatches.map(ch => `
        <div class="eng-history-item type-daily-check">
          <div class="eng-item-header">
            <div class="eng-item-meta">
              <span class="eng-type-tag tag-daily-check">Inspection</span>
              <span class="eng-item-date">${esc(ch.date)}</span>
            </div>
            <span class="eng-item-status status-pill-done">${esc(ch.status.toUpperCase())}</span>
          </div>
          <div class="eng-item-title">${esc(ch.task)}</div>
          <div class="eng-item-sub">Shift: ${esc(ch.shift.toUpperCase())} • Signed by: ${esc(ch.doneBy || '—')}</div>
          ${ch.notes ? `<div class="eng-item-notes">${esc(ch.notes)}</div>` : ''}
        </div>
      `).join('');
    }

    // ALL HISTORY
    const all = [
      ...cmMatches.map(c => ({ ...c, type: 'cm', time: c.date, title: `${c.workOrderNumber}: ${c.problemDescription}`, sub: `Technician: ${c.technician} • Priority: ${c.priority}` })),
      ...pmMatches.map(p => ({ ...p, type: 'pm', time: p.scheduledDate || p.createdAt?.split('T')[0], title: `PM Watch: ${p.notes || p.task || 'Monitor Condition'}`, sub: `Observer: ${p.assignedTo}` })),
      ...checkMatches.map(ch => ({ ...ch, type: 'daily', time: ch.date, title: ch.task, sub: `Shift: ${ch.shift.toUpperCase()} • Signed: ${ch.doneBy}` })),
    ];

    all.sort((a,b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

    if (!all.length) return emptyNotice('No history records recorded yet for this equipment.');

    return all.map(item => `
      <div class="eng-history-item type-${item.type === 'cm' ? 'cm' : (item.type === 'daily' ? 'daily-check' : 'training')}">
        <div class="eng-item-header">
          <div class="eng-item-meta">
            <span class="eng-type-tag ${item.type === 'cm' ? 'tag-cm' : (item.type === 'daily' ? 'tag-daily-check' : 'tag-training')}">
              ${item.type === 'cm' ? 'Corrective' : (item.type === 'daily' ? 'Daily Check' : 'PM Watch')}
            </span>
            <span class="eng-item-date">${esc(item.time)}</span>
          </div>
          <span class="eng-item-status ${item.status === 'closed' || item.status === 'done' ? 'status-pill-done' : 'status-pill-open'}">
            ${esc((item.status || 'RECORDED').toUpperCase())}
          </span>
        </div>
        <div class="eng-item-title">${esc(item.title)}</div>
        <div class="eng-item-sub">${esc(item.sub)}</div>
        ${item.actionTaken ? `<div class="eng-item-notes">Action: ${esc(item.actionTaken)}</div>` : ''}
      </div>
    `).join('');
  }

  function emptyNotice(msg) {
    return `
      <div class="eng-empty-state">
        <div class="eng-empty-icon">⚙️</div>
        <div class="eng-empty-text">${esc(msg)}</div>
      </div>
    `;
  }

  function viewImage(url) {
    const w = window.open('');
    w.document.write(`<body style="margin:0;background:#090e1a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${url}" style="max-width:95%;max-height:95%;border-radius:8px;box-shadow:0 0 40px rgba(0,0,0,0.8);" /></body>`);
  }

  /**
   * Prints the complete publication-ready equipment dossier
   */
  function printDossier(equipmentName) {
    const eq = getEquipmentInfo(equipmentName);
    const key = eq.id;
    const allCm = (typeof DB !== 'undefined' && DB.Corrective) ? DB.Corrective.getAll() : [];
    const cmMatches = allCm.filter(c => (c.equipment && c.equipment.toLowerCase().includes(key.toLowerCase())) || (key.toLowerCase().includes(c.equipment?.toLowerCase())));
    const allPm = (typeof DB !== 'undefined' && DB.Preventive) ? DB.Preventive.getAll() : [];
    const pmMatches = allPm.filter(p => (p.equipment && p.equipment.toLowerCase().includes(key.toLowerCase())) || (key.toLowerCase().includes(p.equipment?.toLowerCase())));

    const html = `
      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-box-val">${esc(eq.category)}</div>
          <div class="kpi-box-lbl">System Category</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${esc(eq.location)}</div>
          <div class="kpi-box-lbl">Plant Location</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${cmMatches.length}</div>
          <div class="kpi-box-lbl">Total CM Faults Logged</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val">${pmMatches.length}</div>
          <div class="kpi-box-lbl">Watchlist Items</div>
        </div>
      </div>

      <div style="background:#f8fafc;border:1pt solid #cbd5e1;padding:8pt 10pt;border-radius:4pt;margin-bottom:12pt;font-size:9pt;">
        <strong>Equipment Specifications & Notes:</strong> ${esc(eq.specs)}
      </div>

      <h3 style="font-size:11pt;margin:12pt 0 4pt;font-weight:700;">Corrective Maintenance & Repair Work Orders</h3>
      ${cmMatches.length ? `
        <table>
          <thead>
            <tr>
              <th style="width:12%;">WO Number</th>
              <th style="width:12%;">Date</th>
              <th style="width:34%;">Fault Description</th>
              <th style="width:24%;">Action Taken</th>
              <th style="width:10%;">Technician</th>
              <th style="width:8%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${cmMatches.map(c => `
              <tr>
                <td><strong>${esc(c.workOrderNumber)}</strong></td>
                <td>${esc(c.date)}</td>
                <td>${esc(c.problemDescription)}</td>
                <td>${esc(c.actionTaken || '—')}</td>
                <td>${esc(c.technician)}</td>
                <td><span class="badge ${c.status === 'closed' ? 'badge-green' : 'badge-red'}">${esc(c.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#64748b;font-style:italic;">No historical corrective maintenance tickets recorded on this unit.</p>'}
    `;

    if (typeof PrintEngine !== 'undefined') {
      PrintEngine.printDocument(`Official Equipment Dossier: ${eq.name}`, `Plant Tag: ${eq.id} • 29MW Electrical Maintenance`, html);
    }
  }

  return {
    open,
    setTab,
    viewImage,
    printDossier,
    REGISTRY: EQUIPMENT_REGISTRY,
  };
})();
