// ================================================
//  Shared Module Shell — Topbar, Clock, Nav
// ================================================

function renderTopbar(moduleName) {
  const session = DB.Session.get();
  const initials = session?.user?.initials || 'AD';
  const name = session?.user?.name || 'Admin';
  const role = session?.user?.role || '';

  const el = document.getElementById('topbar');
  if (!el) return;

  el.innerHTML = `
    <div class="topbar-left">
      <a href="../dashboard.html" class="topbar-brand">
        <div class="topbar-logo" style="animation: logoPulse 3s ease-in-out infinite;">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
            <polygon points="24,2 44,12 44,36 24,46 4,36 4,12" fill="none" stroke="url(#tHG)" stroke-width="2"/>
            <path d="M27 10L18 26H25L21 38L30 22H23L27 10Z" fill="url(#tBG)"/>
            <defs>
              <linearGradient id="tHG" x1="4" y1="2" x2="44" y2="46"><stop offset="0%" stop-color="#00d4ff"/><stop offset="100%" stop-color="#f0a500"/></linearGradient>
              <linearGradient id="tBG" x1="18" y1="10" x2="30" y2="38"><stop offset="0%" stop-color="#f0a500"/><stop offset="100%" stop-color="#ff6b00"/></linearGradient>
            </defs>
          </svg>
        </div>
        <span class="topbar-name">29MW Plant</span>
      </a>
      <div class="topbar-divider"></div>
      <span class="topbar-plant">${moduleName}</span>
    </div>
    <div class="topbar-right">
      <div class="topbar-clock" id="shellClock">--:--:--</div>
      <a href="../dashboard.html" class="back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Dashboard
      </a>
      <div class="topbar-user" id="userMenuBtn" style="cursor:pointer;">
        <div class="user-avatar" style="background:var(--grad-primary);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;">${initials}</div>
        <div class="user-info">
          <span class="user-name">${name}</span>
          <span class="user-role">${role}</span>
        </div>
        <div class="user-dropdown" id="userDropdown" style="min-width:160px;">
          <div class="dd-item danger" onclick="DB.Session.logout()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </div>
        </div>
      </div>
    </div>
  `;

  // Clock
  setInterval(() => {
    const n = new Date(), p = x => String(x).padStart(2,'0');
    const el = document.getElementById('shellClock');
    if (el) el.textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  }, 1000);

  // User dropdown
  document.getElementById('userMenuBtn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('userDropdown').classList.toggle('open');
  });
  document.addEventListener('click', () => document.getElementById('userDropdown')?.classList.remove('open'));
}

// ---- Toast ----
function showToast(msg, type = 'success') {
  let t = document.getElementById('globalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'globalToast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  t.className = `toast ${type}`;
  t.innerHTML = (icons[type] || icons.info) + `<span>${msg}</span>`;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---- Modal helpers ----
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ---- Get users for dropdowns ----
function getUserOptions(selectedName = '') {
  return DB.Users.getActive().map(u =>
    `<option value="${u.name}" ${u.name === selectedName ? 'selected' : ''}>${u.name}</option>`
  ).join('');
}

// ---- Format helpers ----
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
