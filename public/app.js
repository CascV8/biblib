'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const STORE = 'biblib:v1';
  const OLD_STORE = 'citekit:v1'; // projects saved before the rename
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'i' + Math.random().toString(36).slice(2, 10);

  // ---------- Source types ----------
  // Each source type has a CSL type (what the formatter sees), the form fields it shows,
  // and the contributor roles it offers. `manual` types rarely have pages to autofill from,
  // so picking one opens the form straight away.
  const SOURCES = [
    { id: 'website', label: 'Website', type: 'webpage', main: true,
      fields: [['title', 'Page title'], ['container-title', 'Website name'], ['publisher'], ['issued'], ['URL'], ['accessed']] },
    { id: 'book', label: 'Book', type: 'book', main: true, roles: ['author', 'editor', 'translator'],
      fields: [['title'], ['edition'], ['volume'], ['publisher'], ['publisher-place'], ['issued'], ['ISBN'], ['DOI'], ['URL']] },
    { id: 'journal', label: 'Journal article', type: 'article-journal', main: true,
      fields: [['title', 'Article title'], ['container-title', 'Journal'], ['volume'], ['issue'], ['page'], ['issued'], ['DOI'], ['URL'], ['accessed']] },
    { id: 'preformatted', label: 'Pre-formatted', type: 'preformatted', main: true, manual: true },

    { id: 'artwork', label: 'Artwork', type: 'graphic', manual: true, authorLabel: 'Artist',
      fields: [['title'], ['medium', 'Medium (e.g. Oil on canvas)'], ['dimensions'], ['archive', 'Museum / collection'], ['archive-place', 'Museum location'], ['issued', 'Date created'], ['URL'], ['accessed']] },
    { id: 'bill', label: 'Bill', type: 'bill', manual: true,
      fields: [['title', 'Bill title'], ['number', 'Bill number'], ['authority', 'Legislative body'], ['chapter-number', 'Session'], ['container-title', 'Published in'], ['issued'], ['URL']] },
    { id: 'blog', label: 'Blog post', type: 'post-weblog',
      fields: [['title', 'Post title'], ['container-title', 'Blog name'], ['issued'], ['URL'], ['accessed']] },
    { id: 'broadcast', label: 'TV / radio broadcast', type: 'broadcast', manual: true, roles: ['director', 'author'], authorLabel: 'Writer',
      fields: [['title', 'Episode title'], ['container-title', 'Program / series'], ['number', 'Episode number'], ['publisher', 'Network'], ['publisher-place'], ['issued', 'Air date'], ['URL']] },
    { id: 'chapter', label: 'Book chapter', type: 'chapter', roles: ['author', 'editor', 'translator'],
      fields: [['title', 'Chapter title'], ['container-title', 'Book title'], ['edition'], ['volume'], ['page'], ['publisher'], ['publisher-place'], ['issued'], ['ISBN'], ['DOI'], ['URL']] },
    { id: 'communication', label: 'Communication (email, letter)', type: 'personal_communication', manual: true, roles: ['author', 'recipient'],
      fields: [['title', 'Subject / description'], ['genre', 'Type (e.g. Email, Letter)'], ['issued'], ['URL']] },
    { id: 'dictionary', label: 'Dictionary entry', type: 'entry-dictionary', roles: ['author', 'editor'],
      fields: [['title', 'Entry'], ['container-title', 'Dictionary'], ['edition'], ['publisher'], ['publisher-place'], ['issued'], ['URL'], ['accessed']] },
    { id: 'encyclopedia', label: 'Encyclopedia entry', type: 'entry-encyclopedia', roles: ['author', 'editor'],
      fields: [['title', 'Entry'], ['container-title', 'Encyclopedia'], ['edition'], ['volume'], ['publisher'], ['publisher-place'], ['issued'], ['URL'], ['accessed']] },
    { id: 'film', label: 'Film', type: 'motion_picture', roles: ['director', 'author'], authorLabel: 'Writer',
      fields: [['title'], ['publisher', 'Studio / distributor'], ['publisher-place', 'Country'], ['issued', 'Release date'], ['medium', 'Format (e.g. DVD)'], ['URL']] },
    { id: 'interview', label: 'Interview', type: 'interview', roles: ['author', 'interviewer'], authorLabel: 'Interviewee',
      fields: [['title'], ['container-title', 'Published in'], ['medium', 'Format'], ['issued'], ['URL'], ['accessed']] },
    { id: 'legal_case', label: 'Legal case', type: 'legal_case', manual: true, noAuthors: true,
      fields: [['title', 'Case name'], ['authority', 'Court'], ['container-title', 'Reporter'], ['volume'], ['page', 'First page'], ['number', 'Docket number'], ['issued', 'Decision date'], ['URL']] },
    { id: 'legislation', label: 'Legislation', type: 'legislation', manual: true, noAuthors: true,
      fields: [['title', 'Act / statute name'], ['container-title', 'Code'], ['volume', 'Title / volume'], ['section'], ['number', 'Public law number'], ['issued'], ['URL']] },
    { id: 'magazine', label: 'Magazine article', type: 'article-magazine',
      fields: [['title', 'Article title'], ['container-title', 'Magazine'], ['volume'], ['issue'], ['page'], ['issued'], ['URL'], ['accessed']] },
    { id: 'map', label: 'Map', type: 'map', manual: true, authorLabel: 'Cartographer',
      fields: [['title'], ['genre', 'Map type'], ['scale'], ['publisher'], ['publisher-place'], ['issued'], ['URL'], ['accessed']] },
    { id: 'newspaper', label: 'Newspaper article', type: 'article-newspaper',
      fields: [['title', 'Article title'], ['container-title', 'Newspaper'], ['section'], ['page'], ['edition'], ['publisher-place', 'City'], ['issued'], ['URL'], ['accessed']] },
    { id: 'patent', label: 'Patent', type: 'patent', manual: true, authorLabel: 'Inventor',
      fields: [['title'], ['number', 'Patent number'], ['authority', 'Issuing office / country'], ['issued', 'Date issued'], ['URL']] },
    { id: 'score', label: 'Music score', type: 'musical_score', manual: true, roles: ['composer', 'editor'],
      fields: [['title'], ['publisher'], ['publisher-place'], ['issued'], ['URL']] },
    { id: 'song', label: 'Song', type: 'song', roles: ['author', 'composer'], authorLabel: 'Performer',
      fields: [['title', 'Song title'], ['container-title', 'Album'], ['publisher', 'Record label'], ['medium', 'Format'], ['issued'], ['URL']] },
    { id: 'speech', label: 'Speech / lecture', type: 'speech', manual: true, authorLabel: 'Speaker',
      fields: [['title'], ['genre', 'Type (e.g. Lecture)'], ['event-title', 'Event'], ['event-place', 'Location'], ['issued'], ['URL']] },
    { id: 'video', label: 'Video', type: 'motion_picture', defaults: { medium: 'Video' }, roles: ['author', 'director'], authorLabel: 'Creator / channel',
      fields: [['title', 'Video title'], ['container-title', 'Website / platform'], ['issued', 'Upload date'], ['URL'], ['accessed']] },

    // Not offered as buttons, but lookups (Crossref, arXiv…) return them.
    { id: 'report', label: 'Report', type: 'report', other: true,
      fields: [['title'], ['publisher', 'Institution / publisher'], ['publisher-place'], ['number', 'Report number'], ['issued'], ['DOI'], ['URL'], ['accessed']] },
    { id: 'thesis', label: 'Thesis', type: 'thesis', other: true,
      fields: [['title'], ['genre', 'Degree (e.g. PhD thesis)'], ['publisher', 'University'], ['publisher-place'], ['issued'], ['DOI'], ['URL']] },
    { id: 'conference', label: 'Conference paper', type: 'paper-conference', other: true, roles: ['author', 'editor'],
      fields: [['title'], ['container-title', 'Proceedings title'], ['volume'], ['page'], ['publisher'], ['publisher-place'], ['issued'], ['DOI'], ['URL']] },
    { id: 'preprint', label: 'Preprint / article', type: 'article', other: true,
      fields: [['title'], ['container-title', 'Repository'], ['number', 'Identifier'], ['issued'], ['DOI'], ['URL'], ['accessed']] },
    { id: 'dataset', label: 'Dataset', type: 'dataset', other: true,
      fields: [['title'], ['container-title', 'Repository'], ['publisher'], ['version'], ['issued'], ['DOI'], ['URL'], ['accessed']] },
  ];
  const SOURCE = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
  const FIELD_LABEL = {
    title: 'Title', 'container-title': 'Published in', publisher: 'Publisher', 'publisher-place': 'Place of publication',
    issued: 'Published (YYYY-MM-DD)', accessed: 'Accessed (YYYY-MM-DD)', edition: 'Edition', volume: 'Volume', issue: 'Issue',
    page: 'Pages', DOI: 'DOI', ISBN: 'ISBN', URL: 'URL', section: 'Section', dimensions: 'Dimensions', scale: 'Scale', version: 'Version',
  };
  const DATE_FIELDS = new Set(['issued', 'accessed']);
  const WIDE_FIELDS = new Set(['title', 'URL']);
  const ROLE_LABEL = { author: 'Author', editor: 'Editor', translator: 'Translator', director: 'Director', recipient: 'Recipient', interviewer: 'Interviewer', composer: 'Composer' };
  const ALL_ROLES = Object.keys(ROLE_LABEL);
  const editorNoun = (s) => (s.id === 'preformatted' ? 'pre-formatted reference' : s.label.toLowerCase());
  const roleLabel = (src, role) => (role === 'author' && src.authorLabel) || ROLE_LABEL[role];

  function sourceFor(item) {
    if (item.source && SOURCE[item.source]) return SOURCE[item.source];
    const t = item.csl && item.csl.type;
    if (t === 'motion_picture') return /video/i.test(item.csl.medium || '') ? SOURCE.video : SOURCE.film;
    return SOURCES.find((s) => s.type === t) || SOURCE.website;
  }

  // ---------- State ----------
  // Guests keep projects in localStorage. Signed-in users' projects live on the server;
  // localStorage then only remembers which project was open.
  let account = null; // { id, email } when signed in
  let state = loadGuest();
  let rendered = []; // [{id, html, intext}] for current project, in display order
  let activeSource = 'website';

  function readStore(key) {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (s && s.projects && s.projects.length) return s;
    } catch (e) { /* storage unavailable */ }
    return null;
  }
  function freshState() {
    const p = newProject('My first project');
    return { projects: [p], currentId: p.id };
  }
  function loadGuest() {
    return readStore(STORE) || readStore(OLD_STORE) || freshState();
  }
  const userKey = () => `biblib:user:${account.id}:current`;
  function save() {
    if (account) {
      try { localStorage.setItem(userKey(), state.currentId); } catch (e) { /* ignore */ }
      scheduleSync();
    } else {
      try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }
  }
  function newProject(name) {
    return { id: uid(), name, style: 'apa', font: 'Times New Roman', size: '12', items: [] };
  }
  const project = () => state.projects.find((p) => p.id === state.currentId) || state.projects[0];
  const isPre = (item) => item.source === 'preformatted';

  // ---------- API ----------
  async function api(path, body) {
    const r = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    if (!r.ok) throw new Error((data && data.error) || 'Request failed');
    return data;
  }

  // ---------- Cloud accounts (Supabase) ----------
  // Accounts switch on when public/config.js has a Supabase URL and anon key.
  // Projects are rows in a `projects` table protected by row-level security (see supabase/schema.sql).
  const CONFIG = window.BIBLIB_CONFIG || {};
  let sb = null; // Supabase client, once loaded

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function initCloud() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) return false;
    await loadScript('vendor/supabase.js');
    sb = window.BiblibSupabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    sb.auth.onAuthStateChange((event, session) => {
      // Arrived from a "reset password" email: let them choose a new password.
      if (event === 'PASSWORD_RECOVERY') setTimeout(() => openAuth('recover'), 0);
      if (event === 'SIGNED_OUT' && account && !account.loggingOut) sessionExpired();
      if (event === 'SIGNED_IN' && session && account && account.expired && session.user.id === account.id) {
        signedIn(toAccount(session.user), { offerImport: false });
      }
    });
    return true;
  }

  const toAccount = (u) => ({ id: u.id, email: u.email || '' });
  const authErr = (error) => {
    const msg = error.message || 'Something went wrong';
    const err = new Error(
      /invalid login credentials/i.test(msg) ? 'Email or password is incorrect.'
        : /email not confirmed/i.test(msg) ? 'Confirm your email first — check your inbox for the link we sent.'
        : /already registered/i.test(msg) ? 'An account with that email already exists. Try logging in.'
        : msg);
    err.status = error.status;
    return err;
  };
  const isAuthFailure = (error) => error && (error.status === 401 || /jwt|not authenticated|row-level security/i.test(error.message || ''));

  const cloud = {
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return data.session ? toAccount(data.session.user) : null;
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw authErr(error);
      // With email confirmation on, there's no session until they click the link.
      return { user: data.session ? toAccount(data.user) : null, needsConfirm: !data.session };
    },
    async logIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw authErr(error);
      return toAccount(data.user);
    },
    async logOut() {
      await sb.auth.signOut();
    },
    async sendReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw authErr(error);
    },
    async setPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw authErr(error);
    },
    async verifyPassword(password) {
      const { error } = await sb.auth.signInWithPassword({ email: account.email, password });
      if (error) throw new Error('That password is incorrect.');
    },
    async deleteAccount() {
      const { error } = await sb.rpc('delete_my_account');
      if (error) throw authErr(error);
      await sb.auth.signOut();
    },
    async listProjects() {
      const { data, error } = await sb.from('projects').select('id, data, position').order('position');
      if (error) throw error;
      return data.map((r) => ({ ...r.data, id: r.id }));
    },
    async saveProject(p, position) {
      const { error } = await sb.from('projects').upsert(
        { user_id: account.id, id: p.id, data: p, position, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,id' });
      if (error) throw error;
    },
    async deleteProject(id) {
      const { error } = await sb.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
  };

  // ---------- Account sync ----------
  // Each project is saved separately; we remember what the server last accepted and only send changes.
  let synced = new Map(); // project id -> JSON last saved to the server
  let syncTimer = null;
  let syncing = false;
  let syncState = 'saved'; // saved | saving | error

  const projectJson = (p, i) => JSON.stringify({ p, i });

  function scheduleSync(delay = 700) {
    clearTimeout(syncTimer);
    if (account && account.expired) return; // held in memory until they log back in
    setSyncState('saving');
    syncTimer = setTimeout(syncNow, delay);
  }

  async function syncNow() {
    if (!account || account.expired) return;
    if (syncing) return scheduleSync(300);
    syncing = true;
    const user = account;
    try {
      const current = new Map(state.projects.map((p, i) => [p.id, projectJson(p, i)]));
      for (const [id, json] of current) {
        if (synced.get(id) === json) continue;
        const { p, i } = JSON.parse(json);
        await cloud.saveProject(p, i);
        if (account !== user) return;
        synced.set(id, json);
      }
      for (const id of [...synced.keys()]) {
        if (current.has(id)) continue;
        await cloud.deleteProject(id);
        synced.delete(id);
      }
      const dirty = [...current].some(([id, json]) => synced.get(id) !== json);
      if (dirty) scheduleSync(100);
      else setSyncState('saved');
    } catch (e) {
      if (isAuthFailure(e)) return sessionExpired();
      setSyncState('error');
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncNow, 5000);
    } finally {
      syncing = false;
    }
  }

  function setSyncState(s) {
    syncState = s;
    const el = $('#syncStatus');
    if (!el) return;
    el.textContent = s === 'saving' ? 'Saving…' : s === 'error' ? 'Not saved — retrying' : 'All changes saved';
    el.className = 'sync ' + s;
  }

  // Unsaved changes: warn before the tab closes.
  window.addEventListener('beforeunload', (e) => {
    if (account && syncState !== 'saved') {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  async function loadAccountState() {
    const projects = await cloud.listProjects();
    synced = new Map();
    projects.forEach((p, i) => synced.set(p.id, projectJson(p, i)));
    let remembered = null;
    try { remembered = localStorage.getItem(userKey()); } catch (e) { /* ignore */ }
    state = { projects, currentId: projects.some((p) => p.id === remembered) ? remembered : projects[0] && projects[0].id };
    if (!projects.length) {
      state = freshState();
      save();
    }
    setSyncState('saved');
  }

  async function signedIn(user, { offerImport }) {
    if (account && account.expired && account.id === user.id) {
      // Same person logging back in after their session lapsed: keep what's on screen and save it.
      account = user;
      renderAccount();
      scheduleSync(0);
      return;
    }
    const guest = account ? null : state;
    account = user;
    await loadAccountState();
    const guestWork = guest && offerImport ? guest.projects.filter((p) => p.items.length) : [];
    if (guestWork.length) {
      const n = guestWork.length;
      if (confirm(`Add ${n} project${n === 1 ? '' : 's'} from this browser to your account?`)) {
        const ids = new Set(state.projects.map((p) => p.id));
        const fresh = state.projects.length === 1 && !state.projects[0].items.length && !synced.has(state.projects[0].id);
        const imported = guestWork.map((p) => (ids.has(p.id) ? { ...p, id: uid() } : p));
        state.projects = fresh ? imported : [...imported, ...state.projects];
        state.currentId = imported[0].id;
        try { localStorage.removeItem(STORE); localStorage.removeItem(OLD_STORE); } catch (e) { /* ignore */ }
        save();
      }
    }
    renderAccount();
    renderAll();
  }

  function sessionExpired() {
    // Keep the projects on screen (and unsaved edits in memory) until the user logs back in.
    if (!account || account.expired) return;
    account.expired = true;
    clearTimeout(syncTimer);
    setSyncState('error');
    renderAccount();
    toast('You were logged out. Log in again to save your changes.');
    openAuth('login', account.email);
  }

  function backToGuest() {
    account = null;
    synced = new Map();
    state = loadGuest();
    renderAccount();
    renderAll();
  }

  // ---------- Account UI ----------
  function renderAccount() {
    const box = $('#account');
    if (!sb) {
      box.innerHTML = '';
      $('#guestNote').hidden = true;
      return;
    }
    $('#guestNote').hidden = !!account;
    if (!account) {
      box.innerHTML = `<button class="btn ghost-btn" data-auth="login">Log in</button><button class="btn primary" data-auth="signup">Sign up</button>`;
      return;
    }
    box.innerHTML = `<span id="syncStatus" class="sync"></span>
      <div class="menu-wrap">
        <button class="btn acct-btn" id="acctBtn" aria-haspopup="true"><span class="avatar">${esc((account.email[0] || '?').toUpperCase())}</span><span class="acct-email">${esc(account.email)}</span> &#9662;</button>
        <div class="menu acct-menu" id="acctMenu" hidden>
          <div class="menu-label">Signed in as<br><strong>${esc(account.email)}</strong></div>
          ${account.expired ? '<button data-acct="relogin">Log in again</button>' : ''}
          <button data-acct="password">Change password</button>
          <button data-acct="logout">Log out</button>
          <button data-acct="delete" class="danger">Delete account…</button>
        </div>
      </div>`;
    if (account.expired) {
      $('#syncStatus').textContent = 'Logged out — not saved';
      $('#syncStatus').className = 'sync error';
    } else setSyncState(syncState);
    $('#acctBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      $('#acctMenu').hidden = !$('#acctMenu').hidden;
    });
    $('#acctMenu').addEventListener('click', (e) => {
      const act = e.target.dataset.acct;
      if (!act) return;
      $('#acctMenu').hidden = true;
      if (act === 'logout') logOut();
      else if (act === 'relogin') openAuth('login', account.email);
      else openAuth(act);
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-auth]');
    if (b && sb) openAuth(b.dataset.auth);
  });

  async function logOut() {
    if (syncState !== 'saved' && !account.expired) await syncNow();
    if (syncState !== 'saved' && !account.expired && !confirm('Some changes haven’t been saved yet. Log out anyway?')) return;
    account.loggingOut = true;
    try { await cloud.logOut(); } catch (e) { /* the local session is cleared either way */ }
    backToGuest();
    toast('Logged out');
  }

  // One dialog serves log in, sign up, reset, change password and delete account.
  const AUTH_MODES = {
    login: {
      title: 'Log in', sub: 'Welcome back. Your projects are waiting.', submit: 'Log in',
      fields: [['email', 'Email', 'email', 'username'], ['password', 'Password', 'password', 'current-password']],
      switchTo: ['Don’t have an account?', 'signup', 'Sign up'],
      extra: ['forgot', 'Forgot your password?'],
    },
    signup: {
      title: 'Create your account', sub: 'Save your projects and open them from any browser. It’s free.', submit: 'Create account',
      fields: [['email', 'Email', 'email', 'username'], ['password', 'Password (at least 8 characters)', 'password', 'new-password']],
      switchTo: ['Already have an account?', 'login', 'Log in'],
    },
    forgot: {
      title: 'Reset your password', sub: 'We’ll email you a link to choose a new password.', submit: 'Send reset link',
      fields: [['email', 'Email', 'email', 'username']],
      switchTo: ['Remembered it?', 'login', 'Log in'],
    },
    recover: {
      title: 'Choose a new password', sub: 'Enter a new password for your account.', submit: 'Save password',
      fields: [['next', 'New password (at least 8 characters)', 'password', 'new-password']],
    },
    password: {
      title: 'Change password', sub: 'Enter your current password, then the new one.', submit: 'Change password',
      fields: [['current', 'Current password', 'password', 'current-password'], ['next', 'New password (at least 8 characters)', 'password', 'new-password']],
    },
    delete: {
      title: 'Delete account', sub: 'This permanently deletes your account and every project saved in it. It can’t be undone.', submit: 'Delete my account', danger: true,
      fields: [['password', 'Enter your password to confirm', 'password', 'current-password']],
    },
  };
  let authMode = 'login';
  const authDialog = $('#authDialog');

  function openAuth(mode, email) {
    authMode = mode;
    const m = AUTH_MODES[mode];
    $('#authTitle').textContent = m.title;
    $('#authSub').textContent = m.sub;
    $('#authSubmit').textContent = m.submit;
    $('#authSubmit').hidden = false;
    $('#authSubmit').classList.toggle('danger-btn', !!m.danger);
    $('#authError').textContent = '';
    $('#authError').classList.remove('ok');
    $('#authFields').innerHTML = m.fields.map(([name, label, type, ac]) =>
      `<label class="auth-field">${esc(label)}<input name="${name}" type="${type}" autocomplete="${ac}" required></label>`).join('')
      + (m.extra ? `<button type="button" class="link small-link" data-switch="${m.extra[0]}">${esc(m.extra[1])}</button>` : '');
    if (email && $('#authFields [name=email]')) $('#authFields [name=email]').value = email;
    $('#authSwitch').innerHTML = m.switchTo ? `${esc(m.switchTo[0])} <button type="button" class="link" data-switch="${m.switchTo[1]}">${esc(m.switchTo[2])}</button>` : '';
    if (!authDialog.open) authDialog.showModal();
    const first = [...$('#authFields').querySelectorAll('input')].find((i) => !i.value);
    (first || $('#authFields input')).focus();
  }
  function authMessage(text) {
    // Replace the form with a success message (e.g. "check your email").
    $('#authFields').innerHTML = '';
    $('#authError').textContent = text;
    $('#authError').classList.add('ok');
    $('#authSubmit').hidden = true;
    $('#authCancel').textContent = 'Close';
  }
  authDialog.addEventListener('close', () => ($('#authCancel').textContent = 'Cancel'));
  authDialog.addEventListener('click', (e) => {
    const to = e.target.dataset.switch;
    if (to) openAuth(to, ($('#authFields [name=email]') || {}).value);
  });
  $('#authCancel').addEventListener('click', () => authDialog.close());

  const checkNewPassword = (pw) => {
    if (String(pw || '').length < 8) throw new Error('Use a password of at least 8 characters.');
  };

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (data.email) data.email = data.email.trim().toLowerCase();
    const btn = $('#authSubmit');
    btn.disabled = true;
    $('#authError').textContent = '';
    try {
      if (authMode === 'login') {
        const user = await cloud.logIn(data.email, data.password);
        authDialog.close();
        await signedIn(user, { offerImport: true });
        toast('Logged in');
      } else if (authMode === 'signup') {
        checkNewPassword(data.password);
        const { user, needsConfirm } = await cloud.signUp(data.email, data.password);
        if (needsConfirm) {
          authMessage(`Almost done — we sent a confirmation link to ${data.email}. Click it, then log in here.`);
        } else {
          authDialog.close();
          await signedIn(user, { offerImport: true });
          toast('Account created — your projects now save to it');
        }
      } else if (authMode === 'forgot') {
        await cloud.sendReset(data.email);
        authMessage(`If ${data.email} has an account, a reset link is on its way. Check your inbox.`);
      } else if (authMode === 'recover') {
        checkNewPassword(data.next);
        await cloud.setPassword(data.next);
        authDialog.close();
        const user = await cloud.currentUser();
        if (user && (!account || account.id !== user.id)) await signedIn(user, { offerImport: true });
        toast('Password updated — you’re logged in');
      } else if (authMode === 'password') {
        checkNewPassword(data.next);
        await cloud.verifyPassword(data.current);
        await cloud.setPassword(data.next);
        authDialog.close();
        toast('Password changed');
      } else if (authMode === 'delete') {
        await cloud.verifyPassword(data.password);
        account.loggingOut = true;
        await cloud.deleteAccount();
        authDialog.close();
        backToGuest();
        toast('Your account has been deleted');
      }
    } catch (err) {
      $('#authError').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- UI helpers ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2400);
  }
  function setStatus(msg, isError) {
    const s = $('#status');
    s.textContent = msg || '';
    s.classList.toggle('error', !!isError);
  }
  const dateToStr = (d) => (d && d['date-parts'] && d['date-parts'][0] ? d['date-parts'][0].filter(Boolean).map((n, i) => (i ? String(n).padStart(2, '0') : n)).join('-') : (d && d.raw) || '');
  function strToDate(s) {
    s = (s || '').trim();
    if (!s) return undefined;
    const m = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
    if (m) return { 'date-parts': [[+m[1], m[2] && +m[2], m[3] && +m[3]].filter(Boolean)] };
    return { raw: s };
  }
  const todayDate = () => {
    const d = new Date();
    return { 'date-parts': [[d.getFullYear(), d.getMonth() + 1, d.getDate()]] };
  };
  const nameStr = (a) => a.literal || [a.given, a.family].filter(Boolean).join(' ');
  const plainText = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    d.querySelectorAll('.csl-left-margin').forEach((n) => n.append(' '));
    return d.textContent.replace(/\s+/g, ' ').trim();
  };
  // Pre-formatted references keep only basic inline formatting.
  function sanitizeInline(html) {
    const src = document.createElement('div');
    src.innerHTML = html;
    const ALLOWED = { I: 'i', EM: 'i', B: 'b', STRONG: 'b', U: 'u', SUP: 'sup', SUB: 'sub' };
    const walk = (node) => {
      let out = '';
      for (const n of node.childNodes) {
        if (n.nodeType === 3) out += esc(n.textContent);
        else if (n.nodeType === 1) {
          const inner = walk(n);
          const tag = ALLOWED[n.tagName] || (n.tagName === 'SPAN' && /italic/.test(n.style.fontStyle) ? 'i' : null);
          if (tag) out += `<${tag}>${inner}</${tag}>`;
          else if (n.tagName === 'BR' || n.tagName === 'DIV' || n.tagName === 'P') out += (out && !out.endsWith(' ') ? ' ' : '') + inner;
          else out += inner;
        }
      }
      return out;
    };
    return walk(src).replace(/\s+/g, ' ').trim();
  }
  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const fileBase = () => (project().name || 'bibliography').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'bibliography';

  // ---------- Sidebar ----------
  function listHeading(style) {
    if (style === 'mla') return 'Works Cited';
    if (style === 'chicago-nb') return 'Bibliography';
    return 'References';
  }

  function renameProject(p, name) {
    p.name = name.trim() || 'Untitled project';
    save();
    renderSidebar();
    renderHead();
  }

  function startRename(li, p) {
    const label = li.querySelector('.p-name');
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.value = p.name;
    input.setAttribute('aria-label', 'Project name');
    label.replaceWith(input);
    li.classList.add('renaming');
    input.focus();
    input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      if (commit) renameProject(p, input.value);
      else renderSidebar();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  function renderSidebar() {
    const ul = $('#projectList');
    ul.innerHTML = '';
    for (const p of state.projects) {
      const li = document.createElement('li');
      li.className = p.id === state.currentId ? 'active' : '';
      li.title = 'Double-click to rename';
      li.innerHTML = `<span class="p-name">${esc(p.name || 'Untitled')} <span class="count">${p.items.length}</span></span>
        <span class="p-tools">
          <button class="ren" title="Rename project" aria-label="Rename project">&#9998;</button>
          <button class="del" title="Delete project" aria-label="Delete project">&times;</button>
        </span>`;
      li.addEventListener('click', (e) => {
        if (li.classList.contains('renaming')) return;
        if (e.target.closest('.ren')) return startRename(li, p);
        if (e.target.closest('.del')) {
          if (!confirm(`Delete "${p.name}" and its ${p.items.length} sources?`)) return;
          state.projects = state.projects.filter((x) => x.id !== p.id);
          if (!state.projects.length) state.projects.push(newProject('Untitled project'));
          if (state.currentId === p.id) state.currentId = state.projects[0].id;
        } else {
          if (state.currentId === p.id) return;
          state.currentId = p.id;
          $('#sidebar').classList.remove('open');
        }
        save();
        renderAll();
      });
      li.querySelector('.p-name').addEventListener('dblclick', (e) => {
        e.preventDefault();
        startRename(li, p);
      });
      ul.appendChild(li);
    }
  }

  // ---------- Reference list ----------
  function renderHead() {
    const p = project();
    if (document.activeElement !== $('#projectName')) $('#projectName').value = p.name;
    $('#styleSelect').value = p.style;
    $('#fontSelect').value = p.font;
    $('#sizeSelect').value = p.size;
    $('#refsTitle').textContent = `${listHeading(p.style)} · ${p.items.length} source${p.items.length === 1 ? '' : 's'}`;
    const list = $('#refList');
    list.style.fontFamily = `"${p.font}", serif`;
    list.style.fontSize = (+p.size + 3) + 'px';
  }

  const REQUIRED = {
    website: ['title', 'issued', 'URL'],
    book: ['author', 'title', 'issued', 'publisher'],
    journal: ['author', 'title', 'issued', 'container-title'],
    newspaper: ['title', 'issued', 'container-title'],
    magazine: ['title', 'issued', 'container-title'],
    video: ['title', 'issued', 'URL'],
    film: ['title', 'issued'],
    chapter: ['author', 'title', 'container-title', 'issued'],
    legal_case: ['title', 'issued'],
    legislation: ['title', 'issued'],
  };
  function missingFields(item) {
    if (isPre(item)) return [];
    const csl = item.csl;
    const want = REQUIRED[sourceFor(item).id] || ['title', 'issued'];
    return want.filter((k) => (k === 'author' ? !(csl.author && csl.author.length) : !csl[k]));
  }

  let formatSeq = 0;
  async function renderRefs() {
    const p = project();
    renderHead();
    $('#empty').hidden = p.items.length > 0;
    if (!p.items.length) {
      rendered = [];
      $('#refList').innerHTML = '';
      $('#textOnly').hidden = true;
      return;
    }
    const seq = ++formatSeq;
    const cslItems = p.items.filter((i) => !isPre(i));
    let entries = [];
    let textOnly = [];
    try {
      if (cslItems.length) ({ entries, textOnly } = BiblibFormat.format(cslItems.map((i) => i.csl), p.style));
      if (seq !== formatSeq) return;
    } catch (e) {
      if (seq === formatSeq) setStatus(e.message, true);
      return;
    }
    // Pre-formatted entries are slotted in alphabetically, or appended for numbered styles.
    const numbered = entries.some((e) => e.html.includes('csl-left-margin'));
    for (const item of p.items.filter(isPre)) {
      const en = { id: item.csl.id, html: `<div class="csl-entry">${item.pre || ''}</div>`, intext: '' };
      const key = plainText(en.html).toLowerCase();
      const at = numbered ? -1 : entries.findIndex((x) => plainText(x.html).replace(/^\W+/, '').toLowerCase() > key);
      if (at < 0) entries.push(en);
      else entries.splice(at, 0, en);
    }
    rendered = entries;

    const byId = Object.fromEntries(p.items.map((i) => [i.csl.id, i]));
    const list = $('#refList');
    list.innerHTML = '';
    for (const en of rendered) {
      const item = byId[en.id];
      if (!item) continue;
      const li = document.createElement('li');
      li.className = 'ref' + (en.html.includes('csl-left-margin') ? ' numbered' : '');
      const miss = missingFields(item);
      const label = sourceFor(item).label;
      li.innerHTML = `${en.html}
        <div class="ref-meta">
          <span class="src-tag">${esc(label)}</span>
          ${en.intext ? `<span class="intext" title="In-text citation">In-text: ${esc(en.intext)}</span>` : ''}
          ${item.note ? `<span class="note">${esc(item.note)}</span>` : ''}
          ${miss.length ? `<span class="warn">Missing: ${esc(miss.map((k) => (k === 'issued' ? 'date' : k === 'container-title' ? 'container' : k)).join(', '))}</span>` : ''}
          <span class="ref-tools">
            <button data-act="copy">Copy</button>
            ${en.intext ? '<button data-act="intext">Copy in-text</button>' : ''}
            <button data-act="edit">Edit</button>
            <button data-act="dup">Duplicate</button>
            <button data-act="del" class="danger">Delete</button>
          </span>
        </div>`;
      li.querySelector('.ref-tools').addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act) refAction(act, item, en);
      });
      li.querySelector('.csl-entry').addEventListener('dblclick', () => openEditor(item));
      list.appendChild(li);
    }

    // Sources this style cites in the text but leaves out of the list.
    const extra = $('#textOnly');
    extra.innerHTML = '';
    extra.hidden = !textOnly.length;
    if (textOnly.length) {
      extra.innerHTML = `<h4>Cited in text only</h4><p class="hint">${esc(styleLabel(p.style))} doesn’t list these in the ${esc(listHeading(p.style).toLowerCase())}. Cite them in your text like this:</p><ul></ul>`;
      for (const t of textOnly) {
        const item = byId[t.id];
        if (!item) continue;
        const li = document.createElement('li');
        li.innerHTML = `<span class="src-tag">${esc(sourceFor(item).label)}</span> <span class="to-cite">${t.intext || esc(item.csl.title || '')}</span>
          <span class="ref-tools"><button data-act="intext">Copy</button><button data-act="edit">Edit</button><button data-act="del" class="danger">Delete</button></span>`;
        const en = { html: t.intext, intext: plainText(t.intext) };
        li.querySelector('.ref-tools').addEventListener('click', (e) => {
          const act = e.target.dataset.act;
          if (act) refAction(act, item, en);
        });
        extra.querySelector('ul').appendChild(li);
      }
    }
  }
  let styleNames = {};
  const styleLabel = (id) => styleNames[id] || id;

  function renderAll() {
    renderSidebar();
    renderRefs();
  }

  async function copyRich(html, text) {
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast('Copied to clipboard');
    } catch (e) {
      toast('Copy failed — your browser blocked clipboard access');
    }
  }

  function refAction(act, item, en) {
    const p = project();
    if (act === 'copy') copyRich(en.html, plainText(en.html));
    else if (act === 'intext') copyRich(esc(en.intext), en.intext);
    else if (act === 'edit') openEditor(item);
    else if (act === 'dup') {
      const copy = JSON.parse(JSON.stringify(item));
      copy.csl.id = uid();
      p.items.push(copy);
      save(); renderAll();
    } else if (act === 'del') {
      p.items.splice(p.items.indexOf(item), 1);
      save(); renderAll();
      toast('Source deleted');
    }
  }

  // ---------- Source type picker ----------
  const PLACEHOLDERS = {
    website: 'Paste a website URL, or search by title',
    book: 'Search by book title or ISBN',
    journal: 'Paste a DOI or article URL, or search by title',
    chapter: 'Paste a DOI, or search by chapter title',
    newspaper: 'Paste a news article URL',
    magazine: 'Paste a magazine article URL',
    blog: 'Paste a blog post URL',
    video: 'Paste a video URL (YouTube, Vimeo…)',
    film: 'Paste a URL about the film, or enter it manually',
  };
  const placeholderFor = (id) => PLACEHOLDERS[id] || `Paste a URL to autofill this ${SOURCE[id].label.toLowerCase()}, or enter it manually`;

  function selectSource(id) {
    const src = SOURCE[id];
    if (src.manual) return openEditor(null, id);
    activeSource = id;
    document.querySelectorAll('.chip[data-source]').forEach((x) => x.classList.toggle('active', x.dataset.source === id));
    const more = $('#moreBtn');
    more.classList.toggle('active', !src.main);
    more.innerHTML = (src.main ? 'More' : esc(src.label)) + ' &#9662;';
    $('#searchInput').placeholder = placeholderFor(id);
    $('#searchInput').focus();
  }

  function buildMoreMenu() {
    const menu = $('#moreMenu');
    menu.innerHTML = SOURCES.filter((s) => !s.main && !s.other)
      .map((s) => `<button data-source-pick="${s.id}">${esc(s.label)}</button>`).join('');
  }

  document.querySelectorAll('.chip[data-source]').forEach((c) => c.addEventListener('click', () => selectSource(c.dataset.source)));
  $('#moreBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#downloadMenu').hidden = true;
    $('#moreMenu').hidden = !$('#moreMenu').hidden;
  });
  $('#moreMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-source-pick]');
    if (!b) return;
    $('#moreMenu').hidden = true;
    selectSource(b.dataset.sourcePick);
  });
  $('#manualBtn').addEventListener('click', () => openEditor(null, activeSource));

  // ---------- Searching ----------
  // A web page looked up while e.g. "Newspaper article" is selected becomes that type.
  const WEB_RETYPE = new Set(['newspaper', 'magazine', 'blog', 'video', 'film', 'interview', 'dictionary', 'encyclopedia', 'song']);

  function addItem(csl) {
    const p = project();
    csl = { ...csl, id: uid() };
    let source;
    const src = SOURCE[activeSource];
    if (WEB_RETYPE.has(src.id) && ['webpage', 'article-newspaper', 'motion_picture'].includes(csl.type)) {
      csl.type = src.type;
      Object.assign(csl, src.defaults || {});
      source = src.id;
    }
    const item = { csl, note: '', added: Date.now() };
    if (source) item.source = source;
    p.items.push(item);
    save();
    renderAll();
    toast(missingFields(item).length ? 'Added — some details are missing, click Edit to fill them in' : 'Citation added');
  }

  $('#searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (!q) return;
    const btn = $('#searchBtn');
    btn.disabled = true;
    $('#results').innerHTML = '';
    setStatus('Looking that up…');
    try {
      const { results } = await api('/api/lookup', { query: q });
      if (!results.length) {
        setStatus('Nothing found. Try another search, or enter the details manually.', true);
      } else if (results.length === 1 && results[0].source !== 'Crossref' && results[0].source !== 'Open Library') {
        setStatus('');
        $('#searchInput').value = '';
        addItem(results[0].item);
      } else {
        setStatus(`${results.length} matches — pick the one you mean:`);
        showResults(results);
      }
    } catch (err) {
      setStatus(err.message + ' You can enter the details manually instead.', true);
    } finally {
      btn.disabled = false;
    }
  });

  function showResults(results) {
    const ul = $('#results');
    ul.innerHTML = '';
    for (const r of results) {
      const it = r.item;
      const year = it.issued && it.issued['date-parts'] ? it.issued['date-parts'][0][0] : '';
      const authors = (it.author || []).slice(0, 3).map(nameStr).join(', ') + ((it.author || []).length > 3 ? ' et al.' : '');
      const where = it['container-title'] || it.publisher || '';
      const li = document.createElement('li');
      li.innerHTML = `<div><div class="r-title">${esc(it.title)}</div>
        <div class="r-meta"><span class="r-src">${esc(sourceFor({ csl: it }).label)}</span>${esc([authors, year, where].filter(Boolean).join(' · '))}</div></div>
        <button class="btn small">Cite</button>`;
      li.querySelector('button').addEventListener('click', () => {
        addItem(it);
        ul.innerHTML = '';
        setStatus('');
        $('#searchInput').value = '';
      });
      ul.appendChild(li);
    }
  }

  // ---------- Editor ----------
  let editing = null; // { item | null, source, csl }
  const editor = $('#editor');

  function openEditor(item, sourceId) {
    const source = item ? sourceFor(item) : SOURCE[sourceId || activeSource];
    const csl = item ? JSON.parse(JSON.stringify(item.csl)) : { id: uid(), type: source.type, ...(source.defaults || {}) };
    if (!item && source.fields && source.fields.some(([k]) => k === 'accessed')) csl.accessed = todayDate();
    editing = { item, source, csl };
    $('#editorTitle').textContent = item ? `Edit ${editorNoun(source)}` : `New ${editorNoun(source)}`;
    $('#noteField').value = item ? item.note || '' : '';
    $('#preField').innerHTML = item && item.pre ? item.pre : '';
    buildFields();
    buildAuthors();
    editor.showModal();
    if (source.id === 'preformatted') $('#preField').focus();
    updatePreview();
  }

  function sourceOptions(selected) {
    const opt = (s) => `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${esc(s.label)}</option>`;
    return `<optgroup label="Common">${SOURCES.filter((s) => s.main).map(opt).join('')}</optgroup>
      <optgroup label="More">${SOURCES.filter((s) => !s.main && !s.other).map(opt).join('')}</optgroup>
      <optgroup label="Other">${SOURCES.filter((s) => s.other).map(opt).join('')}</optgroup>`;
  }

  function buildFields() {
    const { csl, source } = editing;
    const grid = $('#fields');
    grid.innerHTML = `<label class="full">Source type<select id="f-type">${sourceOptions(source.id)}</select></label>`;
    const pre = source.id === 'preformatted';
    $('#preBlock').hidden = !pre;
    $('#authorsBlock').hidden = pre || !!source.noAuthors;
    for (const [key, label] of source.fields || []) {
      const val = DATE_FIELDS.has(key) ? dateToStr(csl[key]) : csl[key] ?? '';
      grid.insertAdjacentHTML('beforeend', `<label class="${WIDE_FIELDS.has(key) ? 'full' : ''}">${esc(label || FIELD_LABEL[key] || key)}<input data-key="${key}" value="${esc(val)}"></label>`);
    }
    $('#f-type').addEventListener('change', (e) => {
      readFields();
      const next = SOURCE[e.target.value];
      if (next.id === 'preformatted' && !$('#preField').textContent.trim() && editing.csl.title) {
        // Seed the free-text box with the current formatted reference so it can be tweaked.
        $('#preField').innerHTML = $('#editorPreview').innerHTML.replace(/<\/?div[^>]*>/g, '');
      }
      editing.source = next;
      editing.csl.type = next.type;
      if (next.defaults) Object.assign(editing.csl, next.defaults);
      buildFields();
      buildAuthors();
      updatePreview();
    });
    grid.querySelectorAll('input').forEach((i) => i.addEventListener('input', debouncedPreview));
  }

  function buildAuthors() {
    const { csl, source } = editing;
    $('#authors').innerHTML = '';
    const rows = [];
    for (const role of ALL_ROLES) for (const n of csl[role] || []) rows.push([role, n]);
    if (!rows.length) rows.push([(source.roles || ['author'])[0], {}]);
    rows.forEach(([role, n]) => addAuthorRow(role, n));
  }

  function addAuthorRow(role, a = {}) {
    const src = editing.source;
    const roles = src.roles || ['author'];
    if (!roles.includes(role)) role = roles[0];
    const row = document.createElement('div');
    row.className = 'author-row';
    const given = a.literal ? '' : a.given || '';
    const family = a.literal || a.family || '';
    row.innerHTML = `<select class="a-role" aria-label="Role">${roles.map((r) => `<option value="${r}"${r === role ? ' selected' : ''}>${esc(roleLabel(src, r))}</option>`).join('')}</select>
      <input placeholder="First / given name(s)" class="a-given" value="${esc(given)}">
      <input placeholder="Last name, or organization" class="a-family" value="${esc(family)}">
      <button type="button" aria-label="Remove">&times;</button>`;
    row.querySelector('button').addEventListener('click', () => { row.remove(); debouncedPreview(); });
    row.querySelectorAll('input, select').forEach((i) => i.addEventListener('input', debouncedPreview));
    $('#authors').appendChild(row);
  }
  $('#addAuthor').addEventListener('click', () => {
    const rows = $('#authors').querySelectorAll('.a-role');
    addAuthorRow(rows.length ? rows[rows.length - 1].value : (editing.source.roles || ['author'])[0]);
  });

  function readFields() {
    const { csl, source } = editing;
    $('#fields').querySelectorAll('input[data-key]').forEach((inp) => {
      const k = inp.dataset.key;
      const v = inp.value.trim();
      if (!v) delete csl[k];
      else csl[k] = DATE_FIELDS.has(k) ? strToDate(v) : v;
    });
    // Older CSL processors read "event" rather than "event-title".
    if (csl['event-title']) csl.event = csl['event-title'];
    else delete csl.event;
    if (source.id !== 'preformatted') {
      for (const r of ALL_ROLES) delete csl[r];
      if (!source.noAuthors) for (const row of $('#authors').querySelectorAll('.author-row')) {
        const role = row.querySelector('.a-role').value;
        const given = row.querySelector('.a-given').value.trim();
        const family = row.querySelector('.a-family').value.trim();
        if (!family && !given) continue;
        (csl[role] = csl[role] || []).push(given ? { given, family } : { literal: family });
      }
    }
    return csl;
  }

  let previewTimer;
  function debouncedPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 300);
  }
  async function updatePreview() {
    const pv = $('#editorPreview');
    if (editing.source.id === 'preformatted') {
      pv.innerHTML = '';
      return;
    }
    const csl = readFields();
    if (!csl.title && !csl.author) { pv.innerHTML = ''; return; }
    try {
      const { entries, textOnly } = BiblibFormat.format([csl], project().style);
      pv.innerHTML = entries[0] ? entries[0].html
        : textOnly[0] ? `<span class="pv-note">Cited in text only in this style:</span> ${textOnly[0].intext}` : '';
    } catch (e) {
      pv.textContent = '';
    }
  }
  $('#preField').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault(); // a reference is one paragraph
  });

  $('#cancelEdit').addEventListener('click', () => editor.close());
  $('#editorForm').addEventListener('submit', () => {
    const { source } = editing;
    const csl = readFields();
    let pre;
    if (source.id === 'preformatted') {
      pre = sanitizeInline($('#preField').innerHTML);
      if (!pre) {
        toast('Type the reference first');
        setTimeout(() => editor.showModal(), 0);
        return;
      }
    } else if (!csl.title) {
      toast('A title is required');
      setTimeout(() => editor.showModal(), 0);
      return;
    }
    const note = $('#noteField').value.trim();
    const item = editing.item || { added: Date.now() };
    item.csl = source.id === 'preformatted' ? { id: csl.id, type: 'preformatted' } : csl;
    item.source = source.id;
    item.note = note;
    if (pre) item.pre = pre;
    else delete item.pre;
    if (!editing.item) project().items.push(item);
    save();
    renderAll();
    toast(editing.item ? 'Source updated' : 'Citation added');
  });

  // ---------- Project controls ----------
  $('#newProject').addEventListener('click', () => {
    const p = newProject('Untitled project');
    p.style = project().style;
    state.projects.unshift(p);
    state.currentId = p.id;
    save();
    renderAll();
    const li = $('#projectList li');
    if (li) startRename(li, p);
  });
  $('#projectName').addEventListener('input', (e) => {
    project().name = e.target.value;
    save();
    renderSidebar();
  });
  for (const [sel, key] of [['#styleSelect', 'style'], ['#fontSelect', 'font'], ['#sizeSelect', 'size']]) {
    $(sel).addEventListener('change', (e) => {
      project()[key] = e.target.value;
      save();
      key === 'style' ? renderRefs() : renderHead();
    });
  }
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // ---------- Export ----------
  function bibliographyHtml() {
    const p = project();
    const body = rendered.map((e) => e.html).join('\n');
    return `<h1 style="text-align:center;font-size:${p.size}pt;font-weight:bold">${esc(listHeading(p.style))}</h1>\n<div class="csl-bib-body">${body}</div>`;
  }
  function wordDoc() {
    const p = project();
    const css = `body{font-family:"${p.font}",serif;font-size:${p.size}pt}
      .csl-entry{margin:0 0 0 .5in;text-indent:-.5in;line-height:200%}
      .csl-left-margin{display:inline-block;min-width:.4in}
      .csl-right-inline{display:inline}`;
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(p.name)}</title><style>${css}</style></head><body>${bibliographyHtml()}</body></html>`;
  }

  $('#copyAll').addEventListener('click', () => {
    if (!rendered.length) return toast('Nothing to copy yet');
    copyRich(rendered.map((e) => e.html).join(''), rendered.map((e) => plainText(e.html)).join('\n\n'));
  });
  $('#downloadBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#moreMenu').hidden = true;
    $('#downloadMenu').hidden = !$('#downloadMenu').hidden;
  });
  document.addEventListener('click', () => {
    $('#downloadMenu').hidden = true;
    $('#moreMenu').hidden = true;
    if ($('#acctMenu')) $('#acctMenu').hidden = true;
  });
  $('#downloadMenu').addEventListener('click', async (e) => {
    const fmt = e.target.dataset.export;
    if (!fmt) return;
    if (!rendered.length) return toast('Add some sources first');
    const name = fileBase();
    try {
      if (fmt === 'doc') download(name + '.doc', wordDoc(), 'application/msword');
      else if (fmt === 'html') download(name + '.html', `<!doctype html><meta charset="utf-8"><title>${esc(project().name)}</title><body style="font-family:'${project().font}',serif;max-width:46em;margin:3em auto;line-height:2">${bibliographyHtml()}<style>.csl-entry{padding-left:2em;text-indent:-2em}</style>`, 'text/html');
      else if (fmt === 'txt') download(name + '.txt', rendered.map((x) => plainText(x.html)).join('\n\n') + '\n', 'text/plain');
      else {
        const items = project().items.filter((i) => !isPre(i));
        if (!items.length) return toast('Pre-formatted references can’t be exported to ' + fmt.toUpperCase());
        const text = BiblibFormat.exportAs(items.map((i) => i.csl), fmt);
        download(name + (fmt === 'bibtex' ? '.bib' : '.ris'), text, 'text/plain');
        if (items.length < project().items.length) toast('Pre-formatted references were left out of the ' + fmt.toUpperCase() + ' file');
      }
    } catch (err) {
      toast(err.message);
    }
  });

  // Share: the whole project travels in the URL fragment, so nothing is uploaded anywhere.
  const b64e = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
  $('#shareBtn').addEventListener('click', async () => {
    const p = project();
    const payload = b64e(JSON.stringify({ name: p.name, style: p.style, items: p.items.map(({ csl, note, source, pre }) => ({ csl, note, source, pre })) }));
    const url = `${location.origin}${location.pathname}#share=${payload}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Share link copied — anyone who opens it gets a copy of this project');
    } catch (e) {
      prompt('Copy this link:', url);
    }
  });
  function importShared() {
    const m = location.hash.match(/^#share=(.+)$/);
    if (!m) return;
    history.replaceState(null, '', location.pathname);
    try {
      const data = JSON.parse(b64d(m[1]));
      if (!confirm(`Import shared project "${data.name}" (${data.items.length} sources)?`)) return;
      const p = newProject(data.name || 'Shared project');
      p.style = data.style || 'apa';
      p.items = data.items.map((i) => {
        const item = { csl: { ...i.csl, id: uid() }, note: i.note || '', added: Date.now() };
        if (i.source && SOURCE[i.source]) item.source = i.source;
        if (i.pre) item.pre = sanitizeInline(i.pre);
        return item;
      });
      state.projects.unshift(p);
      state.currentId = p.id;
      save();
    } catch (e) {
      alert('That share link is damaged and could not be imported.');
    }
  }

  // ---------- Boot ----------
  (async () => {
    buildMoreMenu();
    const styles = BiblibFormat.styles;
    styleNames = Object.fromEntries(styles.map((s) => [s.id, s.label]));
    $('#styleSelect').innerHTML = styles.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
    try {
      if (await initCloud()) {
        const user = await cloud.currentUser();
        if (user) {
          account = user;
          await loadAccountState();
        }
      }
    } catch (e) {
      account = null;
      state = loadGuest();
      toast('Couldn’t load your account — showing projects saved in this browser');
    }
    if (!account) save(); // writes migrated projects under the new key
    renderAccount();
    importShared();
    renderAll();
  })();
})();
