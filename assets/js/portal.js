/* Demo admin + client portal.
   Works standalone with localStorage, but will automatically use the backend
   if /api/health is available (see server/server.js).
*/

const Portal = (() => {
  const KEY = 'cf_clients';

  // --- Backend auto-detection and API wrapper ---
  const Api = {
    available: false,
    adminToken: null,

    async init() {
      try {
        const r = await fetch('/api/health');
        this.available = r.ok;
        if (this.available && location.pathname.endsWith('admin.html')) {
          // demo admin login (email: admin@incorpx.local, password: admin)
          const lr = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@incorpx.local', password: 'admin' })
          });
          if (lr.ok) {
            const j = await lr.json();
            this.adminToken = j.token;
          } else {
            this.available = false; // fallback to local if login fails
          }
        }
      } catch {
        this.available = false;
      }
    },

    // Admin endpoints
    async listClients() {
      if (!this.available) return null;
      const r = await fetch('/api/admin/clients', {
        headers: { Authorization: `Bearer ${this.adminToken}` }
      });
      if (!r.ok) throw new Error('Failed to list');
      return r.json();
    },
    async createClient(d) {
      if (!this.available) return null;
      const r = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.adminToken}` },
        body: JSON.stringify({ name: d.name, email: d.email, password: d.pass, business: d.business, status: d.status })
      });
      if (!r.ok) throw new Error('Failed to create');
      return r.json();
    },
    async updateClient(id, patch) {
      if (!this.available) return null;
      const r = await fetch('/api/admin/clients/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.adminToken}` },
        body: JSON.stringify(patch)
      });
      if (!r.ok) throw new Error('Failed to update');
      return r.json();
    },
    async deleteClient(id) {
      if (!this.available) return null;
      const r = await fetch('/api/admin/clients/' + id, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.adminToken}` }
      });
      if (!r.ok) throw new Error('Failed to delete');
    },
    async uploadDoc(id, type, file) {
      if (!this.available) return null;
      const fd = new FormData();
      fd.append('type', type);
      fd.append('file', file);
      const r = await fetch(`/api/admin/clients/${id}/docs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.adminToken}` },
        body: fd
      });
      if (!r.ok) throw new Error('Upload failed');
      return r.json();
    },

    // Client endpoints
    async clientLogin(email, password) {
      if (!this.available) return null;
      const r = await fetch('/api/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!r.ok) return null;
      return r.json();
    },
    async clientPortal(id) {
      if (!this.available) return null;
      const r = await fetch('/api/client/portal?id=' + encodeURIComponent(id));
      if (!r.ok) return null;
      return r.json();
    },
    async createTicket(id, subject, body) {
      if (!this.available) return null;
      const r = await fetch(`/api/client/${id}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body })
      });
      return r.ok;
    }
  };

  // --- Local storage fallback helpers ---
  function uid() {
    return 'id-' + crypto.getRandomValues(new Uint32Array(2)).join('');
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
  function list() { return load(); }
  function create({ name, email, pass, business, status }) {
    const businessId = Math.floor(1e7 + Math.random()*9e7).toString();
    const c = { id: uid(), name, email, pass, business, status, businessId, docs: [], payments: [], tickets: [] };
    const all = load();
    all.push(c); save(all);
    return c;
  }
  function update(id, patch) {
    const all = load();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...patch };
    save(all);
    return all[idx];
  }
  function remove(id) { const all = load().filter(c => c.id !== id); save(all); }
  function findById(id) { return load().find(c => c.id === id); }
  function findByCred(email, pass) { return load().find(c => c.email === email && c.pass === pass); }

  async function fileToDataUrl(file) {
    if (!file) return null;
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(file);
    });
  }

  async function addDoc(clientId, type, file) {
    const dataUrl = await fileToDataUrl(file);
    const doc = { id: uid(), type, name: file?.name || type, dateISO: new Date().toISOString(), dataUrl };
    const c = findById(clientId);
    if (!c) return;
    c.docs.unshift(doc);
    update(clientId, { docs: c.docs });
    return doc;
  }
  function addPayment(clientId, p) {
    const c = findById(clientId); if (!c) return;
    c.payments.unshift({ id: uid(), dateISO: new Date().toISOString(), ...p });
    update(clientId, { payments: c.payments });
  }
  function addTicket(clientId, subject, body) {
    const c = findById(clientId); if (!c) return;
    c.tickets.unshift({ id: uid(), subject, body, dateISO: new Date().toISOString(), status: 'Open' });
    update(clientId, { tickets: c.tickets });
  }

  // Admin UI
  const Admin = {
    async init() {
      await Api.init();
      this.bindNav();
      this.refresh();
      document.getElementById('btnCreate').onclick = () => document.getElementById('createDialog').showModal();
      document.getElementById('createConfirm').onclick = async (e) => {
        e.preventDefault();
        const d = {
          name: document.getElementById('cName').value.trim(),
          email: document.getElementById('cEmail').value.trim(),
          pass: document.getElementById('cPass').value,
          business: document.getElementById('cBiz').value.trim(),
          status: document.getElementById('cStatus').value
        };
        if (!d.name || !d.email || !d.pass || !d.business) return;

        if (Api.available) {
          await Api.createClient(d);
        } else {
          const c = create(d);
          addPayment(c.id,{ description:'Company formation fee', amount: 399, status:'Paid' });
        }
        document.getElementById('createDialog').close();
        this.refresh();
      };

      document.getElementById('btnAttach').onclick = async () => {
        const clientId = document.getElementById('docClient').value;
        const type = document.getElementById('docType').value || 'Document';
        const file = document.getElementById('docFile').files[0];
        const out = document.getElementById('docStatus');
        out.textContent = 'Uploading...';
        if (Api.available) {
          await Api.uploadDoc(clientId, type, file);
        } else {
          await addDoc(clientId, type, file);
        }
        out.textContent = 'Uploaded.';
        this.refresh();
      };

      document.getElementById('btnExport').onclick = async () => {
        const data = Api.available ? await Api.listClients() : list();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'incorpx-data.json';
        a.click();
      };
      document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
      document.getElementById('importFile').onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const text = await file.text();
        if (Api.available) {
          alert('Import is not implemented for server mode yet.');
        } else {
          localStorage.setItem(KEY, text);
          this.refresh();
        }
      };
      document.getElementById('btnWipe').onclick = async () => {
        if (!confirm('Delete all demo data?')) return;
        if (Api.available) {
          const cs = await Api.listClients();
          for (const c of cs) { await Api.deleteClient(c.id); }
        } else {
          localStorage.removeItem(KEY);
        }
        this.refresh();
      };
    },

    bindNav() {
      document.querySelectorAll('.side-link').forEach(btn => {
        if (!btn.dataset.panel) return;
        btn.onclick = () => {
          document.querySelectorAll('.side-link').forEach(b=>b.classList.remove('active'));
          document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('panel-'+btn.dataset.panel).classList.add('active');
        };
      });
    },

    async refresh() {
      const tbody = document.querySelector('#clientsTable tbody');
      tbody.innerHTML = '';
      const clients = Api.available ? await Api.listClients() : list();

      // doc client select
      const sel = document.getElementById('docClient');
      sel.innerHTML = '';
      (clients || []).forEach(c => {
        sel.appendChild(new Option(`${c.name} • ${c.business}`, c.id));
      });

      (clients || []).forEach(c => {
        const tr = document.createElement('tr');
        const url = new URL(location.origin + location.pathname.replace('admin.html','client.html'));
        url.searchParams.set('id', c.id);

        tr.innerHTML = `
          <td>${c.name}</td>
          <td>${c.email}</td>
          <td>${c.business}</td>
          <td>${c.status}</td>
          <td><a href="${url.toString()}" target="_blank">Open</a></td>
          <td>
            <button data-act="status" data-id="${c.id}" class="secondary">Toggle</button>
            <button data-act="reset" data-id="${c.id}" class="secondary">Reset password</button>
            <button data-act="del" data-id="${c.id}" class="danger">Delete</button>
          </td>`;
        tbody.appendChild(tr);
      });

      tbody.onclick = async (e) => {
        const id = e.target.dataset.id;
        const act = e.target.dataset.act;
        if (!id || !act) return;
        if (act === 'status') {
          if (Api.available) {
            const all = Api.available ? await Api.listClients() : list();
            const c = (all || []).find(x=>x.id===id);
            const next = c && c.status === 'Active' ? 'On Hold' : 'Active';
            await Api.updateClient(id, { status: next });
          } else {
            const c = findById(id);
            const next = c.status === 'Active' ? 'On Hold' : 'Active';
            update(id, { status: next });
          }
          this.refresh();
        } else if (act === 'reset') {
          const pass = prompt('New password for user:');
          if (pass) {
            if (Api.available) await Api.updateClient(id, { password: pass });
            else update(id, { pass });
            alert('Password updated.');
          }
        } else if (act === 'del') {
          if (confirm('Delete this client?')) {
            if (Api.available) await Api.deleteClient(id);
            else remove(id);
            this.refresh();
          }
        }
      };
    }
  };

  // Client UI
  const Client = {
    async init() {
      await Api.init();
      this.bindTabs();

      const params = new URLSearchParams(location.search);
      const id = params.get('id');
      let client = null;

      if (Api.available && id) {
        client = await Api.clientPortal(id);
      } else if (id) {
        client = findById(id);
      }

      // simple session
      const sid = sessionStorage.getItem('client_id');
      if (!client && sid) {
        client = Api.available ? await Api.clientPortal(sid) : findById(sid);
      }

      if (!client) {
        this.showLogin();
      } else {
        this.mount(client);
      }

      document.getElementById('btnLogout').onclick = () => { sessionStorage.removeItem('client_id'); location.href = 'client.html'; };
    },

    showLogin() {
      this.toggleAuth(true);
      const form = document.getElementById('loginForm');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value;

        if (Api.available) {
          const r = await Api.clientLogin(email, pass);
          if (!r) { alert('Invalid credentials'); return; }
          sessionStorage.setItem('client_id', r.id);
          const c = await Api.clientPortal(r.id);
          this.mount(c);
        } else {
          const c = findByCred(email, pass);
          if (!c) { alert('Invalid credentials'); return; }
          sessionStorage.setItem('client_id', c.id);
          this.mount(c);
        }
      };
    },

    mount(client) {
      this.toggleAuth(false);
      this.client = client;
      document.getElementById('greeting').textContent = `Hello, ${client.name}`;
      document.getElementById('infoBiz').textContent = client.business;
      document.getElementById('infoBizId').textContent = client.businessId;
      document.getElementById('infoStatus').textContent = client.status;
      document.getElementById('infoStatus').className = 'badge ' + (client.status === 'Active' ? 'success' : '');

      // payments
      const pt = document.querySelector('#paymentsTable tbody');
      pt.innerHTML = '';
      (client.payments || []).forEach(p=>{
        const tr = document.createElement('tr');
        const d = new Date(p.dateISO).toLocaleDateString();
        tr.innerHTML = `<td>${d}</td><td>${p.description}</td><td>${p.amount}</td><td>${p.status}</td>`;
        pt.appendChild(tr);
      });

      // docs
      const dt = document.querySelector('#docsTable tbody');
      dt.innerHTML = '';
      (client.docs || []).forEach(doc=>{
        const tr = document.createElement('tr');
        const d = new Date(doc.dateISO).toLocaleDateString();
        const a = document.createElement('a');
        a.textContent = 'Download';
        a.href = doc.url || doc.dataUrl;
        a.download = (doc.name || 'document');
        a.className = 'secondary';
        const tdAction = document.createElement('td'); tdAction.appendChild(a);
        tr.innerHTML = `<td>${doc.type}</td><td>${d}</td>`;
        tr.appendChild(tdAction);
        dt.appendChild(tr);
      });

      // profile
      document.getElementById('pName').value = client.name;
      document.getElementById('pEmail').value = client.email;
      document.getElementById('pPass').value = client.pass || '';

      document.getElementById('profileForm').onsubmit = async (e)=>{
        e.preventDefault();
        const patch = {
          name: document.getElementById('pName').value.trim(),
          email: document.getElementById('pEmail').value.trim(),
          pass: document.getElementById('pPass').value
        };
        if (Api.available) {
          await Api.updateClient(client.id, { name: patch.name, email: patch.email, password: patch.pass });
        } else {
          update(client.id, patch);
        }
        alert('Saved');
      };

      document.getElementById('ticketForm').onsubmit = async (e)=>{
        e.preventDefault();
        const s = document.getElementById('ticketSubject').value.trim();
        const b = document.getElementById('ticketBody').value.trim();
        if (!s || !b) return;
        if (Api.available) await Api.createTicket(client.id, s, b);
        else addTicket(client.id, s, b);
        document.getElementById('ticketStatus').textContent = 'Ticket created. We will reply by email.';
        e.target.reset();
      };
    },

    toggleAuth(needsLogin) {
      document.body.classList.toggle('is-auth', !needsLogin);
      document.getElementById('login').classList.toggle('active', needsLogin);
      document.querySelectorAll('main > .panel:not(#login)').forEach(p => p.classList.toggle('active', !needsLogin && p.id === 'tab-dashboard'));
    },

    bindTabs() {
      document.querySelectorAll('.side-link').forEach(btn => {
        if (!btn.dataset.tab) return;
        btn.onclick = () => {
          document.querySelectorAll('.side-link').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('main .panel').forEach(p=>p.classList.remove('active'));
          document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
        };
      });
    }
  };

  return { Admin, Client, data: { list, create, update, remove, findById } };
})();