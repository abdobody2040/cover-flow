import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, JSON.stringify({ clients: [], admin: { email: 'admin@incorpx.local', passwordHash: null } }, null, 2));
}

function read() {
  return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
}

function write(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

export const DB = {
  listClients() {
    return read().clients;
  },
  getClient(id) {
    return read().clients.find(c => c.id === id);
  },
  findClientByCred(email, passHash) {
    return read().clients.find(c => c.email === email && c.passwordHash === passHash);
  },
  createClient({ name, email, passHash, business, status }) {
    const businessId = (Math.floor(1e7 + Math.random()*9e7)).toString();
    const client = {
      id: nanoid(),
      name, email, passwordHash: passHash,
      business, status,
      businessId,
      docs: [],
      payments: [{ id: nanoid(), dateISO: new Date().toISOString(), description: 'Company formation fee', amount: 399, status: 'Paid' }],
      tickets: []
    };
    const data = read();
    data.clients.push(client);
    write(data);
    return client;
  },
  updateClient(id, patch) {
    const data = read();
    const i = data.clients.findIndex(c => c.id === id);
    if (i === -1) return null;
    data.clients[i] = { ...data.clients[i], ...patch };
    write(data);
    return data.clients[i];
  },
  removeClient(id) {
    const data = read();
    data.clients = data.clients.filter(c => c.id !== id);
    write(data);
  },
  addDoc(clientId, doc) {
    const data = read();
    const c = data.clients.find(x => x.id === clientId);
    if (!c) return null;
    c.docs.unshift(doc);
    write(data);
    return doc;
  },
  addTicket(clientId, ticket) {
    const data = read();
    const c = data.clients.find(x => x.id === clientId);
    if (!c) return null;
    c.tickets.unshift(ticket);
    write(data);
    return ticket;
  }
};