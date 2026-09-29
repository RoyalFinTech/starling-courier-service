// Header scroll state
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
}, {passive:true});

// Mobile nav
const mobileNav = document.getElementById('mobileNav');
const menuToggle = document.getElementById('menuToggle');
const menuClose = document.getElementById('menuClose');
function openMenu(){mobileNav.classList.add('open'); menuToggle.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden';}
function closeMenu(){mobileNav.classList.remove('open'); menuToggle.setAttribute('aria-expanded','false'); document.body.style.overflow='';}
menuToggle.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); revealObserver.unobserve(e.target); } });
}, {threshold:0.15});
revealEls.forEach(el => revealObserver.observe(el));

// Live tracking API
const tlSteps = document.querySelectorAll('.tl-step');
const fillLine = document.getElementById('fillLine');
const statusLabel = document.getElementById('statusLabel');
const trackForm = document.getElementById('trackForm');
const trackInput = document.getElementById('trackInput');
const trackMessage = document.getElementById('trackMessage');
const originLabel = document.getElementById('originLabel');
const destinationLabel = document.getElementById('destinationLabel');
const etaLabel = document.getElementById('etaLabel');
const trackingDetail = document.getElementById('trackingDetail');
const trackingNumberLabel = document.getElementById('trackingNumberLabel');
const serviceTypeLabel = document.getElementById('serviceTypeLabel');
const updatedLabel = document.getElementById('updatedLabel');
const eventHistory = document.getElementById('eventHistory');
const trackButton = trackForm.querySelector('button[type="submit"]');
const apiBase = (window.STARLING_API_BASE || (location.hostname.endsWith('.github.io') ? 'https://starling-courier-service.onrender.com' : location.origin)).replace(/\/+$/, '');

const quoteForm = document.getElementById('quoteForm');
const quoteMessage = document.getElementById('quoteMessage');
const quoteSuccess = document.getElementById('quoteSuccess');
const quoteSuccessRef = document.getElementById('quoteSuccessRef');
const submitQuoteButton = document.getElementById('submitQuoteButton');
const bookAnotherButton = document.getElementById('bookAnotherButton');
const quoteFormFields = quoteForm ? [...quoteForm.querySelectorAll('input, select, textarea')] : [];

function setFieldState(field, invalid) {
  const wrap = field?.closest('.form-field');
  if (wrap) wrap.classList.toggle('invalid', Boolean(invalid));
}

function clearFieldState(e) {
  setFieldState(e.target, false);
}

quoteFormFields.forEach(field => {
  field.addEventListener('input', clearFieldState);
  field.addEventListener('change', clearFieldState);
});

if (quoteForm) {
  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    quoteMessage.textContent = '';
    quoteMessage.className = 'booking-form-message';
    let firstInvalid = null;
    quoteFormFields.forEach(field => {
      const invalid = !field.checkValidity();
      setFieldState(field, invalid);
      if (invalid && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      quoteMessage.textContent = 'Please complete the highlighted details before submitting.';
      quoteMessage.className = 'booking-form-message error';
      return;
    }

    const form = new FormData(quoteForm);
    const payload = Object.fromEntries(form.entries());
    submitQuoteButton.disabled = true;
    submitQuoteButton.classList.add('is-loading');
    submitQuoteButton.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending request…';
    quoteMessage.textContent = 'Securely sending your shipment request to Starling operations…';

    try {
      const response = await fetch(`${apiBase}/api/quotes`, {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to submit quote request.');

      quoteForm.classList.add('hidden');
      if (quoteSuccess) quoteSuccess.classList.remove('hidden');
      if (quoteSuccessRef) quoteSuccessRef.textContent = data.quoteRequest?.id || 'Received';
      quoteMessage.textContent = 'Request received.';
      const url = new URL(window.location.href);
      url.searchParams.delete('tracking');
      history.replaceState(null, '', url);
    } catch (error) {
      quoteMessage.textContent = error.message || 'Unable to submit quote request. Please try again.';
      quoteMessage.className = 'booking-form-message error';
    } finally {
      submitQuoteButton.disabled = false;
      submitQuoteButton.classList.remove('is-loading');
      submitQuoteButton.innerHTML = '<span>Submit booking request</span><span aria-hidden="true">→</span>';
    }
  });
}

if (bookAnotherButton) {
  bookAnotherButton.addEventListener('click', () => {
    quoteForm.reset();
    quoteForm.classList.remove('hidden');
    quoteSuccess?.classList.add('hidden');
    quoteMessage.textContent = '';
    quoteFormFields.forEach(field => setFieldState(field, false));
    quoteForm.querySelector('input[name="name"]')?.focus();
  });
}

document.querySelectorAll('.service-link[data-service]').forEach(link => {
  link.addEventListener('click', () => {
    const select = document.querySelector('#quoteForm select[name="serviceType"]');
    const service = link.dataset.service || '';
    if (select && service) {
      select.value = service;
      setFieldState(select, false);
    }
  });
});

const statusOrder = ['created','picked_up','in_transit','out_for_delivery','delivered'];
const statusNames = {
  created: 'Shipment Created',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

function setTimelineStep(activeIndex, status) {
  tlSteps.forEach((step, i) => {
    step.classList.remove('active','done');
    if (i < activeIndex) step.classList.add('done');
    else if (i === activeIndex) step.classList.add('active');
  });
  fillLine.style.width = Math.max(0, Math.min(100, (activeIndex / (tlSteps.length - 1)) * 100)) + '%';
  statusLabel.textContent = statusNames[status] || status || 'Unknown';
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function renderEventHistory(events = []) {
  eventHistory.replaceChildren();
  if (!Array.isArray(events) || events.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No shipment events have been recorded yet.';
    empty.style.color = '#5b6479';
    eventHistory.appendChild(empty);
    return;
  }
  [...events].reverse().forEach(event => {
    const row = document.createElement('div'); row.className = 'event-item';
    const marker = document.createElement('div'); marker.className = 'event-marker';
    const content = document.createElement('div'); content.className = 'event-content';
    const title = document.createElement('strong'); title.textContent = statusNames[event.status] || event.status || 'Shipment update';
    const meta = document.createElement('div'); meta.className = 'event-meta';
    meta.textContent = [event.location, formatDate(event.occurredAt)].filter(Boolean).join(' • ');
    content.append(title, meta);
    if (event.note) { const note = document.createElement('p'); note.textContent = event.note; content.appendChild(note); }
    row.append(marker, content); eventHistory.appendChild(row);
  });
}

function resetTracking() {
  tlSteps.forEach(step => step.classList.remove('active','done'));
  fillLine.style.width = '0%';
  statusLabel.textContent = 'Awaiting tracking';
  originLabel.textContent = '—';
  destinationLabel.textContent = '—';
  etaLabel.textContent = '—';
  trackingNumberLabel.textContent = '—';
  serviceTypeLabel.textContent = '—';
  updatedLabel.textContent = '—';
  eventHistory.replaceChildren();
  trackingDetail.classList.remove('visible');
  trackMessage.classList.remove('tracking-error');
}
resetTracking();

trackForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = trackInput.value.trim().toUpperCase();
  trackMessage.classList.remove('tracking-error');
  if (!/^[A-Z0-9-]{4,40}$/.test(value)) {
    trackMessage.textContent = 'Enter a valid tracking number.';
    trackMessage.classList.add('tracking-error');
    resetTracking();
    return;
  }

  trackButton.disabled = true;
  trackButton.textContent = 'Checking…';
  trackMessage.textContent = 'Checking shipment status…';
  try {
    const response = await fetch(`${apiBase}/api/shipments/${encodeURIComponent(value)}`, { headers: { 'Accept': 'application/json' } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Shipment could not be found.');

    const shipment = data.shipment;
    const statusIndex = statusOrder.indexOf(shipment.status);
    setTimelineStep(statusIndex >= 0 ? statusIndex : 0, shipment.status);
    if (shipment.status === 'cancelled') fillLine.style.width = '0%';
    originLabel.textContent = [shipment.origin_city, shipment.origin_country].filter(Boolean).join(', ') || 'Not available';
    destinationLabel.textContent = [shipment.destination_city, shipment.destination_country].filter(Boolean).join(', ') || 'Not available';
    etaLabel.textContent = formatDate(shipment.estimated_delivery_at);
    trackingNumberLabel.textContent = shipment.tracking_number || value;
    serviceTypeLabel.textContent = shipment.service_type || 'Not specified';
    updatedLabel.textContent = formatDate(shipment.updated_at);
    renderEventHistory(shipment.events);
    trackingDetail.classList.add('visible');
    trackMessage.textContent = `Showing live tracking for ${shipment.tracking_number}`;
    const url = new URL(window.location.href);
    url.searchParams.set('tracking', shipment.tracking_number);
    history.replaceState(null, '', url);
  } catch (error) {
    resetTracking();
    trackMessage.textContent = error.message || 'Unable to retrieve shipment status.';
    trackMessage.classList.add('tracking-error');
  } finally {
    trackButton.disabled = false;
    trackButton.textContent = 'Track Shipment';
  }
});

const trackingFromUrl = new URLSearchParams(window.location.search).get('tracking');
if (trackingFromUrl) {
  trackInput.value = trackingFromUrl.toUpperCase();
  trackForm.requestSubmit();
}


// Keep staff portal links aligned with the live backend origin.
const staffPortal = document.getElementById('staffPortalLink');
if (staffPortal) staffPortal.href = apiBase + '/admin.html';
