import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const backend = read('src/app.js');
const customer = read('public/app.js');
const admin = read('public/admin.js');
const publicHtml = read('public/index.html');
const adminHtml = read('public/admin.html');

const routes = [
  ['get','/api/health'],['post','/api/auth/login'],['get','/api/shipments/:trackingNumber'],
  ['get','/api/shipments/:trackingNumber/stream'],['get','/api/admin/events'],['post','/api/quotes'],
  ['post','/api/contact'],['post','/api/admin/shipments'],['patch','/api/admin/shipments/:id/status'],
  ['get','/api/admin/quotes'],['patch','/api/admin/quotes/:id/status'],['get','/api/admin/messages'],
  ['patch','/api/admin/messages/:id/status'],['get','/api/admin/overview'],['get','/api/admin/shipments/:id'],
  ['patch','/api/admin/shipments/:id'],['get','/api/admin/shipments'],['get','/api/admin/reports'],['get','/api/admin/audit-logs']
];
for (const [method, route] of routes) {
  const marker = "app." + method + "('" + route + "'";
  if (!backend.includes(marker)) throw new Error("Missing backend route: " + method.toUpperCase() + " " + route);
}

for (const route of ['/api/shipments/','/api/quotes','/api/contact']) {
  if (!customer.includes(route)) throw new Error("Customer API contract missing: " + route);
}
for (const route of ['/api/auth/login','/api/admin/overview','/api/admin/shipments','/api/admin/quotes','/api/admin/messages','/api/admin/reports','/api/admin/audit-logs']) {
  if (!admin.includes(route)) throw new Error("Admin API contract missing: " + route);
}
const requiredFields = [
  'name','email','phoneCountry','phoneNumber','pickupAddress','pickupCity','pickupCountry',
  'deliveryAddress','deliveryCity','deliveryCountry','recipientName','packageType',
  'packageQuantity','packageContents','weightKg','lengthCm','widthCm','heightCm',
  'declaredValue','declaredCurrency','fragile','containsBatteries','specialInstructions'
];
for (const field of requiredFields) {
  if (!publicHtml.includes('name="' + field + '"')) throw new Error("Booking field missing: " + field);
}
for (const field of ['pickupAddress','pickupCity','pickupCountry','deliveryAddress','deliveryCity','deliveryCountry','recipientName','packageType','packageContents','specialInstructions']) {
  if (!backend.includes("text('" + field + "'")) throw new Error("Backend booking field missing: " + field);
}
for (const field of ['packageQuantity','weightKg','lengthCm','widthCm','heightCm','declaredValue']) {
  if (!backend.includes("b." + field)) throw new Error("Backend booking numeric field missing: " + field);
}
if (!backend.includes('serviceOrigin') || !backend.includes('allowedOrigins.has(normalized)')) throw new Error('Render same-origin CORS guard missing.');
if (!publicHtml.includes('href="https://starling-courier-service.onrender.com/admin.html"')) throw new Error('Public admin link missing.');
if (!adminHtml.includes('script src="admin.js"')) throw new Error('Admin script wiring missing.');

console.log("QA route/contract audit passed: " + routes.length + " backend routes and " + requiredFields.length + " booking fields checked.");
