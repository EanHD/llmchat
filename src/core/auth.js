/**
 * Simple password gate for personal use
 * Uses SHA-256 hash so password isn't visible in source
 */

// SHA-256 hash of your password - generate with: 
// echo -n "yourpassword" | sha256sum
// Or use: https://emn178.github.io/online-tools/sha256.html
const PASSWORD_HASH = '7804a56a5c7636cc05814736f44139e32920810d3bd51aa099a5df932e754ce9'; // 'ubuntu'

const AUTH_KEY = 'kai_authenticated';
const AUTH_EXPIRY_DAYS = 30;

/**
 * Hash a string with SHA-256
 */
async function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (!auth) return false;
  
  try {
    const { expiry } = JSON.parse(auth);
    if (Date.now() > expiry) {
      localStorage.removeItem(AUTH_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify password and set auth
 */
export async function authenticate(password) {
  const hash = await sha256(password);
  if (hash === PASSWORD_HASH) {
    const expiry = Date.now() + (AUTH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ expiry }));
    return true;
  }
  return false;
}

/**
 * Logout
 */
export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

/**
 * Show login screen
 */
export function showLoginScreen() {
  const app = document.getElementById('app');
  app.style.display = 'none';
  
  const loginHTML = `
    <div id="login-screen" style="
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary, #0a0a0f);
      padding: 20px;
      z-index: 9999;
    ">
      <div style="
        max-width: 320px;
        width: 100%;
        text-align: center;
      ">
        <h1 style="
          font-size: 48px;
          margin-bottom: 8px;
          color: var(--text-primary, #f9fafb);
        ">Kai</h1>
        <p style="
          color: var(--text-secondary, #9ca3af);
          margin-bottom: 32px;
          font-size: 14px;
        ">Private AI Companion</p>
        
        <form id="login-form" style="display: flex; flex-direction: column; gap: 12px;">
          <input 
            type="password" 
            id="login-password" 
            placeholder="Password"
            autocomplete="current-password"
            style="
              padding: 14px 16px;
              border-radius: 12px;
              border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
              background: var(--bg-secondary, #1a1a2e);
              color: var(--text-primary, #f9fafb);
              font-size: 16px;
              outline: none;
              width: 100%;
              box-sizing: border-box;
            "
          />
          <button 
            type="submit"
            style="
              padding: 14px 16px;
              border-radius: 12px;
              border: none;
              background: var(--accent-primary, #2D5A8C);
              color: white;
              font-size: 16px;
              font-weight: 500;
              cursor: pointer;
              transition: opacity 0.2s;
            "
          >Enter</button>
        </form>
        
        <p id="login-error" style="
          color: #ef4444;
          margin-top: 16px;
          font-size: 14px;
          display: none;
        ">Incorrect password</p>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', loginHTML);
  
  const form = document.getElementById('login-form');
  const passwordInput = document.getElementById('login-password');
  const errorMsg = document.getElementById('login-error');
  
  passwordInput.focus();
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    
    if (await authenticate(password)) {
      document.getElementById('login-screen').remove();
      app.style.display = '';
      window.location.reload(); // Reload to init app properly
    } else {
      errorMsg.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
    }
  });
}

/**
 * Initialize auth gate
 * Call this before app loads
 */
export async function initAuth() {
  // Skip auth if hash not configured
  if (PASSWORD_HASH === 'SET_YOUR_HASH_HERE') {
    console.warn('Auth not configured - set PASSWORD_HASH in auth.js');
    return true;
  }
  
  if (isAuthenticated()) {
    return true;
  }
  
  showLoginScreen();
  return false;
}
