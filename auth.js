/* ==================== auth.js ====================
   Login / signup against Supabase Auth (REST calls),
   session state, and the nav auth UI (login/signup/user badge). */

let authTab = 'login';
let currentUser = null; // { id, email, name, accessToken }

function openAuth(tab){
  authTab = tab;
  resetAuthForm();
  setAuthTab(tab);
  document.getElementById('auth-overlay').classList.add('open');
}
function closeAuth(){ document.getElementById('auth-overlay').classList.remove('open'); }
function setAuthTab(tab){
  authTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab==='login');
  document.getElementById('tab-signup').classList.toggle('active', tab==='signup');
  document.getElementById('auth-title').textContent = tab==='login' ? t('authTitleLogin') : t('authTitleSignup');
  document.getElementById('auth-submit').textContent = tab==='login' ? t('authSubmitLogin') : t('authSubmitSignup');
  document.getElementById('auth-name-field').style.display = tab==='login' ? 'none' : 'flex';
  document.getElementById('auth-error').textContent = '';
  const countEl = document.getElementById('auth-user-count');
  if(countEl) countEl.textContent = t('authSecureNote');
}
function resetAuthForm(){
  document.getElementById('auth-form').reset();
  document.getElementById('auth-error').textContent = '';
}

async function handleAuthSubmit(e){
  e.preventDefault();
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  const name = document.getElementById('auth-name-input').value.trim();
  const email = document.getElementById('auth-email-input').value.trim().toLowerCase();
  const password = document.getElementById('auth-pass-input').value;

  if(!email || !password || (authTab === 'signup' && !name)){
    errEl.textContent = t('authErrRequired');
    return;
  }
  if(password.length < 6){
    errEl.textContent = t('authErrShortPass');
    return;
  }

  const submitBtn = document.getElementById('auth-submit');
  submitBtn.disabled = true;

  try{
    if(authTab === 'signup'){
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data: { name } })
      });
      const data = await res.json();
      if(!res.ok){
        errEl.textContent = data.msg && data.msg.toLowerCase().includes('already')
          ? t('authErrExists') : (data.msg || data.error_description || t('authErrGeneric'));
        submitBtn.disabled = false;
        return;
      }
      if(!data.access_token || !data.user){
        // Email confirmation still required server-side
        errEl.textContent = t('authErrConfirmNeeded');
        submitBtn.disabled = false;
        return;
      }
      // Save the customer profile row (protected by RLS: only this user can write their own row)
      await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${data.access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ id: data.user.id, name, email })
      });
      currentUser = { id: data.user.id, email, name, accessToken: data.access_token };
    } else {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if(!res.ok){
        errEl.textContent = t('authErrWrongPass');
        submitBtn.disabled = false;
        return;
      }
      const displayName = (data.user && data.user.user_metadata && data.user.user_metadata.name) || email;
      currentUser = { id: data.user.id, email, name: displayName, accessToken: data.access_token };
    }
    closeAuth();
    updateAuthUI();
  }catch(err){
    errEl.textContent = t('authErrGeneric');
  }
  submitBtn.disabled = false;
}

function updateAuthUI(){
  const loginBtn = document.getElementById('nav-login-btn');
  const ctaBtn = document.getElementById('nav-cta-btn');
  const badge = document.getElementById('nav-user-badge');
  if(currentUser){
    loginBtn.style.display = 'none';
    ctaBtn.style.display = 'none';
    badge.style.display = 'flex';
    document.getElementById('nav-user-name').textContent = currentUser.name || currentUser.email;
  } else {
    loginBtn.style.display = '';
    ctaBtn.style.display = '';
    badge.style.display = 'none';
  }
}

function logoutUser(){
  currentUser = null;
  updateAuthUI();
}
