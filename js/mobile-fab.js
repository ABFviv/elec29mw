/**
 * ================================================================
 *  29MW Plant EMS — Fast Action Mobile Floating Button (FAB)
 *  Provides 1-tap fast access on mobile/tablet to log faults,
 *  check active shift, inspect equipment dossiers, and print reports.
 * ================================================================
 */

const MobileFAB = (() => {

  function init() {
    if (document.getElementById('mobileFabContainer')) return;

    const div = document.createElement('div');
    div.id = 'mobileFabContainer';
    div.className = 'mobile-fab-container';
    div.innerHTML = `
      <button class="mobile-fab-btn" id="mobileFabMainBtn" onclick="MobileFAB.toggle()" title="Quick Actions">
        <svg id="mobileFabIcon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <div class="mobile-fab-menu" id="mobileFabMenu">
        <div class="fab-action-item" onclick="MobileFAB.actionReportFault()">
          <span class="fab-action-label">Report Fault (CM)</span>
          <div class="fab-action-btn fab-cm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
        </div>

        <div class="fab-action-item" onclick="MobileFAB.actionDailyCheck()">
          <span class="fab-action-label">Today's Inspection</span>
          <div class="fab-action-btn fab-dc">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
        </div>

        <div class="fab-action-item" onclick="MobileFAB.actionEquipmentDossier()">
          <span class="fab-action-label">Equipment Dossier</span>
          <div class="fab-action-btn fab-eq">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
        </div>

        <div class="fab-action-item" onclick="MobileFAB.actionPrintReport()">
          <span class="fab-action-label">Print Official Report</span>
          <div class="fab-action-btn fab-pr">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    // Close on tap outside
    document.addEventListener('click', (e) => {
      if (!div.contains(e.target)) {
        close();
      }
    });
  }

  function toggle() {
    const btn = document.getElementById('mobileFabMainBtn');
    const menu = document.getElementById('mobileFabMenu');
    if (!btn || !menu) return;
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
      close();
    } else {
      btn.classList.add('open');
      menu.classList.add('open');
    }
  }

  function close() {
    const btn = document.getElementById('mobileFabMainBtn');
    const menu = document.getElementById('mobileFabMenu');
    if (btn) btn.classList.remove('open');
    if (menu) menu.classList.remove('open');
  }

  function actionReportFault() {
    close();
    // If on CM page, open its modal directly
    if (typeof openModal === 'function' && document.getElementById('cmModal')) {
      openModal('cmModal');
    } else {
      window.location.href = window.location.pathname.includes('/modules/') ? 'corrective-maintenance.html' : 'modules/corrective-maintenance.html';
    }
  }

  function actionDailyCheck() {
    close();
    window.location.href = window.location.pathname.includes('/modules/') ? 'daily-check.html' : 'modules/daily-check.html';
  }

  function actionEquipmentDossier() {
    close();
    if (typeof EquipmentDossier !== 'undefined') {
      EquipmentDossier.open('DAS #1');
    } else {
      alert('Equipment Dossier opening...');
    }
  }

  function actionPrintReport() {
    close();
    if (typeof PrintEngine !== 'undefined') {
      PrintEngine.openUniversalPrintModal();
    } else {
      window.print();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    init,
    toggle,
    close,
    actionReportFault,
    actionDailyCheck,
    actionEquipmentDossier,
    actionPrintReport,
  };
})();
