import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { DB } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static serving of uploaded files
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/files', express.static(uploadDir));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Admin auth (simple demo)
function sign(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' }); }
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }
}

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email === 'admin@incorpx.local' && password === 'admin') {
    return res.json({ token: sign({ role: 'admin' }) });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Clients CRUD
app.get('/api/admin/clients', auth, (req, res) => {
  res.json(DB.listClients());
});

app.post('/api/admin/clients', auth, (req, res) => {
  const { name, email, password, business, status = 'Active' } = req.body || {};
  if (!name || !email || !password || !business) return res.status(400).json({ error: 'Missing fields' });
  const passHash = bcrypt.hashSync(password, 8);
  const c = DB.createClient({ name, email, passHash, business, status });
  res.status(201).json(c);
});

app.patch('/api/admin/clients/:id', auth, (req, res) => {
  const { id } = req.params;
  const patch = { ...req.body };
  if (patch.password) {
    patch.passwordHash = bcrypt.hashSync(patch.password, 8);
    delete patch.password;
  }
  const c = DB.updateClient(id, patch);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.delete('/api/admin/clients/:id', auth, (req, res) => {
  DB.removeClient(req.params.id);
  res.json({ ok: true });
});

// Upload document
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, nanoid() + '-' + file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({ storage });

app.post('/api/admin/clients/:id/docs', auth, upload.single('file'), (req, res) => {
  const { id } = req.params;
  const type = req.body.type || 'Document';
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const doc = {
    id: nanoid(),
    type,
    name: req.file.originalname,
    path: req.file.filename,
    url: '/files/' + req.file.filename,
    dateISO: new Date().toISOString()
  };
  DB.addDoc(id, doc);
  res.status(201).json(doc);
});

// Client endpoints
app.post('/api/client/login', (req, res) => {
  const { email, password } = req.body || {};
  const clients = DB.listClients();
  const c = clients.find(x => x.email === email && bcrypt.compareSync(password, x.passwordHash || ''));
  if (!c) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: sign({ role: 'client', id: c.id }), id: c.id });_code
}new)</;
;

app.get('/api/client/portal', (req, res) => {
  const { id } = req.query;
  const c = DB.getClient(id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.post('/api/client/:id/tickets', (req, res) => {
  const { id } = req.params;
  const { subject, body } = req.body || {};
  if (!subject || !body) return res.status(400).json({ error: 'Missing' });
  const ticket = { id: nanoid(), subject, body, dateISO: new Date().toISOString(), status: 'Open' };
  DB.addTicket(id, ticket);
  res.status(201).json(ticket);
});

// Serve the static site when running the server locally
const siteRoot = path.join(__dirname, '..');
app.use(express.static(siteRoot));

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});