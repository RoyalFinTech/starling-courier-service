const API = (window.STARLING_API_BASE || (location.hostname.endsWith('.github.io') ? 'https://starling-courier-service.onrender.com' : location.origin)).replace(/\/+$/, '');
const tokenKey = 'starling_admin_token';
const userKey = 'starling_admin_user';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = v => v ? new Date(v).toLocaleString() : '—';
const prettyStatus = s => String(s || '').replaceAll('_',' ');
let shipmentPage = 0;
const pageSize = 20;
let totalShipments = 0;

async function api(path,opt={}) {
  const headers = {...(opt.headers||{}), Authorization:`Bearer ${sessionStorage.getItem(tokenKey)}`};
  if (opt.body && !headers['Content-Type']) headers['Content-Type']='application/json';
  const r = await fetch(API+path,{...opt,headers});
  const d = await r.json().catch(()=>({}));
  if (r.status===401) { sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(userKey); location.reload(); throw Error('Session expired.'); }
  if (!r.ok) throw Error(d.error||'Request failed');
  return d;
}
function setMsg(el,text,kind=''){ el.className='message '+kind; el.textContent=text||''; }
function showApp(){
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  const user=JSON.parse(sessionStorage.getItem(userKey)||'null'); $('#adminEmail').textContent=user?.email||'';
  loadAll();
}
$('#loginForm').onsubmit=async e=>{e.preventDefault();setMsg($('#loginMsg'),'');try{const r=await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#email').value,password:$('#password').value})});const d=await r.json();if(!r.ok)throw Error(d.error||'Sign in failed');sessionStorage.setItem(tokenKey,d.token);sessionStorage.setItem(userKey,JSON.stringify(d.user));showApp();}catch(err){setMsg($('#loginMsg'),err.message,'error')}};
$('#logout').onclick=()=>{sessionStorage.removeItem(tokenKey);sessionStorage.removeItem(userKey);location.reload()};
$('#refreshAll').onclick=loadAll;

$('#shipmentForm').onsubmit=async e=>{e.preventDefault();setMsg($('#shipmentMsg'),'');const b=Object.fromEntries(new FormData(e.target));try{const d=await api('/api/admin/shipments',{method:'POST',body:JSON.stringify(b)});setMsg($('#shipmentMsg'),`Created ${d.shipment.tracking_number}`,'success');e.target.reset();shipmentPage=0;await loadAll();}catch(err){setMsg($('#shipmentMsg'),err.message,'error')}};
$('#statusForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));if(!b.id)return;delete b.id;setMsg($('#statusMsg'),'');try{const d=await api('/api/admin/shipments/'+encodeURIComponent($('#statusShipmentId').value)+'/status',{method:'PATCH',body:JSON.stringify(b)});setMsg($('#statusMsg'),`Updated ${d.shipment.tracking_number}`,'success');await loadAll();}catch(err){setMsg($('#statusMsg'),err.message,'error')}};

async function loadOverview(){const d=await api('/api/admin/overview');const s=d.shipments,q=d.quotes,m=d.messages;$('#stTotal').textContent=s.total;$('#stTransit').textContent=s.in_transit;$('#stOFD').textContent=s.out_for_delivery;$('#stDelivered').textContent=s.delivered;$('#stQuotes').textContent=q.new;$('#stMessages').textContent=m.new;}
async function loadReports(){
  const d=await api('/api/admin/reports');
  $('#reportGenerated').textContent='Generated '+fmt(d.generatedAt);
  const labels=['created','picked_up','in_transit','out_for_delivery','delivered','cancelled'];
  const names={created:'Created',picked_up:'Picked up',in_transit:'In transit',out_for_delivery:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'};
  const colors=['#175cd3','#12b76a','#f79009','#7a5af8','#2e90fa','#b42318'];
  const values=Object.fromEntries((d.shipmentStatus||[]).map(x=>[x.status,Number(x.count)]));
  const total=labels.reduce((n,k)=>n+(values[k]||0),0); let cursor=0; const segments=[];
  labels.forEach((k,i)=>{const pct=total?(values[k]||0)/total*100:0;segments.push(colors[i]+' '+cursor+'% '+(cursor+pct)+'%');cursor+=pct;});
  $('#statusPie').style.background=total?'conic-gradient('+segments.join(',')+')':'#e8eef7';
  $('#statusLegend').innerHTML=labels.map((k,i)=>{const v=values[k]||0;const pct=total?(v/total*100).toFixed(1):'0.0';return '<div class="legend-row"><span><span class="dot" style="background:'+colors[i]+'"></span>'+names[k]+'</span><strong>'+v+' ('+pct+'%)</strong></div>';}).join('');
  const days=d.dailyActivity||[]; const max=Math.max(1,...days.map(x=>Math.max(Number(x.shipments),Number(x.quotes),Number(x.messages))));
  $('#activityBars').innerHTML=days.map(x=>'<div class="bar-col"><div class="bar" title="'+esc(x.day)+': '+x.shipments+' shipments, '+x.quotes+' quotes, '+x.messages+' messages" style="height:'+Math.max(3,Number(x.shipments)/max*150)+'px"></div><span class="bar-label">'+esc(String(x.day).slice(5))+'</span></div>').join('');
  $('#activityMeta').textContent='Bars show shipment volume; hover for quote/message totals.';
  const s=d.summary||{}; $('#reportSummary').innerHTML=[['New quotes',s.new_quotes],['New messages',s.new_messages],['Delivered',s.delivered],['In transit',s.in_transit],['Out for delivery',s.out_for_delivery]].map(([label,value])=>'<div class="stat"><div class="muted small">'+label+'</div><div class="n">'+(value??0)+'</div></div>').join('');
}
async function loadShipments(){
  const search=encodeURIComponent($('#shipmentSearch').value.trim()); const status=encodeURIComponent($('#shipmentStatus').value); const offset=shipmentPage*pageSize;
  const d=await api(`/api/admin/shipments?limit=${pageSize}&offset=${offset}&search=${search}&status=${status}`); totalShipments=d.total;
  $('#shipmentMeta').textContent=`Showing ${totalShipments ? offset+1 : 0}–${Math.min(offset+d.shipments.length,totalShipments)} of ${totalShipments}`;
  $('#pageInfo').textContent=`Page ${shipmentPage+1}`;$('#prevPage').disabled=shipmentPage===0;$('#nextPage').disabled=offset+d.shipments.length>=totalShipments;
  $('#shipmentsBody').innerHTML=d.shipments.map(s=>`<tr><td><strong>${esc(s.tracking_number)}</strong></td><td><span class="status ${esc(s.status)}">${esc(prettyStatus(s.status))}</span></td><td>${esc(s.origin_city)}, ${esc(s.origin_country)}<br>→ ${esc(s.destination_city)}, ${esc(s.destination_country)}</td><td>${esc(s.recipient_name||'—')}<br><span class="muted">${esc(s.recipient_email||'')}</span></td><td>${esc(s.service_type||'—')}</td><td>${esc(fmt(s.updated_at))}</td><td><button class="secondary viewShipment" data-id="${esc(s.id)}">View</button> <button class="secondary selectShipment" data-id="${esc(s.id)}">Update</button></td></tr>`).join('')||'<tr><td colspan="7" class="muted">No shipments match the current filters.</td></tr>';
  document.querySelectorAll('.viewShipment').forEach(b=>b.onclick=()=>viewShipment(b.dataset.id));
  document.querySelectorAll('.selectShipment').forEach(b=>b.onclick=()=>selectShipment(b.dataset.id));
}
async function selectShipment(id){$('#statusShipmentId').value=id;$('#statusSubmit').disabled=false;try{const d=await api('/api/admin/shipments/'+id);const s=d.shipment;$('#statusForm [name=status]').value=s.status==='cancelled'?'cancelled':(s.status==='delivered'?'delivered':'in_transit');$('#statusForm [name=location]').value=s.destination_city||'';$('#statusForm [name=note]').value='';$('#statusForm').scrollIntoView({behavior:'smooth',block:'center'});}catch(err){setMsg($('#statusMsg'),err.message,'error')}}
async function viewShipment(id){try{const d=await api('/api/admin/shipments/'+id);const s=d.shipment;$('#dialogTitle').textContent=s.tracking_number;$('#dialogSubtitle').textContent=`${s.origin_city}, ${s.origin_country} → ${s.destination_city}, ${s.destination_country}`;$('#dialogContent').innerHTML=`<div class="grid"><div><h3>Shipment details</h3><div class="small"><strong>Status:</strong> ${esc(prettyStatus(s.status))}<br><strong>Service:</strong> ${esc(s.service_type||'—')}<br><strong>Weight:</strong> ${esc(s.weight_kg||'—')} kg<br><strong>ETA:</strong> ${esc(fmt(s.estimated_delivery_at))}<br><strong>Recipient:</strong> ${esc(s.recipient_name||'—')}<br><strong>Email:</strong> ${esc(s.recipient_email||'—')}<br><strong>Phone:</strong> ${esc(s.recipient_phone||'—')}</div></div><div><h3>Package</h3><div class="small">${esc(s.package_description||'No package description provided.')}</div></div></div><h3 style="margin-top:18px">Tracking timeline</h3><div class="timeline">${(s.events||[]).slice().reverse().map(e=>`<div class="event"><strong>${esc(prettyStatus(e.status))}</strong><div class="muted small">${esc(fmt(e.occurredAt))}${e.location?' · '+esc(e.location):''}</div>${e.note?`<p>${esc(e.note)}</p>`:''}</div>`).join('')||'<div class="muted">No tracking events.</div>'}</div><div class="form-actions" style="margin-top:18px"><button type="button" id="editFromDialog">Edit shipment</button></div>`;$('#shipmentDialog').showModal();$('#editFromDialog').onclick=()=>{ $('#shipmentDialog').close(); loadEditForm(s); }}catch(err){alert(err.message)}}
function loadEditForm(s){
  $('#dialogTitle').textContent='Edit shipment'; $('#dialogSubtitle').textContent=s.tracking_number;
  $('#dialogContent').innerHTML=`<form id="editShipmentForm"><div class="grid"><label>Tracking number<input name="trackingNumber" value="${esc(s.tracking_number)}" required></label><label>Service type<input name="serviceType" value="${esc(s.service_type||'')}"></label><label>Origin city<input name="originCity" value="${esc(s.origin_city)}" required></label><label>Origin country<input name="originCountry" value="${esc(s.origin_country)}" required></label><label>Destination city<input name="destinationCity" value="${esc(s.destination_city)}" required></label><label>Destination country<input name="destinationCountry" value="${esc(s.destination_country)}" required></label><label>Recipient name<input name="recipientName" value="${esc(s.recipient_name||'')}"></label><label>Recipient phone<input name="recipientPhone" value="${esc(s.recipient_phone||'')}"></label><label>Recipient email<input name="recipientEmail" type="email" value="${esc(s.recipient_email||'')}"></label><label>Weight (kg)<input name="weightKg" type="number" step="0.01" min="0" value="${esc(s.weight_kg||'')}"></label><label>Estimated delivery<input name="estimatedDeliveryAt" type="datetime-local" value="${s.estimated_delivery_at?new Date(s.estimated_delivery_at).toISOString().slice(0,16):''}"></label></div><label>Package description<textarea name="packageDescription">${esc(s.package_description||'')}</textarea></label><div class="form-actions"><button>Save changes</button><button type="button" id="cancelEdit" class="secondary">Cancel</button></div><div id="editMsg" class="message"></div></form>`;$('#shipmentDialog').showModal();$('#cancelEdit').onclick=()=>$('#shipmentDialog').close();$('#editShipmentForm').onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(e.target));await api('/api/admin/shipments/'+s.id,{method:'PATCH',body:JSON.stringify(b)});setMsg($('#statusMsg'),'Shipment details updated.','success');$('#shipmentDialog').close();loadAll();}catch(err){setMsg($('#editMsg'),err.message,'error')}};
}
$('#closeDialog').onclick=()=>$('#shipmentDialog').close();
$('#searchShipments').onclick=()=>{shipmentPage=0;loadShipments().catch(e=>$('#shipmentsBody').innerHTML=`<tr><td colspan="7" class="error">${esc(e.message)}</td></tr>`)};
$('#clearShipmentFilters').onclick=()=>{$('#shipmentSearch').value='';$('#shipmentStatus').value='';shipmentPage=0;loadShipments()};
$('#prevPage').onclick=()=>{if(shipmentPage>0){shipmentPage--;loadShipments()}};$('#nextPage').onclick=()=>{if((shipmentPage+1)*pageSize<totalShipments){shipmentPage++;loadShipments()}};
function showQuoteRequest(q){
  const money=q.declared_value==null?'—':`${q.declared_currency||''} ${q.declared_value}`;
  const yesNo=v=>v?'Yes':'No';
  $('#dialogTitle').textContent=`Shipment request ${String(q.id||'').slice(0,8).toUpperCase()}`;
  $('#dialogSubtitle').textContent=`${q.name} · ${fmt(q.created_at)}`;
  $('#dialogContent').innerHTML=`
    <div class="grid">
      <div><h3>👤 Customer</h3><div class="small"><strong>Name:</strong> ${esc(q.name)}<br><strong>Email:</strong> ${esc(q.email)}<br><strong>Phone:</strong> ${esc(q.phone||'—')}</div></div>
      <div><h3>🛡️ Request</h3><div class="small"><strong>Reference:</strong> STQ-${esc(String(q.id||'').slice(0,8).toUpperCase())}<br><strong>Service:</strong> ${esc(q.service_type||'—')}<br><strong>Status:</strong> ${esc(q.status||'—')}</div></div>
    </div>
    <hr style="border:0;border-top:1px solid #edf0f4;margin:16px 0">
    <div class="grid">
      <div><h3>📍 Pickup</h3><div class="small"><strong>Address:</strong> ${esc(q.pickup_address||'—')}<br><strong>Area:</strong> ${esc(q.pickup_area||'—')}<br><strong>City:</strong> ${esc(q.pickup_city||'—')}<br><strong>State:</strong> ${esc(q.pickup_state||'—')}<br><strong>Country:</strong> ${esc(q.pickup_country||'—')}<br><strong>Postal:</strong> ${esc(q.pickup_postal_code||'—')}<br><strong>Contact:</strong> ${esc(q.pickup_contact_name||'—')} / ${esc(q.pickup_contact_phone||'—')}<br><strong>Preferred:</strong> ${esc(q.pickup_date||'—')} · ${esc(q.pickup_time_window||'—')}</div></div>
      <div><h3>🌍 Delivery</h3><div class="small"><strong>Address:</strong> ${esc(q.delivery_address||'—')}<br><strong>Area:</strong> ${esc(q.delivery_area||'—')}<br><strong>City:</strong> ${esc(q.delivery_city||'—')}<br><strong>State:</strong> ${esc(q.delivery_state||'—')}<br><strong>Country:</strong> ${esc(q.delivery_country||'—')}<br><strong>Postal:</strong> ${esc(q.delivery_postal_code||'—')}<br><strong>Recipient:</strong> ${esc(q.recipient_name||'—')} / ${esc(q.recipient_phone||'—')}<br><strong>Email:</strong> ${esc(q.recipient_email||'—')}</div></div>
    </div>
    <hr style="border:0;border-top:1px solid #edf0f4;margin:16px 0">
    <div class="grid">
      <div><h3>📦 Package</h3><div class="small"><strong>Type:</strong> ${esc(q.package_type||'—')}<br><strong>Quantity:</strong> ${esc(q.package_quantity||'—')}<br><strong>Weight:</strong> ${esc(q.weight_kg??'—')} kg<br><strong>Size:</strong> ${esc(q.length_cm??'—')} × ${esc(q.width_cm??'—')} × ${esc(q.height_cm??'—')} cm<br><strong>Declared value:</strong> ${esc(money)}<br><strong>Fragile:</strong> ${yesNo(q.fragile)}<br><strong>Batteries/electronics:</strong> ${yesNo(q.contains_batteries)}</div></div>
      <div><h3>📝 Handling notes</h3><div class="small"><strong>Contents:</strong><br>${esc(q.package_contents||'—')}<br><br><strong>Description:</strong><br>${esc(q.package_description||'—')}<br><br><strong>Special instructions:</strong><br>${esc(q.special_instructions||'—')}</div></div>
    </div>`;
  $('#shipmentDialog').showModal();
}
async function loadQuotes(){
  const f=encodeURIComponent($('#quoteFilter').value);
  const d=await api('/api/admin/quotes?limit=50&status='+f);
  $('#quotes').innerHTML=d.quotes.map(q=>`<div class="item"><div class="row"><strong>${esc(q.name)}</strong><span class="status">${esc(q.status)}</span></div><div class="muted small">${esc(q.pickup_city||q.origin)} → ${esc(q.delivery_city||q.destination)} · ${esc(q.service_type)} · ${esc(q.email)}</div><div class="muted small">${esc(fmt(q.created_at))} · ${esc(q.package_type||'Package request')}</div><div class="toolbar" style="margin-top:8px"><button class="secondary qview" data-id="${esc(q.id)}">View full request</button><button class="secondary qbtn" data-id="${esc(q.id)}" data-status="reviewing">Review</button><button class="secondary qbtn" data-id="${esc(q.id)}" data-status="quoted">Mark quoted</button><button class="secondary qbtn" data-id="${esc(q.id)}" data-status="closed">Close</button></div></div>`).join('')||'<p class="muted">No shipment requests.</p>';
  document.querySelectorAll('.qview').forEach(b=>b.onclick=()=>showQuoteRequest(d.quotes.find(q=>q.id===b.dataset.id)));
  document.querySelectorAll('.qbtn').forEach(b=>b.onclick=()=>setQuote(b.dataset.id,b.dataset.status));
}
async function setQuote(id,status){try{await api('/api/admin/quotes/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});await loadQuotes();await loadOverview()}catch(e){alert(e.message)}}
async function loadMessages(){const f=encodeURIComponent($('#messageFilter').value);const d=await api('/api/admin/messages?limit=50&status='+f);$('#messages').innerHTML=d.messages.map(m=>`<div class="item"><div class="row"><strong>${esc(m.name)}</strong><span class="status">${esc(m.status)}</span></div><div class="muted small">${esc(m.email)}${m.phone?' · '+esc(m.phone):''}</div><div style="margin:8px 0;font-size:13px">${esc(m.message)}</div><div class="toolbar"><button class="secondary mbtn" data-id="${esc(m.id)}" data-status="read">Mark read</button><button class="secondary mbtn" data-id="${esc(m.id)}" data-status="closed">Close</button></div></div>`).join('')||'<p class="muted">No contact messages.</p>';document.querySelectorAll('.mbtn').forEach(b=>b.onclick=()=>setMessage(b.dataset.id,b.dataset.status))}
async function setMessage(id,status){try{await api('/api/admin/messages/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});await loadMessages();await loadOverview()}catch(e){alert(e.message)}}
async function loadAudit(){const d=await api('/api/admin/audit-logs?limit=20');$('#audit').innerHTML=d.logs.map(l=>`<div class="item"><strong>${esc(l.action)}</strong><div class="muted small">${esc(l.admin_email||'system')} · ${esc(fmt(l.created_at))}</div></div>`).join('')||'<p class="muted">No audit activity yet.</p>'}
async function loadAll(){try{await Promise.all([loadOverview(),loadReports(),loadShipments(),loadQuotes(),loadMessages(),loadAudit()])}catch(e){if(e.message!=='Session expired.') console.error(e)}}
$('#quoteFilter').onchange=loadQuotes;$('#messageFilter').onchange=loadMessages;

// Keyboard-friendly admin search.
$('#shipmentSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); shipmentPage = 0; loadShipments().catch(err => setMsg($('#shipmentMsg'), err.message, 'error')); }
});
if(sessionStorage.getItem(tokenKey)) showApp();
