(() => {
  'use strict';

  const APP_VERSION = '2.0.0';
  const STORAGE_KEY = 'rodeocheck:v2';
  const LEGACY_KEY = 'rodeocheck:v1';

  const inspectionTemplate = [
    'Engine', 'Transmission', 'Cooling system', 'A/C & heat', 'Warning lights', 'OBD codes',
    'Leaks', 'Brakes', 'Tires', 'Suspension / steering', 'Electrical', 'Body / frame',
    'Glass', 'Interior', 'Test drive', 'Keys / remotes'
  ];

  const reconTemplate = [
    'Oil / filter', 'State inspection', 'Tires', 'Brakes', 'Battery', 'A/C & heat',
    'Mechanical repair', 'Body / paint', 'Glass', 'Interior repair', 'Detail', 'Keys / remotes'
  ];

  const defaultStore = {
    version: APP_VERSION,
    reports: [],
    contracts: [],
    settings: {
      state: 'TX',
      language: 'en',
      docFeeThreshold: 225,
      autoSave: true,
      defaultTargetGross: 4000
    }
  };

  let store = loadStore();
  let currentVinReport = null;
  let currentContractFiles = [];
  let deferredInstallPrompt = null;
  let savedTab = 'vin';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  function fmtMoney(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
  }
  function fmtMoney2(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));
  }
  function fmtNumber(n) { return Number(n || 0).toLocaleString('en-US'); }
  function fmtDate(iso) {
    try { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); }
    catch { return iso || ''; }
  }
  function numOrNull(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const n = Number(raw.replace(/[$,%\s,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  function titleCase(s = '') { return String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
  function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2700);
  }

  function loadStore() {
    let parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) {}
    if (!parsed) {
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
        if (legacy) parsed = migrateLegacy(legacy);
      } catch (_) {}
    }
    const merged = {
      ...clone(defaultStore),
      ...(parsed || {}),
      settings: { ...defaultStore.settings, ...((parsed || {}).settings || {}) },
      reports: Array.isArray(parsed?.reports) ? parsed.reports.map(normalizeReport) : [],
      contracts: Array.isArray(parsed?.contracts) ? parsed.contracts : []
    };
    merged.version = APP_VERSION;
    return merged;
  }

  function migrateLegacy(legacy) {
    const migrated = clone(legacy);
    migrated.version = APP_VERSION;
    migrated.settings = { ...defaultStore.settings, ...(legacy.settings || {}) };
    migrated.reports = Array.isArray(legacy.reports) ? legacy.reports.map(normalizeReport) : [];
    return migrated;
  }

  function defaultInspection() {
    return inspectionTemplate.map(label => ({ id: uid(), label, status: 'not_checked', note: '' }));
  }

  function defaultRecon() {
    return reconTemplate.map(label => ({ id: uid(), item: label, status: 'planned', cost: '' }));
  }

  function defaultDeal() {
    return {
      stage: 'considering', stockNumber: '', seller: '', laneRun: '', odometer: '',
      titleStatus: 'not_checked', titleDetail: '', nicbStatus: 'not_checked', auctionPhotos: 'not_checked',
      mmr: '', auctionPrice: '', auctionFees: '', transport: '', reconEstimate: '', otherCosts: '',
      estimatedRetail: '', targetGross: String(store?.settings?.defaultTargetGross || defaultStore.settings.defaultTargetGross),
      auctionAnnouncements: '', conditionNotes: ''
    };
  }

  function normalizeReport(report) {
    const r = { ...(report || {}) };
    r.id = r.id || uid();
    r.createdAt = r.createdAt || new Date().toISOString();
    r.updatedAt = r.updatedAt || r.createdAt;
    r.deal = { ...defaultDealSafe(), ...(r.deal || {}) };
    if (!r.deal.targetGross) r.deal.targetGross = String(defaultStore.settings.defaultTargetGross);
    r.inspection = Array.isArray(r.inspection) && r.inspection.length ? r.inspection : defaultInspection();
    r.reconItems = Array.isArray(r.reconItems) && r.reconItems.length ? r.reconItems : defaultRecon();
    r.notes = r.notes || '';
    r.recalls = Array.isArray(r.recalls) ? r.recalls : [];
    r.complaints = Array.isArray(r.complaints) ? r.complaints : [];
    return r;
  }

  function defaultDealSafe() {
    return {
      stage: 'considering', stockNumber: '', seller: '', laneRun: '', odometer: '',
      titleStatus: 'not_checked', titleDetail: '', nicbStatus: 'not_checked', auctionPhotos: 'not_checked',
      mmr: '', auctionPrice: '', auctionFees: '', transport: '', reconEstimate: '', otherCosts: '',
      estimatedRetail: '', targetGross: String(defaultStore.settings.defaultTargetGross),
      auctionAnnouncements: '', conditionNotes: ''
    };
  }

  function persist() {
    store.version = APP_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    refreshHome();
  }

  function go(screen) {
    $$('.screen').forEach(el => el.classList.toggle('active', el.dataset.screen === screen));
    $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.go === screen));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (screen === 'saved') renderSaved();
  }
  $$('[data-go]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.go)));

  // PWA install handling. iOS uses Share -> Add to Home Screen.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $('#installBtn')?.classList.remove('hidden');
  });
  $('#installBtn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) { go('settings'); return; }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#installBtn')?.classList.add('hidden');
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // VIN validation.
  const translit = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
  const weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  function normalizeVin(v) { return (v || '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17); }
  function validCheckDigit(vin) {
    if (vin.length !== 17) return false;
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      const c = vin[i];
      const n = /\d/.test(c) ? Number(c) : translit[c];
      if (n == null) return false;
      sum += n * weights[i];
    }
    const rem = sum % 11;
    return vin[8] === (rem === 10 ? 'X' : String(rem));
  }

  $('#vinInput')?.addEventListener('input', e => { e.target.value = normalizeVin(e.target.value); });
  $('#decodeVinBtn')?.addEventListener('click', () => runVin($('#vinInput').value));
  $('#vinInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') runVin(e.target.value); });

  async function runVin(rawVin) {
    const vin = normalizeVin(rawVin);
    $('#vinInput').value = vin;
    if (vin.length !== 17) { toast('Enter a full 17-character VIN.'); return; }
    if (!validCheckDigit(vin)) {
      const proceed = confirm('This VIN does not pass the standard North American check-digit test. Continue anyway?');
      if (!proceed) return;
    }

    const existing = store.reports.find(r => r.vin === vin);
    $('#vinLoading').classList.remove('hidden');
    $('#vinReport').classList.add('hidden');
    $('#vinStatus').textContent = 'Checking NHTSA public data…';

    try {
      const decodeUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
      const decodeResp = await fetch(decodeUrl);
      if (!decodeResp.ok) throw new Error(`NHTSA VIN service returned ${decodeResp.status}`);
      const decodeJson = await decodeResp.json();
      const d = decodeJson?.Results?.[0] || {};
      if (!d.Make && !d.Model) throw new Error(d.ErrorText || 'VIN could not be decoded.');

      let recalls = [];
      let complaints = [];
      try {
        if (d.Make && d.Model && d.ModelYear) {
          const q = new URLSearchParams({ make: d.Make, model: d.Model, modelYear: d.ModelYear });
          const [recallResp, complaintResp] = await Promise.all([
            fetch(`https://api.nhtsa.gov/recalls/recallsByVehicle?${q.toString()}`),
            fetch(`https://api.nhtsa.gov/complaints/complaintsByVehicle?${q.toString()}`)
          ]);
          if (recallResp.ok) recalls = (await recallResp.json())?.results || [];
          if (complaintResp.ok) complaints = (await complaintResp.json())?.results || [];
        }
      } catch (_) { /* supplemental public data may fail independently */ }

      if (existing) {
        currentVinReport = normalizeReport({ ...clone(existing), decode: d, recalls: recalls.slice(0, 30), complaints: complaints.slice(0, 50), updatedAt: new Date().toISOString() });
      } else {
        currentVinReport = normalizeReport({
          id: uid(), vin, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          decode: d, recalls: recalls.slice(0, 30), complaints: complaints.slice(0, 50), notes: '',
          deal: { ...defaultDealSafe(), targetGross: String(store.settings.defaultTargetGross) },
          inspection: defaultInspection(), reconItems: defaultRecon()
        });
      }
      renderVinReport(currentVinReport);
      if (store.settings.autoSave) saveVinReport(currentVinReport, true);
      $('#vinStatus').textContent = existing ? 'Saved report refreshed.' : 'Report ready.';
    } catch (err) {
      $('#vinReport').innerHTML = `<section class="panel"><div class="alert-card bad"><h4>Could not build the report</h4><p>${escapeHtml(err.message || String(err))}</p></div></section>`;
      $('#vinReport').classList.remove('hidden');
      $('#vinStatus').textContent = 'Lookup failed.';
    } finally {
      $('#vinLoading').classList.add('hidden');
    }
  }

  function spec(label, value) {
    if (!value || String(value).trim() === '' || value === '0') return '';
    return `<div class="spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function reportDeal(report) {
    return { ...defaultDealSafe(), ...(report?.deal || {}) };
  }

  function reconTotal(report) {
    const items = Array.isArray(report?.reconItems) ? report.reconItems : [];
    const entered = items.map(i => numOrNull(i.cost)).filter(v => v != null);
    return entered.length ? entered.reduce((a, b) => a + b, 0) : null;
  }

  function calcEconomics(report) {
    const deal = reportDeal(report);
    const purchase = numOrNull(deal.auctionPrice);
    const fees = numOrNull(deal.auctionFees) || 0;
    const transport = numOrNull(deal.transport) || 0;
    const itemRecon = reconTotal(report);
    const recon = itemRecon != null ? itemRecon : (numOrNull(deal.reconEstimate) || 0);
    const other = numOrNull(deal.otherCosts) || 0;
    const retail = numOrNull(deal.estimatedRetail);
    const targetGross = numOrNull(deal.targetGross) ?? Number(store.settings.defaultTargetGross || 0);
    const mmr = numOrNull(deal.mmr);
    const fixedBeyondPurchase = fees + transport + recon + other;
    const allIn = purchase != null ? purchase + fixedBeyondPurchase : null;
    const projectedGross = retail != null && allIn != null ? retail - allIn : null;
    const margin = projectedGross != null && retail > 0 ? projectedGross / retail * 100 : null;
    const maxBid = retail != null ? retail - targetGross - fixedBeyondPurchase : null;
    const mmrSpread = mmr != null && allIn != null ? mmr - allIn : null;
    const targetMet = projectedGross != null ? projectedGross >= targetGross : null;
    return { purchase, fees, transport, recon, other, retail, targetGross, mmr, fixedBeyondPurchase, allIn, projectedGross, margin, maxBid, mmrSpread, targetMet, itemRecon };
  }

  function inspectionSummary(report) {
    const items = Array.isArray(report?.inspection) ? report.inspection : [];
    const counts = { pass: 0, attention: 0, fail: 0, not_checked: 0 };
    items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return counts;
  }

  function statusBadge(status) {
    const map = {
      pass: ['ok', 'PASS'], attention: ['warn', 'ATTENTION'], fail: ['bad', 'FAIL'], not_checked: ['neutral', 'NOT CHECKED'],
      considering: ['blue', 'CONSIDERING'], bought_recon: ['warn', 'BOUGHT / RECON'], ready_sale: ['ok', 'READY FOR SALE'], sold: ['neutral', 'SOLD']
    };
    const [cls, label] = map[status] || ['neutral', String(status || '').replaceAll('_', ' ')];
    return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
  }

  function historyState(report) {
    const deal = reportDeal(report);
    const hasIssue = deal.titleStatus === 'branded' || deal.nicbStatus === 'issue';
    const completeNoIssue = deal.titleStatus === 'clean' && deal.nicbStatus === 'no_record';
    if (hasIssue) return { cls: 'bad', label: 'Recorded history issue', text: 'A manual title/NMVTIS or NICB check is marked with an issue. Review the underlying source and documentation.' };
    if (completeNoIssue) return { cls: 'ok', label: 'Completed checks: no issue recorded', text: 'Your recorded title/NMVTIS and NICB checks did not return an issue. This is still not proof of a completely clean history.' };
    return { cls: 'warn', label: 'History checks incomplete', text: 'Complete the linked title/NMVTIS and NICB checks. Public VIN decoding alone is not a full vehicle history report.' };
  }

  function renderVinReport(report) {
    report = normalizeReport(report);
    currentVinReport = report;
    const d = report.decode || {};
    const deal = reportDeal(report);
    report.deal = deal;
    const recalls = report.recalls || [];
    const complaints = report.complaints || [];
    const econ = calcEconomics(report);
    const inspect = inspectionSummary(report);
    const history = historyState(report);
    const cleanDecode = String(d.ErrorCode || '').split(',').includes('0') || String(d.ErrorText || '').toLowerCase().includes('decoded clean');
    const name = [d.ModelYear, titleCase(d.Make), titleCase(d.Model), d.Trim].filter(Boolean).join(' ');
    const vin = report.vin;
    const googleQ = encodeURIComponent(`"${vin}" auction photos`);
    const imageQ = encodeURIComponent(`"${vin}"`);
    const bidcarsQ = encodeURIComponent(`site:bid.cars "${vin}"`);
    const copartQ = encodeURIComponent(`site:copart.com "${vin}"`);
    const iaaQ = encodeURIComponent(`site:iaai.com "${vin}"`);

    const econBanner = economicsBanner(econ);
    const modelRecallText = recalls.length
      ? `${recalls.length} model-level recall campaign${recalls.length === 1 ? '' : 's'} returned. Verify VIN-specific open recalls on NHTSA.`
      : 'No model-level recall campaigns were returned. Verify VIN-specific open recalls on NHTSA before purchase.';

    $('#vinReport').innerHTML = `
      <section class="report-hero">
        <div class="vehicle-title">
          <div><h3>${escapeHtml(name || 'Decoded vehicle')}</h3><span class="vin-mini">${escapeHtml(vin)}</span></div>
          ${statusBadge(deal.stage)}
        </div>
        <div class="spec-grid">
          ${spec('Body', d.BodyClass)}${spec('Drive', d.DriveType)}
          ${spec('Engine', [d.EngineCylinders ? `${d.EngineCylinders} cyl` : '', d.DisplacementL ? `${d.DisplacementL}L` : '', d.EngineModel].filter(Boolean).join(' • '))}
          ${spec('Fuel', d.FuelTypePrimary)}${spec('Transmission', [d.TransmissionStyle, d.TransmissionSpeeds ? `${d.TransmissionSpeeds}-speed` : ''].filter(Boolean).join(' • '))}
          ${spec('Plant', [d.PlantCity, d.PlantState, d.PlantCountry].filter(Boolean).join(', '))}${spec('Vehicle type', d.VehicleType)}${spec('GVWR', d.GVWR)}
        </div>
        <div class="checklist-summary">
          <span class="badge ${cleanDecode ? 'ok' : 'warn'}">${cleanDecode ? 'VIN DECODED' : 'REVIEW DECODE'}</span>
          <span class="badge ${history.cls}">${escapeHtml(history.label)}</span>
          <span class="badge ${inspect.fail ? 'bad' : inspect.attention ? 'warn' : 'neutral'}">${inspect.fail} FAIL • ${inspect.attention} ATTENTION</span>
        </div>
        ${econBanner}
      </section>

      <section class="panel" id="dealEconomicsPanel">
        <div class="section-head"><div><span class="eyebrow">DEAL ECONOMICS</span><h3>What the car really costs you</h3></div><span class="badge blue">DEALER MODE</span></div>
        <div class="field-grid three">
          <label>Stage
            <select id="stageInput">
              <option value="considering" ${deal.stage === 'considering' ? 'selected' : ''}>Considering / auction list</option>
              <option value="bought_recon" ${deal.stage === 'bought_recon' ? 'selected' : ''}>Bought / recon</option>
              <option value="ready_sale" ${deal.stage === 'ready_sale' ? 'selected' : ''}>Ready for sale</option>
              <option value="sold" ${deal.stage === 'sold' ? 'selected' : ''}>Sold</option>
            </select>
          </label>
          <label>Stock #<input id="stockNumberInput" placeholder="RM-001" value="${escapeHtml(deal.stockNumber)}" /></label>
          <label>Current odometer<input id="odometerInput" inputmode="numeric" placeholder="142000" value="${escapeHtml(deal.odometer)}" /></label>
          <label>MMR / benchmark<input id="mmrInput" inputmode="decimal" placeholder="6250" value="${escapeHtml(deal.mmr)}" /></label>
          <label>Estimated retail / list<input id="estimatedRetailInput" inputmode="decimal" placeholder="12995" value="${escapeHtml(deal.estimatedRetail)}" /></label>
          <label>Target front-end gross<input id="targetGrossInput" inputmode="decimal" placeholder="4000" value="${escapeHtml(deal.targetGross)}" /></label>
          <label>Purchase / bid price<input id="auctionPriceInput" inputmode="decimal" placeholder="5000" value="${escapeHtml(deal.auctionPrice)}" /></label>
          <label>Auction / buyer fees<input id="auctionFeesInput" inputmode="decimal" placeholder="650" value="${escapeHtml(deal.auctionFees)}" /></label>
          <label>Transport / tow<input id="transportInput" inputmode="decimal" placeholder="150" value="${escapeHtml(deal.transport)}" /></label>
          <label>Recon budget fallback<input id="reconEstimateInput" inputmode="decimal" placeholder="800" value="${escapeHtml(deal.reconEstimate)}" /></label>
          <label>Other acquisition costs<input id="otherCostsInput" inputmode="decimal" placeholder="0" value="${escapeHtml(deal.otherCosts)}" /></label>
          <label>Auction / seller<input id="sellerInput" placeholder="Manheim Dallas" value="${escapeHtml(deal.seller)}" /></label>
          <label>Lane / run #<input id="laneRunInput" placeholder="41/4" value="${escapeHtml(deal.laneRun)}" /></label>
        </div>
        <p class="muted small">If you enter itemized recon costs below, RodeoCheck uses that total instead of the recon fallback field.</p>
        <div class="metric-strip four">
          <div class="metric-mini"><span>All-in acquisition</span><strong id="econAllIn">${fmtMoney(econ.allIn)}</strong></div>
          <div class="metric-mini"><span>Projected gross</span><strong id="econGross">${fmtMoney(econ.projectedGross)}</strong></div>
          <div class="metric-mini"><span>Gross margin</span><strong id="econMargin">${econ.margin == null ? '—' : `${econ.margin.toFixed(1)}%`}</strong></div>
          <div class="metric-mini"><span>Max bid at target gross</span><strong id="econMaxBid">${fmtMoney(econ.maxBid)}</strong></div>
          <div class="metric-mini"><span>Spread to MMR</span><strong id="econMmrSpread">${fmtMoney(econ.mmrSpread)}</strong></div>
          <div class="metric-mini"><span>Recon used in math</span><strong id="econReconUsed">${fmtMoney(econ.recon)}</strong></div>
          <div class="metric-mini"><span>Target gross</span><strong id="econTargetGross">${fmtMoney(econ.targetGross)}</strong></div>
          <div class="metric-mini"><span>Fixed costs beyond bid</span><strong id="econFixed">${fmtMoney(econ.fixedBeyondPurchase)}</strong></div>
        </div>
        <div id="economicsStatus">${economicsStatusHtml(econ)}</div>
      </section>

      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">HISTORY CHECKS</span><h3>Public + manual verification</h3></div></div>
        <div class="alert-card ${history.cls}"><h4>${escapeHtml(history.label)}</h4><p>${escapeHtml(history.text)}</p></div>
        <div class="alert-card ${recalls.length ? 'warn' : 'blue'}"><h4>Recall check</h4><p>${escapeHtml(modelRecallText)}</p></div>
        <div class="action-grid">
          <a class="link-card" target="_blank" rel="noopener" href="https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}">NHTSA VIN recalls<small>Verify open/unrepaired recalls for this exact VIN.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://www.nicb.org/vincheck">NICB VINCheck<small>Free participating-insurer theft/salvage/flood screening.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://www.txdmv.gov/motorists/buying-or-selling-a-vehicle/title-check-look-before-you-buy">Texas Title Check<small>TxDMV guidance and NMVTIS route.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory">NMVTIS providers<small>Official consumer provider directory; fees may apply.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://www.google.com/search?q=${googleQ}">Exact-VIN web search<small>Look for prior listings and auction records.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${imageQ}">Exact-VIN images<small>Look for prior auction or damage photos.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://www.google.com/search?q=${bidcarsQ}">Search BIDCARS mentions<small>Google exact-VIN results limited to bid.cars.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://www.google.com/search?q=${copartQ}">Search Copart mentions<small>Google exact-VIN results limited to copart.com.</small></a>
          <a class="link-card" target="_blank" rel="noopener" href="https://www.google.com/search?q=${iaaQ}">Search IAA mentions<small>Google exact-VIN results limited to iaai.com.</small></a>
        </div>
        <div class="field-grid">
          <label>Title / NMVTIS result
            <select id="titleStatusSelect">
              <option value="not_checked" ${deal.titleStatus === 'not_checked' ? 'selected' : ''}>Not checked yet</option>
              <option value="clean" ${deal.titleStatus === 'clean' ? 'selected' : ''}>No brand/problem found in completed check</option>
              <option value="branded" ${deal.titleStatus === 'branded' ? 'selected' : ''}>Brand / total loss / odometer issue found</option>
            </select>
          </label>
          <label>NICB result
            <select id="nicbStatusSelect">
              <option value="not_checked" ${deal.nicbStatus === 'not_checked' ? 'selected' : ''}>Not checked yet</option>
              <option value="no_record" ${deal.nicbStatus === 'no_record' ? 'selected' : ''}>No participating-insurer record returned</option>
              <option value="issue" ${deal.nicbStatus === 'issue' ? 'selected' : ''}>Theft / salvage / flood record returned</option>
            </select>
          </label>
          <label>Old auction photos / listing
            <select id="auctionPhotosSelect">
              <option value="not_checked" ${deal.auctionPhotos === 'not_checked' ? 'selected' : ''}>Not checked yet</option>
              <option value="none" ${deal.auctionPhotos === 'none' ? 'selected' : ''}>None found</option>
              <option value="found" ${deal.auctionPhotos === 'found' ? 'selected' : ''}>Prior photos / listing found</option>
            </select>
          </label>
          <label>Title / history detail<input id="titleDetailInput" placeholder="Rebuilt, mileage discrepancy, source/date…" value="${escapeHtml(deal.titleDetail)}" /></label>
        </div>
      </section>

      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">INSPECTION</span><h3>Condition checklist</h3></div><div id="inspectionSummaryBadges">${inspectionBadges(report)}</div></div>
        <p class="muted small">Mark only what you actually inspected. “Not checked” stays visible so an uninspected item cannot look like a pass.</p>
        <div id="inspectionList" class="checklist-list">${inspectionRows(report)}</div>
      </section>

      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">RECON PLANNER</span><h3>Itemized repair / make-ready budget</h3></div><span id="reconTotalBadge" class="badge blue">${fmtMoney(reconTotal(report) || 0)}</span></div>
        <div class="table-scroll">
          <table class="recon-table"><thead><tr><th>Item</th><th>Status</th><th>Est. cost</th><th></th></tr></thead><tbody id="reconRows">${reconRows(report)}</tbody></table>
        </div>
        <div class="button-row"><button id="addReconBtn" class="secondary-btn">+ Add recon item</button></div>
      </section>

      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">AUCTION NOTES</span><h3>Announcements, condition and decision notes</h3></div></div>
        <label>Auction announcements<textarea id="auctionAnnouncementsInput" rows="3" placeholder="Frame, flood, structural, AS-IS, engine noise, etc.">${escapeHtml(deal.auctionAnnouncements)}</textarea></label>
        <label>Condition notes<textarea id="conditionNotesInput" rows="4" placeholder="Body damage, tires, leaks, smoke, noises, interior, test drive…">${escapeHtml(deal.conditionNotes)}</textarea></label>
        <label>General report notes<textarea id="vinNotes" rows="4" placeholder="Anything else you want saved with this vehicle…">${escapeHtml(report.notes || '')}</textarea></label>
      </section>

      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">SAFETY</span><h3>NHTSA model recall campaigns</h3></div><span class="badge ${recalls.length ? 'warn' : 'neutral'}">${recalls.length} RETURNED</span></div>
        <div class="recall-list">${recalls.length ? recalls.map(renderRecall).join('') : '<div class="empty-state">No model-level recalls were returned by the API.</div>'}</div>
      </section>

      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">KNOWN ISSUES</span><h3>NHTSA consumer complaints</h3></div><span class="badge neutral">${complaints.length}${complaints.length === 50 ? '+' : ''} LOADED</span></div>
        <p class="muted small">These are complaints for the decoded year/make/model, not proof that this VIN had the same problem.</p>
        <div class="complaint-list">${complaints.length ? complaints.slice(0, 10).map(renderComplaint).join('') : '<div class="empty-state">No complaint records were returned by the API.</div>'}</div>
      </section>

      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">REPORT</span><h3>Save, share or print</h3></div></div>
        <div class="button-row">
          <button id="saveVinBtn" class="primary-btn">Save report</button>
          <button id="shareVinBtn" class="secondary-btn">Share summary</button>
          <button id="printVinBtn" class="secondary-btn">Print / Save PDF</button>
          <button id="exportVinBtn" class="secondary-btn">Export JSON</button>
        </div>
      </section>
      <p class="disclaimer">RodeoCheck is a private decision-support and recordkeeping tool, not a comprehensive vehicle-history database and not a substitute for a physical/mechanical inspection. Missing public data is never treated as proof of a clean history. Verify title, odometer, lien, theft, accident and repair information with authoritative sources before purchase.</p>
    `;
    $('#vinReport').classList.remove('hidden');
    bindVinReportEvents(report);
  }

  function economicsBanner(econ) {
    if (econ.projectedGross == null) {
      return `<div class="economics-banner"><span class="kicker">Deal math incomplete</span><strong>Enter bid + retail</strong><p>Add your purchase price and estimated retail to calculate all-in cost, projected gross and max bid.</p></div>`;
    }
    const cls = econ.targetMet ? 'good' : 'attn';
    const headline = econ.targetMet ? 'Target gross met' : 'Below target gross';
    return `<div class="economics-banner ${cls}"><span class="kicker">${headline}</span><strong>${fmtMoney(econ.projectedGross)} projected gross</strong><p>${fmtMoney(econ.allIn)} all-in • ${econ.margin == null ? '—' : `${econ.margin.toFixed(1)}%`} front-end margin • target ${fmtMoney(econ.targetGross)}</p></div>`;
  }

  function economicsStatusHtml(econ) {
    if (econ.projectedGross == null) return '<div class="alert-card blue"><h4>Need more numbers</h4><p>Enter both a purchase/bid price and estimated retail value to compare the deal with your target gross.</p></div>';
    const delta = econ.projectedGross - econ.targetGross;
    if (delta >= 0) return `<div class="alert-card ok"><h4>Entered deal meets your target</h4><p>Projected gross is ${fmtMoney(delta)} above the target you entered. This is arithmetic only; condition/history risks still need separate review.</p></div>`;
    return `<div class="alert-card warn"><h4>Entered deal is below your target</h4><p>Projected gross is ${fmtMoney(Math.abs(delta))} below the target you entered. Your calculated maximum bid at the same assumptions is ${fmtMoney(econ.maxBid)}.</p></div>`;
  }

  function refreshEconomicsDom(report) {
    const econ = calcEconomics(report);
    const pairs = {
      '#econAllIn': fmtMoney(econ.allIn), '#econGross': fmtMoney(econ.projectedGross),
      '#econMargin': econ.margin == null ? '—' : `${econ.margin.toFixed(1)}%`, '#econMaxBid': fmtMoney(econ.maxBid),
      '#econMmrSpread': fmtMoney(econ.mmrSpread), '#econReconUsed': fmtMoney(econ.recon),
      '#econTargetGross': fmtMoney(econ.targetGross), '#econFixed': fmtMoney(econ.fixedBeyondPurchase)
    };
    Object.entries(pairs).forEach(([sel, value]) => { const el = $(sel); if (el) el.textContent = value; });
    const s = $('#economicsStatus'); if (s) s.innerHTML = economicsStatusHtml(econ);
    const rtb = $('#reconTotalBadge'); if (rtb) rtb.textContent = fmtMoney(reconTotal(report) || 0);
  }

  function inspectionRows(report) {
    return report.inspection.map(i => `
      <div class="check-row" data-inspection-id="${escapeHtml(i.id)}">
        <div class="check-label">${escapeHtml(i.label)}</div>
        <select data-inspection-status="${escapeHtml(i.id)}">
          <option value="not_checked" ${i.status === 'not_checked' ? 'selected' : ''}>Not checked</option>
          <option value="pass" ${i.status === 'pass' ? 'selected' : ''}>Pass</option>
          <option value="attention" ${i.status === 'attention' ? 'selected' : ''}>Attention</option>
          <option value="fail" ${i.status === 'fail' ? 'selected' : ''}>Fail</option>
        </select>
        <input data-inspection-note="${escapeHtml(i.id)}" placeholder="Optional note" value="${escapeHtml(i.note || '')}" />
      </div>`).join('');
  }

  function inspectionBadges(report) {
    const s = inspectionSummary(report);
    return `<div class="checklist-summary"><span class="badge ok">${s.pass} PASS</span><span class="badge warn">${s.attention} ATTENTION</span><span class="badge bad">${s.fail} FAIL</span><span class="badge neutral">${s.not_checked} OPEN</span></div>`;
  }

  function reconRows(report) {
    return report.reconItems.map(i => `
      <tr data-recon-id="${escapeHtml(i.id)}">
        <td><input data-recon-item="${escapeHtml(i.id)}" value="${escapeHtml(i.item || '')}" placeholder="Recon item" /></td>
        <td><select data-recon-status="${escapeHtml(i.id)}"><option value="planned" ${i.status === 'planned' ? 'selected' : ''}>Planned</option><option value="done" ${i.status === 'done' ? 'selected' : ''}>Done</option><option value="not_needed" ${i.status === 'not_needed' ? 'selected' : ''}>Not needed</option></select></td>
        <td class="recon-cost"><input data-recon-cost="${escapeHtml(i.id)}" inputmode="decimal" placeholder="0" value="${escapeHtml(i.cost || '')}" /></td>
        <td><button class="icon-btn" data-recon-delete="${escapeHtml(i.id)}" title="Remove">×</button></td>
      </tr>`).join('');
  }

  function bindVinReportEvents(report) {
    const bindings = {
      '#stageInput':'stage', '#stockNumberInput':'stockNumber', '#odometerInput':'odometer', '#mmrInput':'mmr',
      '#estimatedRetailInput':'estimatedRetail', '#targetGrossInput':'targetGross', '#auctionPriceInput':'auctionPrice',
      '#auctionFeesInput':'auctionFees', '#transportInput':'transport', '#reconEstimateInput':'reconEstimate',
      '#otherCostsInput':'otherCosts', '#sellerInput':'seller', '#laneRunInput':'laneRun', '#titleStatusSelect':'titleStatus',
      '#nicbStatusSelect':'nicbStatus', '#auctionPhotosSelect':'auctionPhotos', '#titleDetailInput':'titleDetail',
      '#auctionAnnouncementsInput':'auctionAnnouncements', '#conditionNotesInput':'conditionNotes'
    };
    Object.entries(bindings).forEach(([selector, key]) => {
      const el = $(selector); if (!el) return;
      const event = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(event, e => {
        report.deal = reportDeal(report);
        report.deal[key] = e.target.value;
        report.updatedAt = new Date().toISOString();
        if (['mmr','estimatedRetail','targetGross','auctionPrice','auctionFees','transport','reconEstimate','otherCosts'].includes(key)) refreshEconomicsDom(report);
      });
    });
    $('#vinNotes')?.addEventListener('input', e => { report.notes = e.target.value; report.updatedAt = new Date().toISOString(); });

    $$('[data-inspection-status]').forEach(el => el.addEventListener('change', e => {
      const item = report.inspection.find(i => i.id === e.target.dataset.inspectionStatus);
      if (item) item.status = e.target.value;
      const wrap = $('#inspectionSummaryBadges'); if (wrap) wrap.innerHTML = inspectionBadges(report);
    }));
    $$('[data-inspection-note]').forEach(el => el.addEventListener('input', e => {
      const item = report.inspection.find(i => i.id === e.target.dataset.inspectionNote);
      if (item) item.note = e.target.value;
    }));

    bindReconEvents(report);
    $('#addReconBtn')?.addEventListener('click', () => {
      report.reconItems.push({ id: uid(), item: '', status: 'planned', cost: '' });
      renderReconOnly(report);
    });

    $('#saveVinBtn')?.addEventListener('click', () => saveVinReport(report));
    $('#printVinBtn')?.addEventListener('click', () => window.print());
    $('#exportVinBtn')?.addEventListener('click', () => {
      syncReportFromDom(report);
      downloadJson(`rodeocheck-${report.vin}.json`, report);
    });
    $('#shareVinBtn')?.addEventListener('click', () => shareVinReport(report));
  }

  function bindReconEvents(report) {
    $$('[data-recon-item]').forEach(el => el.addEventListener('input', e => {
      const item = report.reconItems.find(i => i.id === e.target.dataset.reconItem); if (item) item.item = e.target.value;
    }));
    $$('[data-recon-status]').forEach(el => el.addEventListener('change', e => {
      const item = report.reconItems.find(i => i.id === e.target.dataset.reconStatus); if (item) item.status = e.target.value;
    }));
    $$('[data-recon-cost]').forEach(el => el.addEventListener('input', e => {
      const item = report.reconItems.find(i => i.id === e.target.dataset.reconCost); if (item) item.cost = e.target.value;
      refreshEconomicsDom(report);
    }));
    $$('[data-recon-delete]').forEach(el => el.addEventListener('click', e => {
      report.reconItems = report.reconItems.filter(i => i.id !== e.currentTarget.dataset.reconDelete);
      renderReconOnly(report);
    }));
  }

  function renderReconOnly(report) {
    const tbody = $('#reconRows');
    if (tbody) tbody.innerHTML = reconRows(report);
    bindReconEvents(report);
    refreshEconomicsDom(report);
  }

  function syncReportFromDom(report) {
    if (!report) return;
    const fields = {
      stage:'#stageInput', stockNumber:'#stockNumberInput', odometer:'#odometerInput', mmr:'#mmrInput', estimatedRetail:'#estimatedRetailInput',
      targetGross:'#targetGrossInput', auctionPrice:'#auctionPriceInput', auctionFees:'#auctionFeesInput', transport:'#transportInput',
      reconEstimate:'#reconEstimateInput', otherCosts:'#otherCostsInput', seller:'#sellerInput', laneRun:'#laneRunInput',
      titleStatus:'#titleStatusSelect', nicbStatus:'#nicbStatusSelect', auctionPhotos:'#auctionPhotosSelect', titleDetail:'#titleDetailInput',
      auctionAnnouncements:'#auctionAnnouncementsInput', conditionNotes:'#conditionNotesInput'
    };
    report.deal = reportDeal(report);
    Object.entries(fields).forEach(([key, selector]) => { const el = $(selector); if (el) report.deal[key] = el.value; });
    if ($('#vinNotes')) report.notes = $('#vinNotes').value;
    report.updatedAt = new Date().toISOString();
  }

  function saveVinReport(report, silent = false) {
    if (!report) return;
    syncReportFromDom(report);
    const existing = store.reports.findIndex(x => x.vin === report.vin);
    const copy = clone(report);
    if (existing >= 0) store.reports[existing] = copy;
    else store.reports.unshift(copy);
    store.reports.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    store.reports = store.reports.slice(0, 500);
    persist();
    if (!silent) toast('Vehicle report saved locally.');
  }

  function vehicleName(report) {
    const d = report?.decode || {};
    return [d.ModelYear, titleCase(d.Make), titleCase(d.Model), d.Trim].filter(Boolean).join(' ') || report?.vin || 'Vehicle';
  }

  async function shareVinReport(report) {
    syncReportFromDom(report);
    const econ = calcEconomics(report);
    const inspect = inspectionSummary(report);
    const deal = reportDeal(report);
    const lines = [
      `RodeoCheck — ${vehicleName(report)}`,
      `VIN: ${report.vin}`,
      deal.stockNumber ? `Stock #: ${deal.stockNumber}` : '',
      deal.seller ? `Auction/Seller: ${deal.seller}${deal.laneRun ? ` • ${deal.laneRun}` : ''}` : '',
      deal.odometer ? `Miles: ${fmtNumber(deal.odometer)}` : '',
      `MMR: ${fmtMoney(econ.mmr)}`,
      `Bid/Purchase: ${fmtMoney(econ.purchase)}`,
      `All-in acquisition: ${fmtMoney(econ.allIn)}`,
      `Estimated retail: ${fmtMoney(econ.retail)}`,
      `Projected gross: ${fmtMoney(econ.projectedGross)}`,
      `Max bid at ${fmtMoney(econ.targetGross)} target gross: ${fmtMoney(econ.maxBid)}`,
      `Inspection: ${inspect.fail} fail • ${inspect.attention} attention • ${inspect.not_checked} not checked`,
      `Title/NMVTIS: ${deal.titleStatus.replaceAll('_',' ')}`,
      `NICB: ${deal.nicbStatus.replaceAll('_',' ')}`,
      report.notes ? `Notes: ${report.notes}` : ''
    ].filter(Boolean);
    const text = lines.join('\n');
    try {
      if (navigator.share) await navigator.share({ title: `RodeoCheck ${report.vin}`, text });
      else { await copyText(text); toast('Vehicle summary copied.'); }
    } catch (_) {}
  }

  function renderRecall(r) {
    const summary = r.Summary || 'No summary provided.';
    const consequence = r.Consequence ? ` ${r.Consequence}` : '';
    return `<article class="recall-item"><h4>${escapeHtml(r.Component || 'Recall')} — ${escapeHtml(r.NHTSACampaignNumber || '')}</h4><div class="recall-meta">Reported ${escapeHtml(r.ReportReceivedDate || 'date unavailable')}</div><p>${escapeHtml((summary + consequence).slice(0, 760))}</p></article>`;
  }

  function renderComplaint(c) {
    const issue = c.components || c.Components || c.Component || 'Consumer complaint';
    const date = c.dateOfIncident || c.DateOfIncident || c.dateComplaintFiled || c.DateComplaintFiled || '';
    const summary = c.summary || c.Summary || c.description || c.Description || 'No summary provided.';
    return `<article class="complaint-item"><h4>${escapeHtml(issue)}</h4><div class="recall-meta">${escapeHtml(date ? `Reported ${date}` : 'NHTSA consumer complaint')}</div><p>${escapeHtml(String(summary).slice(0, 760))}</p></article>`;
  }

  // VIN photo OCR.
  $('#vinPhotoInput')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.Tesseract) { toast('OCR library is still loading. Try again in a moment.'); return; }
    $('#vinStatus').textContent = 'Reading VIN photo…';
    try {
      const { data } = await Tesseract.recognize(file, 'eng', { logger: () => {} });
      const text = (data.text || '').toUpperCase();
      const compact = text.replace(/[^A-Z0-9]/g, '');
      const direct = compact.match(/[A-HJ-NPR-Z0-9]{17}/g) || [];
      const lineCandidates = text.split(/\s+/).map(normalizeVin).filter(v => v.length === 17);
      const candidates = [...new Set([...direct, ...lineCandidates])];
      const valid = candidates.find(validCheckDigit) || candidates[0];
      if (!valid) throw new Error('No 17-character VIN found. Try a tighter, clearer photo of the VIN label.');
      $('#vinInput').value = valid;
      $('#vinStatus').textContent = `Found ${valid}`;
      toast('VIN extracted. Tap Check to build the report.');
    } catch (err) {
      $('#vinStatus').textContent = 'Could not read VIN photo.';
      toast(err.message || 'VIN OCR failed.');
    }
  });

  // Contract OCR.
  $('#contractImageInput')?.addEventListener('change', e => {
    currentContractFiles = Array.from(e.target.files || []).slice(0, 12);
    const grid = $('#contractPreviewGrid');
    grid.innerHTML = '';
    if (!currentContractFiles.length) { grid.classList.add('hidden'); return; }
    currentContractFiles.forEach((file, idx) => {
      const img = document.createElement('img');
      img.alt = `Document page ${idx + 1}`;
      img.src = URL.createObjectURL(file);
      grid.appendChild(img);
    });
    grid.classList.remove('hidden');
    toast(`${currentContractFiles.length} image${currentContractFiles.length === 1 ? '' : 's'} ready for OCR.`);
  });

  $('#ocrBtn')?.addEventListener('click', runContractOcr);
  async function runContractOcr() {
    if (!currentContractFiles.length) { toast('Take or choose at least one document photo first.'); return; }
    if (!window.Tesseract) { toast('OCR library is still loading. Try again in a moment.'); return; }
    $('#ocrProgressWrap').classList.remove('hidden');
    $('#ocrProgress').style.width = '2%';
    try {
      const lang = store.settings.language === 'es' ? 'eng+spa' : 'eng';
      const pages = [];
      for (let i = 0; i < currentContractFiles.length; i++) {
        const { data } = await Tesseract.recognize(currentContractFiles[i], lang, {
          logger: m => {
            if (m.status === 'recognizing text') {
              const overall = Math.round(((i + (m.progress || 0)) / currentContractFiles.length) * 100);
              $('#ocrProgress').style.width = `${Math.max(2, overall)}%`;
              $('#ocrProgressText').textContent = `Reading page ${i + 1} of ${currentContractFiles.length}… ${overall}%`;
            }
          }
        });
        pages.push(`--- PAGE ${i + 1} ---\n${data.text || ''}`);
      }
      $('#contractText').value = pages.join('\n\n');
      $('#ocrProgressText').textContent = `OCR complete — ${currentContractFiles.length} page${currentContractFiles.length === 1 ? '' : 's'}.`;
      $('#ocrProgress').style.width = '100%';
      toast('Text extracted. Review it, then tap Analyze charges.');
    } catch (err) {
      toast(`OCR failed: ${err.message || err}`);
    }
  }

  const feeRules = [
    { key:'doc', re:/(doc(?:umentary)?\s*(?:fee)?|dealer\s+doc|documentation|dealer\s+admin)/i, label:'Documentary / dealer admin fee', type:'doc' },
    { key:'tax', re:/(sales?\s*tax|vehicle\s*tax|estimated\s*tax)/i, label:'Sales tax', type:'government' },
    { key:'title', re:/(title\s*(?:fee)?|registration|license\s*(?:fee|plate)?|dmv|state\s*fee)/i, label:'Title / registration / government fee', type:'government' },
    { key:'gap', re:/(\bgap\b|guaranteed\s+asset|debt\s+cancell)/i, label:'GAP / debt-cancellation product', type:'optional' },
    { key:'warranty', re:/(service\s*contract|extended\s*warranty|vehicle\s*service|protection\s*plan)/i, label:'Service contract / warranty', type:'optional' },
    { key:'etch', re:/(etch|theft\s*(?:guard|protection|deterrent)|vin\s*etch)/i, label:'VIN etch / theft product', type:'optional' },
    { key:'paint', re:/(paint\s*protect|appearance\s*protect|ceramic|fabric\s*protect|interior\s*protect)/i, label:'Appearance protection', type:'optional' },
    { key:'nitrogen', re:/(nitrogen|tire\s*fill)/i, label:'Nitrogen / tire add-on', type:'optional' },
    { key:'prep', re:/(prep(?:aration)?\s*fee|dealer\s*prep|reconditioning|recon\s*fee|make\s*ready)/i, label:'Prep / reconditioning fee', type:'review' },
    { key:'market', re:/(market\s*(?:adjustment|premium)|additional\s+dealer\s+markup|\badm\b)/i, label:'Market adjustment / dealer markup', type:'review' },
    { key:'delivery', re:/(delivery\s*fee|destination\s*fee|transport(?:ation)?\s*fee)/i, label:'Delivery / destination charge', type:'review' },
    { key:'finance', re:/(acquisition\s*fee|finance\s*fee|origination\s*fee)/i, label:'Finance / acquisition fee', type:'review' }
  ];

  $('#analyzeContractBtn')?.addEventListener('click', () => {
    const text = $('#contractText').value.trim();
    if (!text) { toast('Add contract text first.'); return; }
    renderContractAnalysis(analyzeContract(text, store.settings), text);
  });

  function analyzeContract(text, settings) {
    const lines = text.replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
    const items = [];
    const moneyRe = /(?:\$\s*)?(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2})\b/g;

    for (const line of lines) {
      const rule = feeRules.find(r => r.re.test(line));
      if (!rule) continue;
      const amounts = [...line.matchAll(moneyRe)].map(m => Number(m[1].replaceAll(',', ''))).filter(n => Number.isFinite(n) && Math.abs(n) < 1000000);
      if (!amounts.length) continue;
      const amount = Math.abs(amounts.at(-1));
      let rating = 'review';
      let reason = 'Review this charge and confirm what it covers.';
      if (rule.type === 'government') { rating = 'verify'; reason = 'Verify this against the official tax/title/registration amount for the transaction.'; }
      if (rule.type === 'optional') { rating = 'optional'; reason = 'Commonly sold as an optional product. Confirm whether it was affirmatively selected and whether the price is acceptable.'; }
      if (rule.type === 'review') { rating = 'review'; reason = 'Dealer-imposed or transaction-specific charge. Ask what it covers and whether it can be removed or reduced.'; }
      if (rule.type === 'doc') {
        if (settings.state === 'TX') {
          if (amount <= Number(settings.docFeeThreshold || 225)) {
            rating = 'tx-threshold';
            reason = `At or below your Texas review threshold of ${fmtMoney2(settings.docFeeThreshold)}. Still verify disclosure and the total deal economics.`;
          } else {
            rating = 'review';
            reason = `Above your Texas review threshold of ${fmtMoney2(settings.docFeeThreshold)}. Texas treats the configured amount as a presumptively reasonable benchmark, not an automatic legal maximum.`;
          }
        } else {
          rating = 'review';
          reason = 'Documentary-fee rules vary by state. Verify the current rule before treating the charge as permitted or excessive.';
        }
      }
      if (!items.some(x => x.key === rule.key && Math.abs(x.amount - amount) < 0.01)) items.push({ id: uid(), key: rule.key, label: rule.label, type: rule.type, amount, line, rating, reason });
    }

    const aprMatch = text.match(/(?:APR|annual\s+percentage\s+rate)[^\d]{0,24}(\d{1,2}(?:\.\d{1,3})?)\s*%/i);
    const termMatch = text.match(/(?:term|number\s+of\s+payments)[^\d]{0,20}(\d{1,3})\s*(?:months?|payments?)?/i);
    const financeChargeMatch = text.match(/finance\s+charge[^$\d]{0,14}\$?\s*([\d,]+(?:\.\d{2})?)/i);
    const amountFinancedMatch = text.match(/amount\s+financed[^$\d]{0,14}\$?\s*([\d,]+(?:\.\d{2})?)/i);
    const salePriceMatch = text.match(/(?:selling\s+price|cash\s+price|vehicle\s+price)[^$\d]{0,14}\$?\s*([\d,]+(?:\.\d{2})?)/i);
    const downPaymentMatch = text.match(/(?:down\s*payment|cash\s*down|total\s*down)[^$\d]{0,20}\$?\s*([\d,]+(?:\.\d{2})?)/i);
    const paymentMatch = text.match(/(?:monthly\s+payment|payment\s+amount|regular\s+payment|scheduled\s+payment)[^$\d]{0,20}\$?\s*([\d,]+(?:\.\d{2})?)/i);
    const totalPaymentsMatch = text.match(/total\s+of\s+payments[^$\d]{0,20}\$?\s*([\d,]+(?:\.\d{2})?)/i);
    const paymentFrequencyMatch = text.match(/\b(bi[- ]?weekly|weekly|semi[- ]?monthly|monthly)\b/i);

    const amount = m => m ? Number(m[1].replaceAll(',', '')) : null;
    const result = {
      id: uid(), createdAt: new Date().toISOString(), state: settings.state, items,
      apr: aprMatch ? Number(aprMatch[1]) : null,
      term: termMatch ? Number(termMatch[1]) : null,
      financeCharge: amount(financeChargeMatch), amountFinanced: amount(amountFinancedMatch), salePrice: amount(salePriceMatch),
      downPayment: amount(downPaymentMatch), payment: amount(paymentMatch), totalOfPayments: amount(totalPaymentsMatch),
      paymentFrequency: paymentFrequencyMatch ? paymentFrequencyMatch[1].toLowerCase() : null,
      sourceText: text
    };
    result.negotiable = items.filter(x => ['optional', 'review'].includes(x.rating) && x.type !== 'government').reduce((sum, x) => sum + x.amount, 0);
    result.calculatedPaymentTotal = result.payment != null && result.term != null ? result.payment * result.term : null;
    result.estimatedFinanceCost = result.financeCharge != null ? result.financeCharge : (result.totalOfPayments != null && result.amountFinanced != null ? result.totalOfPayments - result.amountFinanced : null);
    return result;
  }

  function ratingBadge(item) {
    const map = { optional:['warn','OPTIONAL / REVIEW'], review:['warn','REVIEW'], verify:['neutral','VERIFY'], 'tx-threshold':['ok','WITHIN TX THRESHOLD'] };
    const [cls, label] = map[item.rating] || ['neutral', 'REVIEW'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function renderContractAnalysis(a, sourceText) {
    const itemsHtml = a.items.length ? a.items.map(i => `<tr><td><strong>${escapeHtml(i.label)}</strong><br><span class="muted">${escapeHtml(i.reason)}</span></td><td>${fmtMoney2(i.amount)}</td><td>${ratingBadge(i)}</td></tr>`).join('') : `<tr><td colspan="3">No common fee lines were confidently detected. OCR may need cleanup; edit the text and analyze again.</td></tr>`;
    const contextBits = [
      a.salePrice != null ? `Selling price ${fmtMoney2(a.salePrice)}` : '',
      a.downPayment != null ? `Down ${fmtMoney2(a.downPayment)}` : '',
      a.apr != null ? `APR ${a.apr}%` : '',
      a.term ? `${a.term} term/payments detected` : '',
      a.payment != null ? `Payment ${fmtMoney2(a.payment)}${a.paymentFrequency ? ` ${a.paymentFrequency}` : ''}` : '',
      a.amountFinanced != null ? `Amount financed ${fmtMoney2(a.amountFinanced)}` : '',
      a.financeCharge != null ? `Finance charge ${fmtMoney2(a.financeCharge)}` : '',
      a.totalOfPayments != null ? `Total payments ${fmtMoney2(a.totalOfPayments)}` : ''
    ].filter(Boolean);
    const script = buildScript(a);
    $('#contractAnalysis').innerHTML = `
      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">ANALYSIS</span><h3>${a.items.length} charge${a.items.length === 1 ? '' : 's'} identified</h3></div></div>
        ${contextBits.length ? `<div class="alert-card blue"><h4>Finance / deal context detected</h4><p>${escapeHtml(contextBits.join(' • '))}</p></div>` : ''}
        <div class="metric-strip four">
          <div class="metric-mini"><span>Review amount</span><strong>${fmtMoney2(a.negotiable)}</strong></div>
          <div class="metric-mini"><span>Amount financed</span><strong>${fmtMoney2(a.amountFinanced)}</strong></div>
          <div class="metric-mini"><span>Finance cost</span><strong>${fmtMoney2(a.estimatedFinanceCost)}</strong></div>
          <div class="metric-mini"><span>Payment × term</span><strong>${fmtMoney2(a.calculatedPaymentTotal)}</strong></div>
        </div>
        <div class="table-scroll"><table class="fee-table"><thead><tr><th>Charge</th><th>Amount</th><th>Flag</th></tr></thead><tbody>${itemsHtml}</tbody></table></div>
        <p class="disclaimer">This is a screening tool, not legal advice. OCR can misread numbers and state-law treatment depends on the exact transaction and disclosures. Compare extracted values to the document and verify important fees against current official rules.</p>
      </section>
      <section class="panel">
        <div class="section-head"><div><span class="eyebrow">QUESTIONS</span><h3>Script for reviewing the deal</h3></div></div>
        <div class="script-box">${escapeHtml(script)}</div>
        <div class="button-row"><button id="copyScriptBtn" class="primary-btn">Copy script</button><button id="saveContractBtn" class="secondary-btn">Save analysis</button><button id="exportContractBtn" class="secondary-btn">Export JSON</button></div>
      </section>`;
    a.script = script;
    a.sourceText = sourceText;
    $('#copyScriptBtn')?.addEventListener('click', async () => { await copyText(script); toast('Script copied.'); });
    $('#saveContractBtn')?.addEventListener('click', () => saveContract(a));
    $('#exportContractBtn')?.addEventListener('click', () => downloadJson(`rodeocheck-contract-${new Date().toISOString().slice(0, 10)}.json`, a));
  }

  function buildScript(a) {
    const opt = a.items.filter(x => x.rating === 'optional');
    const review = a.items.filter(x => x.rating === 'review');
    const doc = a.items.find(x => x.key === 'doc');
    if (store.settings.language === 'es') {
      const chunks = ['Quiero revisar el precio total y cada cargo antes de firmar.'];
      if (opt.length) chunks.push(`Por favor eliminen o explíquenme claramente estos productos opcionales: ${opt.map(x => `${x.label} (${fmtMoney2(x.amount)})`).join(', ')}.`);
      if (review.length) chunks.push(`También quiero una explicación y la opción de reducir o eliminar estos cargos: ${review.map(x => `${x.label} (${fmtMoney2(x.amount)})`).join(', ')}.`);
      if (doc && a.state === 'TX') chunks.push(`Para el cargo documental de ${fmtMoney2(doc.amount)}, muéstrenme la divulgación correspondiente y confirmen la base del cargo.`);
      chunks.push('Después de cualquier cambio, por favor entréguenme un precio final actualizado y desglosado antes de que firme.');
      return chunks.join('\n\n');
    }
    const chunks = ['I want to review the complete out-the-door deal and each charge before I sign.'];
    if (opt.length) chunks.push(`Please remove or clearly explain these optional products: ${opt.map(x => `${x.label} (${fmtMoney2(x.amount)})`).join(', ')}.`);
    if (review.length) chunks.push(`I also want an explanation of, and the option to reduce or remove, these charges: ${review.map(x => `${x.label} (${fmtMoney2(x.amount)})`).join(', ')}.`);
    if (doc && a.state === 'TX') chunks.push(`For the documentary fee of ${fmtMoney2(doc.amount)}, please show me the required disclosure and explain the basis for the amount.`);
    chunks.push('Then please give me an updated itemized out-the-door figure showing only the products and fees I actually agreed to before I sign anything.');
    return chunks.join('\n\n');
  }

  function saveContract(a) {
    const copy = clone(a);
    const existing = store.contracts.findIndex(c => c.id === copy.id);
    if (existing >= 0) store.contracts[existing] = copy; else store.contracts.unshift(copy);
    store.contracts = store.contracts.slice(0, 300);
    persist();
    toast('Contract analysis saved locally.');
  }

  // Reports screen.
  $$('[data-saved-tab]').forEach(btn => btn.addEventListener('click', () => {
    savedTab = btn.dataset.savedTab;
    $$('[data-saved-tab]').forEach(x => x.classList.toggle('active', x === btn));
    $('#savedVehicleTools')?.classList.toggle('hidden', savedTab !== 'vin');
    renderSaved();
  }));
  $('#savedSearch')?.addEventListener('input', renderSaved);
  $('#exportInventoryCsvBtn')?.addEventListener('click', exportInventoryCsv);

  function renderSaved() {
    const el = $('#savedContent');
    if (!el) return;
    if (savedTab === 'vin') {
      const q = ($('#savedSearch')?.value || '').trim().toLowerCase();
      const reports = store.reports.filter(r => {
        if (!q) return true;
        const d = r.decode || {}; const deal = reportDeal(r);
        return [r.vin, d.ModelYear, d.Make, d.Model, d.Trim, deal.seller, deal.laneRun, deal.stockNumber, deal.stage].join(' ').toLowerCase().includes(q);
      });
      if (!reports.length) { el.innerHTML = '<div class="empty-state">No matching vehicle reports.</div>'; return; }
      el.innerHTML = reports.map(r => {
        const econ = calcEconomics(r); const s = inspectionSummary(r); const deal = reportDeal(r);
        return `<article class="saved-card"><div><h4>${escapeHtml(vehicleName(r))}</h4><p>${escapeHtml(r.vin)}${deal.stockNumber ? ` • Stock ${escapeHtml(deal.stockNumber)}` : ''}<br>${escapeHtml(deal.seller || 'Auction not entered')}${deal.laneRun ? ` • ${escapeHtml(deal.laneRun)}` : ''}<br><span class="saved-finance">All-in ${fmtMoney(econ.allIn)} • Gross ${fmtMoney(econ.projectedGross)}</span> • ${s.fail} fail / ${s.attention} attention</p></div><div class="card-actions"><button class="icon-btn" data-open-vin="${escapeHtml(r.id)}" title="Open">↗</button><button class="icon-btn" data-del-vin="${escapeHtml(r.id)}" title="Delete">×</button></div></article>`;
      }).join('');
      $$('[data-open-vin]').forEach(b => b.addEventListener('click', () => {
        const r = store.reports.find(x => x.id === b.dataset.openVin);
        if (r) { currentVinReport = normalizeReport(clone(r)); $('#vinInput').value = r.vin; renderVinReport(currentVinReport); go('vin'); }
      }));
      $$('[data-del-vin]').forEach(b => b.addEventListener('click', () => {
        if (confirm('Delete this saved vehicle report?')) { store.reports = store.reports.filter(x => x.id !== b.dataset.delVin); persist(); renderSaved(); }
      }));
    } else {
      if (!store.contracts.length) { el.innerHTML = '<div class="empty-state">No contract analyses saved yet.</div>'; return; }
      el.innerHTML = store.contracts.map(c => `<article class="saved-card"><div><h4>${c.items?.length || 0} charges • ${fmtMoney2(c.negotiable || 0)} to review</h4><p>${escapeHtml(fmtDate(c.createdAt))}<br>${escapeHtml(c.state || 'Generic')} analysis</p></div><div class="card-actions"><button class="icon-btn" data-open-contract="${escapeHtml(c.id)}">↗</button><button class="icon-btn" data-del-contract="${escapeHtml(c.id)}">×</button></div></article>`).join('');
      $$('[data-open-contract]').forEach(b => b.addEventListener('click', () => {
        const c = store.contracts.find(x => x.id === b.dataset.openContract);
        if (c) { $('#contractText').value = c.sourceText || ''; renderContractAnalysis(c, c.sourceText || ''); go('contract'); }
      }));
      $$('[data-del-contract]').forEach(b => b.addEventListener('click', () => {
        if (confirm('Delete this saved contract analysis?')) { store.contracts = store.contracts.filter(x => x.id !== b.dataset.delContract); persist(); renderSaved(); }
      }));
    }
  }

  function exportInventoryCsv() {
    if (!store.reports.length) { toast('No vehicle reports to export.'); return; }
    const headers = ['VIN','Vehicle','Stage','Stock #','Auction/Seller','Lane/Run','Odometer','MMR','Purchase/Bid','Auction Fees','Transport','Recon Used','Other Costs','All-In Cost','Estimated Retail','Projected Gross','Gross Margin %','Target Gross','Max Bid at Target','Title Status','NICB Status','Inspection Fails','Inspection Attention','Notes'];
    const rows = store.reports.map(r => {
      const d = reportDeal(r); const e = calcEconomics(r); const s = inspectionSummary(r);
      return [r.vin, vehicleName(r), d.stage, d.stockNumber, d.seller, d.laneRun, d.odometer, e.mmr, e.purchase, e.fees, e.transport, e.recon, e.other, e.allIn, e.retail, e.projectedGross, e.margin == null ? '' : e.margin.toFixed(1), e.targetGross, e.maxBid, d.titleStatus, d.nicbStatus, s.fail, s.attention, r.notes];
    });
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    downloadBlob(`rodeocheck-inventory-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function refreshHome() {
    $('#homeReportCount').textContent = store.reports.length;
    $('#homeContractCount').textContent = store.contracts.length;
    const economics = store.reports.map(r => ({ r, e: calcEconomics(r) })).filter(x => x.e.allIn != null || x.e.retail != null);
    const targetCount = economics.filter(x => x.e.targetMet === true).length;
    $('#homeTargetCount').textContent = targetCount;
    const totalCost = economics.reduce((s, x) => s + (x.e.allIn || 0), 0);
    const totalRetail = economics.reduce((s, x) => s + (x.e.retail || 0), 0);
    const validGross = economics.filter(x => x.e.projectedGross != null);
    const totalGross = validGross.reduce((s, x) => s + x.e.projectedGross, 0);
    const avgGross = validGross.length ? totalGross / validGross.length : null;
    const portfolio = $('#portfolioMetrics');
    if (portfolio) portfolio.innerHTML = `
      <div class="metric-mini"><span>Total planned cost</span><strong>${fmtMoney(totalCost || null)}</strong></div>
      <div class="metric-mini"><span>Projected retail</span><strong>${fmtMoney(totalRetail || null)}</strong></div>
      <div class="metric-mini"><span>Projected gross</span><strong>${validGross.length ? fmtMoney(totalGross) : '—'}</strong></div>
      <div class="metric-mini"><span>Avg gross / unit</span><strong>${fmtMoney(avgGross)}</strong></div>`;

    const recent = store.reports.slice(0, 4);
    $('#recentReports').innerHTML = recent.length ? recent.map(r => {
      const e = calcEconomics(r); const d = reportDeal(r);
      return `<article class="saved-card"><div><h4>${escapeHtml(vehicleName(r))}</h4><p>${escapeHtml(r.vin)}${d.laneRun ? ` • ${escapeHtml(d.laneRun)}` : ''}<br>All-in ${fmtMoney(e.allIn)} • Gross ${fmtMoney(e.projectedGross)}</p></div><button class="icon-btn" data-home-open="${escapeHtml(r.id)}">›</button></article>`;
    }).join('') : 'No saved reports yet.';
    $$('[data-home-open]').forEach(b => b.addEventListener('click', () => {
      const r = store.reports.find(x => x.id === b.dataset.homeOpen);
      if (r) { currentVinReport = normalizeReport(clone(r)); $('#vinInput').value = r.vin; renderVinReport(currentVinReport); go('vin'); }
    }));
  }

  // Settings + backup.
  function hydrateSettings() {
    $('#stateSelect').value = store.settings.state;
    $('#languageSelect').value = store.settings.language;
    $('#docFeeThreshold').value = store.settings.docFeeThreshold;
    $('#defaultTargetGross').value = store.settings.defaultTargetGross;
    $('#autoSaveToggle').checked = !!store.settings.autoSave;
  }

  $('#saveSettingsBtn')?.addEventListener('click', () => {
    store.settings.state = $('#stateSelect').value;
    store.settings.language = $('#languageSelect').value;
    store.settings.docFeeThreshold = Number($('#docFeeThreshold').value || 225);
    store.settings.defaultTargetGross = Number($('#defaultTargetGross').value || 4000);
    store.settings.autoSave = $('#autoSaveToggle').checked;
    persist();
    toast('Settings saved.');
  });

  $('#backupBtn')?.addEventListener('click', () => downloadJson(`rodeocheck-backup-${new Date().toISOString().slice(0,10)}.json`, store));
  $('#restoreInput')?.addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.reports) || !Array.isArray(parsed.contracts)) throw new Error('This does not look like a RodeoCheck backup.');
      if (!confirm(`Restore ${parsed.reports.length} vehicle reports and ${parsed.contracts.length} contract analyses? This will replace the current local RodeoCheck data.`)) return;
      store = {
        ...clone(defaultStore), ...parsed,
        settings: { ...defaultStore.settings, ...(parsed.settings || {}) },
        reports: parsed.reports.map(normalizeReport), contracts: parsed.contracts
      };
      persist(); hydrateSettings(); renderSaved(); toast('Backup restored.');
    } catch (err) { toast(err.message || 'Could not restore backup.'); }
    e.target.value = '';
  });

  $('#clearDataBtn')?.addEventListener('click', () => {
    if (confirm('Erase all RodeoCheck vehicle reports, contract analyses and settings from this browser?')) {
      localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY);
      store = clone(defaultStore);
      hydrateSettings(); refreshHome(); renderSaved(); toast('Local data erased.');
    }
  });

  async function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  function downloadJson(filename, data) { downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json'); }
  function downloadBlob(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  // First render.
  hydrateSettings();
  refreshHome();
})();
