// ========================================
//  29MW Plant EMS — Login Page Logic
//  Uses DB.Users for authentication
// ========================================

// ---- Particle System ----
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDuration = (8 + Math.random() * 12) + 's';
    p.style.animationDelay    = (Math.random() * 15) + 's';
    p.style.width = p.style.height = (1 + Math.random() * 3) + 'px';
    const colors = ['#00d4ff', '#0066ff', '#f0a500', '#00e676', '#7c3aed'];
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(p);
  }
}

// ---- Password Toggle ----
function togglePass() {
  const input = document.getElementById('password');
  const icon  = document.getElementById('eyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    input.type = 'password';
    icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}

// ---- Login Handler ----
function handleLogin(e) {
  e.preventDefault();

  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const errorEl    = document.getElementById('errorMsg');
  const loginBtn   = document.getElementById('loginBtn');
  const fgUser     = document.getElementById('fgUsername');
  const fgPass     = document.getElementById('fgPassword');

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  errorEl.classList.remove('show');
  fgUser.classList.remove('error');
  fgPass.classList.remove('error');

  if (!username) { fgUser.classList.add('error'); usernameEl.focus(); return; }
  if (!password) { fgPass.classList.add('error'); passwordEl.focus(); return; }

  loginBtn.classList.add('loading');
  loginBtn.disabled = true;

  setTimeout(() => {
    // Authenticate against DB.Users
    const users = DB.Users.getAll();
    const user = users.find(u =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password &&
      u.active !== false
    );

    if (user) {
      const session = {
        user: {
          id:       user.id,
          username: user.username,
          name:     user.name,
          role:     user.role,
          initials: user.initials || user.name.slice(0,2).toUpperCase(),
          dept:     user.dept || '',
        },
        loginTime: new Date().toISOString(),
        remember: document.getElementById('rememberMe').checked,
      };

      if (session.remember) localStorage.setItem('pcSession', JSON.stringify(session));
      else                   sessionStorage.setItem('pcSession', JSON.stringify(session));

      // Success animation
      loginBtn.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Access Granted</span>`;
      loginBtn.style.background = 'linear-gradient(135deg, #00e676, #00bcd4)';
      loginBtn.classList.remove('loading');

      setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);

    } else {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
      fgUser.classList.add('error');
      fgPass.classList.add('error');
      errorEl.classList.add('show');

      const card = document.getElementById('loginCard');
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = 'shake 0.4s ease';
      setTimeout(() => { card.style.animation = ''; }, 500);
    }
  }, 900);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  createParticles();

  // Input focus effects
  document.querySelectorAll('.input-wrap input').forEach(input => {
    input.addEventListener('focus', () => {
      const icon = input.previousElementSibling;
      if (icon) icon.style.color = 'var(--cyan)';
    });
    input.addEventListener('blur', () => {
      const icon = input.previousElementSibling;
      if (icon) icon.style.color = '';
    });
  });

  // Enter key — trigger form submit
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const form = document.getElementById('loginForm');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });

  // Auto-redirect if already logged in
  const session = JSON.parse(localStorage.getItem('pcSession') || sessionStorage.getItem('pcSession') || 'null');
  if (session?.user) window.location.href = 'dashboard.html';
});
