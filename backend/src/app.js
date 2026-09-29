import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import { query, withTransaction } from './db.js';
import { verifyPassword, signToken, requireAuth } from './auth.js';
import { rateLimit } from './security.js';
import { sendTransactional, shipmentStatusEmail } from './email.js';

const app = express();
app.set('trust proxy', 1);
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir, { extensions: ['html'] }));

const sseClients = new Set();
const sseWrite = (res, event, payload) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
};
const broadcast = (event, payload) => {
  for (const client of sseClients) {
    const allowed = client.scope === 'admin' || (client.scope === 'shipment' && payload?.trackingNumber === client.trackingNumber);
    if (!allowed) continue;
    try { sseWrite(client.res, event, payload); } catch { sseClients.delete(client); }
  }
};
const heartbeat = setInterval(() => {
  for (const client of sseClients) {
    try { client.res.write(': heartbeat\n\n'); } catch { sseClients.delete(client); }
  }
}, 25000);
heartbeat.unref?.();

const publicWriteLimit = rateLimit({ windowMs: 15 * 60_000, max: 30 });
const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 8, key: req => `login:${req.ip || 'unknown'}` });

const clean = (value, max = 5000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emailOk = value => /^\S+@\S+\.\S+$/.test(value);
const uuidOk = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const weightOk = value => value == null || value === '' || (Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 100000);

app.get('/api/health', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ ok: true, service: 'Starling-courier-api', database: 'connected' }); }
  catch { res.status(503).json({ ok: false, service: 'Starling-courier-api', database: 'unavailable' }); }
});

app.post('/api/auth/login', loginLimit, async (req, res) => {
  const email = clean(req.body?.email, 320).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!emailOk(email) || !password) return res.status(400).json({ error: 'Valid email and password are required.' });
  const { rows } = await query('SELECT id, email, password_hash, role, active FROM admin_users WHERE LOWER(email) = $1 LIMIT 1', [email]);
  const user = rows[0];
  if (!user || !user.active || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials.' });
  res.json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role } });
});

app.get('/api/shipments/:trackingNumber', async (req, res) => {
  const trackingNumber = clean(req.params.trackingNumber, 40).toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(trackingNumber)) return res.status(400).json({ error: 'Invalid tracking number.' });
  const { rows } = await query(`
    SELECT s.id, s.tracking_number, s.origin_city, s.origin_country,
      s.destination_city, s.destination_country, s.status, s.service_type, s.estimated_delivery_at,
      s.created_at, s.updated_at,
      COALESCE(json_agg(json_build_object('status', e.status, 'location', e.location, 'note', e.note, 'occurredAt', e.occurred_at) ORDER BY e.occurred_at ASC) FILTER (WHERE e.id IS NOT NULL), '[]'::json) AS events
    FROM shipments s LEFT JOIN shipment_events e ON e.shipment_id = s.id
    WHERE s.tracking_number = $1 GROUP BY s.id`, [trackingNumber]);
  if (!rows[0]) return res.status(404).json({ error: 'Shipment not found.' });
  res.json({ shipment: rows[0] });
});

app.get('/api/shipments/:trackingNumber/stream', async (req, res) => {
  const trackingNumber = clean(req.params.trackingNumber, 40).toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(trackingNumber)) return res.status(400).json({ error: 'Invalid tracking number.' });
  const exists = await query('SELECT 1 FROM shipments WHERE tracking_number = $1 LIMIT 1', [trackingNumber]);
  if (!exists.rows[0]) return res.status(404).json({ error: 'Shipment not found.' });
  res.status(200);
  res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
  res.flushHeaders?.();
  const client = { res, trackingNumber, scope: 'shipment' };
  sseClients.add(client);
  sseWrite(res, 'connected', { trackingNumber });
  req.on('close', () => sseClients.delete(client));
});

app.get('/api/admin/events', async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    // Reuse the same JWT verifier used by protected REST routes.
    const { verifyToken } = await import('./auth.js');
    const auth = verifyToken(token);
    if (!auth?.sub) return res.status(401).json({ error: 'Invalid authentication.' });
    res.status(200);
    res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
    res.flushHeaders?.();
    const client = { res, scope: 'admin', adminId: auth.sub };
    sseClients.add(client);
    sseWrite(res, 'connected', { scope: 'admin' });
    req.on('close', () => sseClients.delete(client));
  } catch (e) { next(e); }
});

app.post('/api/quotes', publicWriteLimit, async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 160), email = clean(b.email, 320).toLowerCase();
  const origin = clean(b.origin, 180), destination = clean(b.destination, 180), serviceType = clean(b.serviceType, 80);
  const phone = clean(b.phone, 40), packageDescription = clean(b.packageDescription, 3000);
  const weightKg = b.weightKg == null || b.weightKg === '' ? null : Number(b.weightKg);
  if (!name || !email || !origin || !destination || !serviceType) return res.status(400).json({ error: 'Name, email, origin, destination and service type are required.' });
  if (!emailOk(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100000)) return res.status(400).json({ error: 'Weight must be a positive number.' });
  const { rows } = await query(`INSERT INTO quote_requests (name,email,phone,origin,destination,service_type,package_description,weight_kg) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,created_at`, [name,email,phone||null,origin,destination,serviceType,packageDescription||null,weightKg]);
  if (process.env.NOTIFICATION_EMAIL) {
    await sendTransactional({
      eventKey: `quote:${rows[0].id}:admin`, to: process.env.NOTIFICATION_EMAIL, type: 'quote.received',
      subject: `New quote request from ${name}`,
      text: `New quote request from ${name} (${email}). ${origin} to ${destination}. Service: ${serviceType}.`,
      html: `<div style=\"font-family:Arial,sans-serif;line-height:1.6\"><h2>New quote request</h2><p><strong>${clean(name,160)}</strong> (${clean(email,320)})</p><p>${clean(origin,180)} → ${clean(destination,180)}</p><p>Service: ${clean(serviceType,80)}</p></div>`
    });
  }
  broadcast('quote.created', { id: rows[0].id, createdAt: rows[0].created_at });
  res.status(201).json({ quoteRequest: rows[0] });
});

app.post('/api/contact', publicWriteLimit, async (req, res) => {
  const b=req.body||{}; const name=clean(b.name,160), email=clean(b.email,320).toLowerCase(), phone=clean(b.phone,40), message=clean(b.message,5000);
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required.' });
  if (!emailOk(email)) return res.status(400).json({ error: 'Invalid email address.' });
  const { rows }=await query('INSERT INTO contact_messages (name,email,phone,message) VALUES ($1,$2,$3,$4) RETURNING id,status,created_at',[name,email,phone||null,message]);
  if (process.env.NOTIFICATION_EMAIL) {
    await sendTransactional({
      eventKey: `contact:${rows[0].id}:admin`, to: process.env.NOTIFICATION_EMAIL, type: 'contact.received',
      subject: `New contact message from ${name}`,
      text: `New contact message from ${name} (${email}).\n\n${message}`,
      html: `<div style=\"font-family:Arial,sans-serif;line-height:1.6\"><h2>New contact message</h2><p><strong>${clean(name,160)}</strong> (${clean(email,320)})</p><p>${clean(message,5000)}</p></div>`
    });
  }
  broadcast('message.created', { id: rows[0].id, createdAt: rows[0].created_at });
  res.status(201).json({ message: rows[0] });
});

app.post('/api/admin/shipments', requireAuth, async (req,res) => {
  const b=req.body||{};
  const required=['trackingNumber','originCity','originCountry','destinationCity','destinationCountry'];
  if(required.some(k=>!clean(b[k],180))) return res.status(400).json({error:'trackingNumber, originCity, originCountry, destinationCity and destinationCountry are required.'});
  if(!weightOk(b.weightKg)) return res.status(400).json({error:'Weight must be a positive number.'});
  const trackingNumber=clean(b.trackingNumber,40).toUpperCase();
  if(!/^[A-Z0-9-]{4,40}$/.test(trackingNumber)) return res.status(400).json({error:'Invalid tracking number.'});
  try {
    const result=await withTransaction(async client=>{
      const {rows}=await client.query(`INSERT INTO shipments (tracking_number,origin_city,origin_country,destination_city,destination_country,estimated_delivery_at,recipient_name,recipient_phone,recipient_email,package_description,weight_kg,service_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[trackingNumber,clean(b.originCity,120),clean(b.originCountry,120),clean(b.destinationCity,120),clean(b.destinationCountry,120),b.estimatedDeliveryAt||null,clean(b.recipientName,160)||null,clean(b.recipientPhone,40)||null,clean(b.recipientEmail,320).toLowerCase()||null,clean(b.packageDescription,3000)||null,b.weightKg==null?null:Number(b.weightKg),clean(b.serviceType,80)||null]);
      await client.query(`INSERT INTO shipment_events (shipment_id,status,location,note) VALUES ($1,'created',$2,$3)`,[rows[0].id,clean(b.originCity,120),clean(b.initialNote,1000)||'Shipment created']);
      await client.query(`INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'shipment.created','shipment',$2,$3)`,[req.auth.sub,rows[0].id,JSON.stringify({trackingNumber})]);
      return rows[0];
    });
    broadcast('shipment.created', { id: result.id, trackingNumber: result.tracking_number, status: result.status });
    res.status(201).json({shipment:result});
  } catch(e) { if(e.code==='23505') return res.status(409).json({error:'Tracking number already exists.'}); throw e; }
});

app.patch('/api/admin/shipments/:id/status', requireAuth, async (req,res) => {
  if(!uuidOk(req.params.id)) return res.status(400).json({error:'Invalid shipment ID.'});
  const status=clean(req.body?.status,30); const location=clean(req.body?.location,180); const note=clean(req.body?.note,1000);
  const allowed=['created','picked_up','in_transit','out_for_delivery','delivered','cancelled'];
  if(!allowed.includes(status)) return res.status(400).json({error:'Invalid shipment status.'});
  const result=await withTransaction(async client=>{
    const {rows}=await client.query('UPDATE shipments SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[status,req.params.id]);
    if(!rows[0]) return null;
    await client.query('INSERT INTO shipment_events (shipment_id,status,location,note) VALUES ($1,$2,$3,$4)',[req.params.id,status,location||null,note||null]);
    await client.query(`INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'shipment.status_updated','shipment',$2,$3)`,[req.auth.sub,req.params.id,JSON.stringify({status,location})]);
    return rows[0];
  });
  if(!result) return res.status(404).json({error:'Shipment not found.'});
  if (result.recipient_email) {
    const email = shipmentStatusEmail({ trackingNumber: result.tracking_number, recipientName: result.recipient_name, status, location, note });
    await sendTransactional({ eventKey: `shipment:${result.id}:status:${result.updated_at.toISOString()}`, to: result.recipient_email, type: `shipment.${status}`, subject: email.subject, html: email.html, text: email.text });
  }
  broadcast('shipment.updated', { id: result.id, trackingNumber: result.tracking_number, status: result.status, location, note, updatedAt: result.updated_at });
  res.json({shipment:result});
});

app.get('/api/admin/quotes', requireAuth, async (req,res)=>{
  const status=clean(req.query.status,30);
  const limit=Math.min(Math.max(Number(req.query.limit)||25,1),100);
  const params=[];
  let where='';
  if(status){ params.push(status); where='WHERE status=$1'; }
  params.push(limit);
  const {rows}=await query(`SELECT * FROM quote_requests ${where} ORDER BY created_at DESC LIMIT $${params.length}` ,params);
  res.json({quotes:rows});
});

app.patch('/api/admin/quotes/:id/status', requireAuth, async (req,res)=>{
  const status=clean(req.body?.status,30);
  if(!['new','reviewing','quoted','closed'].includes(status)) return res.status(400).json({error:'Invalid quote status.'});
  if(!uuidOk(req.params.id)) return res.status(400).json({error:'Invalid quote request ID.'});
  const {rows}=await query('UPDATE quote_requests SET status=$1 WHERE id=$2 RETURNING *',[status,req.params.id]);
  if(!rows[0]) return res.status(404).json({error:'Quote request not found.'});
  await query(`INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'quote.status_updated','quote_request',$2,$3)`,[req.auth.sub,req.params.id,JSON.stringify({status})]);
  res.json({quote:rows[0]});
});

app.get('/api/admin/messages', requireAuth, async (req,res)=>{
  const status=clean(req.query.status,30);
  const limit=Math.min(Math.max(Number(req.query.limit)||25,1),100);
  const params=[]; let where='';
  if(status){ params.push(status); where='WHERE status=$1'; }
  params.push(limit);
  const {rows}=await query(`SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT $${params.length}`,params);
  res.json({messages:rows});
});

app.patch('/api/admin/messages/:id/status', requireAuth, async (req,res)=>{
  const status=clean(req.body?.status,30);
  if(!['new','read','closed'].includes(status)) return res.status(400).json({error:'Invalid message status.'});
  if(!uuidOk(req.params.id)) return res.status(400).json({error:'Invalid message ID.'});
  const {rows}=await query('UPDATE contact_messages SET status=$1 WHERE id=$2 RETURNING *',[status,req.params.id]);
  if(!rows[0]) return res.status(404).json({error:'Message not found.'});
  await query(`INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'contact.status_updated','contact_message',$2,$3)`,[req.auth.sub,req.params.id,JSON.stringify({status})]);
  res.json({message:rows[0]});
});

app.get('/api/admin/overview', requireAuth, async (_req,res)=>{
  const [shipments, quotes, messages] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='created')::int AS created,
      COUNT(*) FILTER (WHERE status='picked_up')::int AS picked_up,
      COUNT(*) FILTER (WHERE status='in_transit')::int AS in_transit,
      COUNT(*) FILTER (WHERE status='out_for_delivery')::int AS out_for_delivery,
      COUNT(*) FILTER (WHERE status='delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
      FROM shipments`),
    query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='new')::int AS new,
      COUNT(*) FILTER (WHERE status='reviewing')::int AS reviewing,
      COUNT(*) FILTER (WHERE status='quoted')::int AS quoted,
      COUNT(*) FILTER (WHERE status='closed')::int AS closed FROM quote_requests`),
    query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='new')::int AS new,
      COUNT(*) FILTER (WHERE status='read')::int AS read, COUNT(*) FILTER (WHERE status='closed')::int AS closed FROM contact_messages`)
  ]);
  res.json({ shipments: shipments.rows[0], quotes: quotes.rows[0], messages: messages.rows[0] });
});

app.get('/api/admin/shipments/:id', requireAuth, async (req,res)=>{
  if(!uuidOk(req.params.id)) return res.status(400).json({error:'Invalid shipment ID.'});
  const {rows}=await query(`SELECT s.*,
    COALESCE(json_agg(json_build_object('id',e.id,'status',e.status,'location',e.location,'note',e.note,'occurredAt',e.occurred_at) ORDER BY e.occurred_at ASC) FILTER (WHERE e.id IS NOT NULL), '[]'::json) AS events
    FROM shipments s LEFT JOIN shipment_events e ON e.shipment_id=s.id WHERE s.id=$1 GROUP BY s.id`,[req.params.id]);
  if(!rows[0]) return res.status(404).json({error:'Shipment not found.'});
  res.json({shipment:rows[0]});
});

app.patch('/api/admin/shipments/:id', requireAuth, async (req,res)=>{
  if(!uuidOk(req.params.id)) return res.status(400).json({error:'Invalid shipment ID.'});
  const b=req.body||{};
  if(!weightOk(b.weightKg)) return res.status(400).json({error:'Weight must be a positive number.'});
  const trackingNumber=clean(b.trackingNumber,40).toUpperCase();
  if(!trackingNumber || !/^[A-Z0-9-]{4,40}$/.test(trackingNumber)) return res.status(400).json({error:'Invalid tracking number.'});
  const recipientEmail=clean(b.recipientEmail,320).toLowerCase();
  if(recipientEmail && !emailOk(recipientEmail)) return res.status(400).json({error:'Invalid recipient email.'});
  try {
    const {rows}=await query(`UPDATE shipments SET
      tracking_number=$1, origin_city=$2, origin_country=$3, destination_city=$4, destination_country=$5,
      estimated_delivery_at=$6, recipient_name=$7, recipient_phone=$8, recipient_email=$9, package_description=$10,
      weight_kg=$11, service_type=$12, updated_at=NOW() WHERE id=$13 RETURNING *`, [
      trackingNumber, clean(b.originCity,120), clean(b.originCountry,120), clean(b.destinationCity,120), clean(b.destinationCountry,120),
      b.estimatedDeliveryAt||null, clean(b.recipientName,160)||null, clean(b.recipientPhone,40)||null, recipientEmail||null,
      clean(b.packageDescription,3000)||null, b.weightKg==null||b.weightKg===''?null:Number(b.weightKg), clean(b.serviceType,80)||null, req.params.id
    ]);
    if(!rows[0]) return res.status(404).json({error:'Shipment not found.'});
    await query(`INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'shipment.updated','shipment',$2,$3)`,[req.auth.sub,req.params.id,JSON.stringify({trackingNumber})]);
    broadcast('shipment.updated', { id: rows[0].id, trackingNumber: rows[0].tracking_number, status: rows[0].status, updatedAt: rows[0].updated_at });
    res.json({shipment:rows[0]});
  } catch(e) { if(e.code==='23505') return res.status(409).json({error:'Tracking number already exists.'}); throw e; }
});

app.get('/api/admin/shipments', requireAuth, async (req,res)=>{
  const limit=Math.min(Math.max(Number(req.query.limit)||25,1),100);
  const offset=Math.max(Number(req.query.offset)||0,0);
  const status=clean(req.query.status,30);
  const search=clean(req.query.search,120);
  const params=[]; const where=[];
  if(status){ params.push(status); where.push(`s.status=$${params.length}`); }
  if(search){
    params.push(`%${search.toLowerCase()}%`);
    const n=params.length;
    where.push(`(LOWER(s.tracking_number) LIKE $${n} OR LOWER(s.origin_city) LIKE $${n} OR LOWER(s.destination_city) LIKE $${n} OR LOWER(COALESCE(s.recipient_name,'')) LIKE $${n})`);
  }
  const whereSql=where.length?`WHERE ${where.join(' AND ')}`:'';
  const count=await query(`SELECT COUNT(*)::int AS total FROM shipments s ${whereSql}`,params);
  const pageParams=[...params,limit,offset];
  const {rows}=await query(`SELECT s.* FROM shipments s ${whereSql} ORDER BY s.created_at DESC LIMIT $${pageParams.length-1} OFFSET $${pageParams.length}`,pageParams);
  res.json({shipments:rows,total:count.rows[0].total,limit,offset});
});

app.get('/api/admin/audit-logs', requireAuth, async (req,res)=>{
  const limit=Math.min(Math.max(Number(req.query.limit)||30,1),100);
  const {rows}=await query(`SELECT a.*, u.email AS admin_email FROM audit_logs a LEFT JOIN admin_users u ON u.id=a.admin_user_id ORDER BY a.created_at DESC LIMIT $1`,[limit]);
  res.json({logs:rows});
});

app.use((err,_req,res,_next)=>{ console.error(err); res.status(500).json({error:'Internal server error.'}); });
export default app;
