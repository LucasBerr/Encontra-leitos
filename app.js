const DEMO_EMAIL = 'lucas.berr@encontraleitos.demo';
const DEMO_PASSWORD = 'parana2026';
const ORIGIN_CNES = '0015334';
const BED_LABELS = { obstetrico: 'obstétrico', utiAdulto: 'UTI adulto', pediatrico: 'pediátrico' };
const DEMO_PATIENTS = [
  { id: 'demo-001', name: 'Ana Clara Martins', urgency: 'emergencia' },
  { id: 'demo-002', name: 'Bruno Henrique Alves', urgency: 'muito-urgente' },
  { id: 'demo-003', name: 'Camila Souza Ribeiro', urgency: 'urgente' },
  { id: 'demo-004', name: 'Daniela Costa Lima', urgency: 'pouco-urgente' },
  { id: 'demo-005', name: 'Eduardo Ferreira Santos', urgency: 'nao-urgente' },
];
const URGENCY_LEVELS = {
  emergencia: { label: 'Emergência', description: 'Atendimento imediato · risco de morte', className: 'urgency-emergency' },
  'muito-urgente': { label: 'Muito urgente', description: 'Caso grave · risco significativo de evolução', className: 'urgency-very-urgent' },
  urgente: { label: 'Urgente', description: 'Gravidade moderada · sem risco imediato', className: 'urgency-urgent' },
  'pouco-urgente': { label: 'Pouco urgente', description: 'Atendimento preferencial', className: 'urgency-low' },
  'nao-urgente': { label: 'Não urgente', description: 'Atendimento programado ou em unidade próxima', className: 'urgency-non-urgent' },
};
const PARANA_BOUNDS = [[-26.75, -54.65], [-22.48, -48.02]];
const appState = {
  hospitals: [],
  operations: new Map(),
  metadata: {},
  origin: null,
  selectedDestination: null,
  selectedPatient: null,
  selectedBed: 'obstetrico',
  map: null,
  cluster: null,
  markers: new Map(),
  originMarker: null,
  destinationMarker: null,
  routeLine: null,
  reserved: false,
  transport: 'ambulancia',
  toastTimer: null,
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

function showScreen(id) {
  $$('.screen').forEach((screen) => screen.classList.toggle('hidden', screen.id !== id));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatFacilityName(value) {
  const smallWords = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'em']);
  const acronyms = new Set(['HNSG', 'HUEC', 'HUOP', 'HURCG', 'HUM', 'HRS', 'HSA', 'UPA', 'SUS', 'UTI']);
  return String(value || '').toLocaleLowerCase('pt-BR').replace(/(^|[\s/-])([\p{L}\d]+)/gu, (match, boundary, word) => {
    const upper = word.toLocaleUpperCase('pt-BR');
    if (acronyms.has(upper)) return boundary + upper;
    if (boundary && smallWords.has(word)) return boundary + word;
    return boundary + word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1);
  });
}

function getOperation(hospital) {
  return appState.operations.get(hospital.cnes) || { available: {} };
}

function bedCount(hospital, type = appState.selectedBed) {
  return Number(hospital.beds?.[type] || 0);
}

function availability(hospital, type = appState.selectedBed) {
  return Number(getOperation(hospital).available?.[type] || 0);
}

function distanceKm(a, b) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDistance(hospital) {
  const distance = distanceKm(appState.origin, hospital);
  if (distance < 1) return '<1 km';
  return `~${Math.round(distance)} km`;
}

function displayCount(number) {
  return new Intl.NumberFormat('pt-BR').format(number);
}

function updateAvailabilityStat() {
  const count = appState.hospitals.filter((hospital) => availability(hospital) > 0).length;
  $('#statAvailable').textContent = displayCount(count);
}

async function loadData() {
  const [hospitalResponse, operationResponse] = await Promise.all([
    fetch('data/hospitals-pr.json'),
    fetch('data/demo-operations.json'),
  ]);
  if (!hospitalResponse.ok || !operationResponse.ok) throw new Error('Não foi possível carregar os dados locais.');
  const hospitalData = await hospitalResponse.json();
  const operationData = await operationResponse.json();
  appState.hospitals = hospitalData.hospitals || [];
  appState.metadata = hospitalData.metadata || {};
  appState.operations = new Map((operationData.hospitals || []).map((item) => [item.cnes, item]));
  appState.origin = appState.hospitals.find((item) => item.cnes === ORIGIN_CNES) || appState.hospitals[0];
  const municipalities = new Set(appState.hospitals.map((item) => item.municipalityCode));
  $('#loginHospitalCount').textContent = displayCount(appState.hospitals.length);
  $('#loginMunicipalityCount').textContent = displayCount(municipalities.size);
  $('#homeHospitalCount').textContent = `${displayCount(appState.hospitals.length)} hospitais`;
  $('#statHospitals').textContent = displayCount(appState.hospitals.length);
  $('#navHospitalCount').textContent = displayCount(appState.hospitals.length);
  $('#mapCount').textContent = `${displayCount(appState.hospitals.length)} unidades`;
  updateAvailabilityStat();
}

function showLoginError(message = '') {
  $('#loginError').textContent = message;
}

function login(email, password) {
  if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    showLoginError('E-mail ou senha não conferem com as credenciais de demonstração.');
    return;
  }
  sessionStorage.setItem('encontra-demo-user', 'lucas');
  showLoginError('');
  showScreen('homeScreen');
}

function logout() {
  sessionStorage.removeItem('encontra-demo-user');
  closeAllocationModal();
  showScreen('loginScreen');
  $('#password').value = '';
}

function openHome() {
  showScreen('homeScreen');
}

function openEncontra() {
  showScreen('appScreen');
  setTimeout(() => {
    if (!appState.map) initializeMap();
    else appState.map.invalidateSize();
    renderResults();
    renderMap();
  }, 80);
}

function initializeMap() {
  const mapEl = $('#map');
  if (!window.L || !mapEl) {
    mapEl.innerHTML = '<div class="map-fallback"><strong>Mapa indisponível</strong><span>Conecte-se à internet para carregar a camada cartográfica.</span></div>';
    return;
  }
  appState.map = L.map(mapEl, { zoomControl: false, scrollWheelZoom: true, preferCanvas: true, zoomSnap: 0.25 });
  appState.map.fitBounds(PARANA_BOUNDS, { padding: [20, 20] });
  L.control.zoom({ position: 'bottomright' }).addTo(appState.map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(appState.map);
  appState.cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 42,
    iconCreateFunction(cluster) {
      return L.divIcon({
        html: `<div>${cluster.getChildCount()}</div>`,
        className: 'marker-cluster marker-cluster-medium',
        iconSize: L.point(34, 34),
      });
    },
  });
  appState.map.addLayer(appState.cluster);
  appState.map.on('popupopen', (event) => {
    const button = event.popup.getElement()?.querySelector('.popup-action');
    button?.addEventListener('click', () => selectDestination(button.dataset.hospital, false));
  });
  renderMap();
}

function markerIcon(hospital) {
  const own = hospital.cnes === ORIGIN_CNES;
  const destination = appState.selectedDestination?.cnes === hospital.cnes;
  const available = availability(hospital) > 0;
  const klass = own ? 'own' : (destination ? 'destination' : (available ? 'available' : ''));
  const html = `<span class="hospital-pin ${klass}" aria-label="${own ? 'Hospital de origem, sua unidade' : (destination ? 'Hospital de destino selecionado' : (available ? 'Vaga demonstrativa' : 'Hospital CNES'))}"></span>`;
  return L.divIcon({ className: 'pin-wrapper', html, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -10] });
}

function renderMap() {
  if (!appState.map || !appState.cluster) return;
  if (appState.originMarker) appState.map.removeLayer(appState.originMarker);
  if (appState.destinationMarker) appState.map.removeLayer(appState.destinationMarker);
  appState.cluster.clearLayers();
  appState.markers.clear();
  appState.originMarker = null;
  appState.destinationMarker = null;
  const search = normalizeText($('#hospitalSearch')?.value || '');
  const bedType = appState.selectedBed;
  for (const hospital of appState.hospitals) {
    const searchText = normalizeText(`${hospital.name} ${hospital.municipality} ${hospital.cnes}`);
    const own = hospital.cnes === ORIGIN_CNES;
    const destination = appState.selectedDestination?.cnes === hospital.cnes;
    if (appState.selectedDestination && !own && !destination) continue;
    if (search && !searchText.includes(search) && !own && !destination) continue;
    const marker = L.marker([hospital.lat, hospital.lon], { icon: markerIcon(hospital), title: `${hospital.name} · ${hospital.municipality}` });
    const avail = availability(hospital, bedType);
    const registered = bedCount(hospital, bedType);
    const label = BED_LABELS[bedType];
    marker.bindPopup(`<div class="map-popup"><strong>${escapeHtml(formatFacilityName(hospital.name))}</strong><span>${escapeHtml(hospital.municipality)} · CNES ${escapeHtml(hospital.cnes)}</span><span>${registered} leitos SUS ${label} cadastrados</span><span>${avail ? `${avail} vaga(s) simulada(s)` : 'Sem vaga sinalizada na simulação'}</span>${own ? '<span class="popup-own">Sua unidade de referência</span>' : `<button class="popup-action" data-hospital="${escapeHtml(hospital.cnes)}">Ver opção demonstrativa</button>`}</div>`);
    appState.markers.set(hospital.cnes, marker);
    if (own) {
      appState.originMarker = marker;
      marker.bindTooltip('Sua unidade · Santa Casa de Curitiba', { permanent: true, direction: 'right', offset: [10, 0], className: 'own-hospital-tooltip' });
    }
    if (own || destination) {
      if (destination) appState.destinationMarker = marker;
      marker.setZIndexOffset(own ? 1000 : 500);
      marker.addTo(appState.map);
    } else appState.cluster.addLayer(marker);
  }
  if (appState.selectedDestination) drawTransferRoute();
  $('#mapCount').textContent = `${displayCount(appState.markers.size)} unidades`;
}

function filteredHospitals() {
  const term = normalizeText($('#hospitalSearch')?.value || '');
  const onlyAvailable = $('#availableOnly')?.checked ?? true;
  return appState.hospitals
    .filter((hospital) => bedCount(hospital) > 0)
    .filter((hospital) => !onlyAvailable || availability(hospital) > 0)
    .filter((hospital) => !term || normalizeText(`${hospital.name} ${hospital.municipality} ${hospital.cnes}`).includes(term))
    .map((hospital) => ({ ...hospital, distance: distanceKm(appState.origin, hospital) }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, 'pt-BR'));
}

function renderResults() {
  if (!appState.origin) return;
  const type = appState.selectedBed;
  const options = filteredHospitals();
  const list = $('#resultsList');
  const label = BED_LABELS[type];
  $('#selectedBedLabel').textContent = label;
  $('#originLabel').textContent = `${formatFacilityName(appState.origin.name)} · ${appState.origin.municipality}`;
  $('#resultCount').textContent = `${displayCount(options.length)} ${options.length === 1 ? 'opção' : 'opções'}`;
  list.innerHTML = '';
  $('#noResults').classList.toggle('hidden', options.length > 0);
  $('#showAllResults').classList.toggle('hidden', !$('#availableOnly').checked);
  options.slice(0, 8).forEach((hospital) => {
    const card = document.createElement('article');
    card.className = `result-card ${appState.selectedDestination?.cnes === hospital.cnes ? 'selected' : ''}`;
    card.innerHTML = `<div class="result-card-top"><i class="availability-dot"></i><div class="result-name"><strong title="${escapeHtml(hospital.name)}">${escapeHtml(formatFacilityName(hospital.name))}</strong><small>${escapeHtml(hospital.municipality)} · CNES ${escapeHtml(hospital.cnes)}</small></div><span class="distance-chip">${hospital.distance < 1 ? '<1 km' : `~${Math.round(hospital.distance)} km`}</span></div><div class="result-bed-row"><span>Leitos SUS ${label} cadastrados</span><strong>${bedCount(hospital)}</strong></div><div class="result-actions"><span class="registered-beds">${availability(hospital)} vaga(s) sinalizada(s) <b>· simulado</b></span><button class="choose-btn" data-select-hospital="${escapeHtml(hospital.cnes)}">Ver e alocar <span>→</span></button></div>`;
    list.appendChild(card);
  });
}

function refreshDashboard() {
  updateAvailabilityStat();
  renderResults();
  renderMap();
}

function selectBedType(type) {
  appState.selectedBed = type;
  refreshDashboard();
}

function urgencyBadge(patient) {
  const urgency = URGENCY_LEVELS[patient.urgency];
  return `<span class="urgency-badge ${urgency.className}">${urgency.label}</span>`;
}

function renderPatientOptions() {
  const term = normalizeText($('#patientSearch').value);
  const matches = DEMO_PATIENTS.filter((patient) => normalizeText(patient.name).includes(term));
  const options = $('#patientOptions');
  options.innerHTML = matches.length
    ? matches.map((patient) => {
      const urgency = URGENCY_LEVELS[patient.urgency];
      return `<button type="button" class="patient-option" data-select-patient="${patient.id}"><span class="patient-option-copy"><strong>${escapeHtml(patient.name)}</strong><small>${urgency.description}</small></span>${urgencyBadge(patient)}</button>`;
    }).join('')
    : '<p class="patient-no-results">Nenhum paciente fictício encontrado com esse nome.</p>';
}

function renderPatientChooser() {
  const searchBlock = $('#patientSearchBlock');
  const selectedCard = $('#selectedPatientCard');
  const patient = appState.selectedPatient;
  searchBlock.classList.toggle('hidden', Boolean(patient));
  selectedCard.classList.toggle('hidden', !patient);
  if (patient) {
    const urgency = URGENCY_LEVELS[patient.urgency];
    selectedCard.innerHTML = `<div class="selected-patient-copy"><span class="eyebrow">PACIENTE SELECIONADO</span><strong>${escapeHtml(patient.name)}</strong><small>${urgency.description}</small></div>${urgencyBadge(patient)}<button type="button" id="changePatient" class="change-patient">Trocar</button>`;
    return;
  }
  renderPatientOptions();
}

function selectDemoPatient(patientId) {
  appState.selectedPatient = DEMO_PATIENTS.find((patient) => patient.id === patientId) || null;
  renderPatientChooser();
  renderReserveStep();
}

function selectDestination(cnes) {
  const hospital = appState.hospitals.find((item) => item.cnes === cnes);
  if (!hospital || hospital.cnes === ORIGIN_CNES) return;
  if (appState.selectedDestination?.cnes !== hospital.cnes) appState.selectedPatient = null;
  appState.selectedDestination = hospital;
  renderResults();
  renderMap();
  $('#resultsPanel').classList.add('hidden');
  $('#allocationPanel').classList.remove('hidden');
  $('#transferOriginName').textContent = formatFacilityName(appState.origin.name);
  $('#transferOriginCity').textContent = `${appState.origin.municipality} · CNES ${appState.origin.cnes}`;
  $('#transferDestinationName').textContent = formatFacilityName(hospital.name);
  $('#transferDestinationCity').textContent = `${hospital.municipality} · CNES ${hospital.cnes}`;
  $('#transferDistance').textContent = `${formatDistance(hospital)} em linha reta`;
  focusTransferMap();
  renderPatientChooser();
  renderReserveStep();
}

function focusTransferMap() {
  if (!appState.map || !appState.origin || !appState.selectedDestination) return;
  const bounds = L.latLngBounds(
    [appState.origin.lat, appState.origin.lon],
    [appState.selectedDestination.lat, appState.selectedDestination.lon],
  );
  appState.map.fitBounds(bounds, { padding: [54, 54], maxZoom: 14, animate: true });
}

function drawTransferRoute() {
  if (!appState.map || !appState.origin || !appState.selectedDestination) return;
  if (appState.routeLine) appState.map.removeLayer(appState.routeLine);
  appState.routeLine = L.polyline(
    [[appState.origin.lat, appState.origin.lon], [appState.selectedDestination.lat, appState.selectedDestination.lon]],
    { color: '#bd5360', weight: 2.5, opacity: 0.82, dashArray: '7 7', lineCap: 'round', interactive: false },
  ).addTo(appState.map);
}

function modalHeader(step, title, body) {
  const done = step > 1;
  return `<span class="modal-kicker"><i></i> FLUXO DEMONSTRATIVO</span><h2 id="allocationStepTitle">${title}</h2><p>${body}</p><div class="stepper"><div class="stepper-step ${step === 1 ? 'active' : 'done'}"><span>${done ? '✓' : '1'}</span> Reserva</div><i class="stepper-line"></i><div class="stepper-step ${step === 2 ? 'active' : (step > 2 ? 'done' : '')}"><span>${step > 2 ? '✓' : '2'}</span> Transporte</div><i class="stepper-line"></i><div class="stepper-step ${step === 3 ? 'active' : ''}"><span>3</span> Confirmação</div></div>`;
}

function destinationSummary(hospital) {
  return `<div class="destination-summary"><span class="destination-icon">✚</span><div><strong>${escapeHtml(formatFacilityName(hospital.name))}</strong><small>${escapeHtml(hospital.municipality)} · CNES ${escapeHtml(hospital.cnes)}</small></div><span class="distance-chip">${formatDistance(hospital)}</span></div>`;
}

function renderReserveStep() {
  const hospital = appState.selectedDestination;
  const label = BED_LABELS[appState.selectedBed];
  const patientHint = appState.selectedPatient ? '' : '<div class="patient-required-note">Busque e selecione um paciente fictício para continuar.</div>';
  $('#allocationContent').innerHTML = `${modalHeader(1, 'Indicar esta unidade', 'Confira a origem e o destino antes de simular a reserva do leito.')}${patientHint}${destinationSummary(hospital)}<div class="modal-data-callout"><span>ⓘ</span><p>O CNES registra <strong>${bedCount(hospital)} leitos SUS ${label}</strong> nesta unidade. A disponibilidade mostrada é fictícia e não representa a ocupação atual.</p></div><div class="modal-actions"><button class="button button-subtle" id="cancelAllocation">Voltar</button><button class="button button-primary" id="confirmReservation" ${appState.selectedPatient ? '' : 'disabled'}>Simular reserva <span>→</span></button></div>`;
  $('#cancelAllocation').addEventListener('click', closeAllocationModal);
  $('#confirmReservation').addEventListener('click', () => {
    appState.reserved = true;
    showToast('Vaga sinalizada', 'Reserva simulada por 15 minutos.');
    renderTransportStep();
  });
}

function transportEstimates() {
  const km = distanceKm(appState.origin, appState.selectedDestination);
  const routeKm = km < 1 ? 0 : Math.round(km * 1.28);
  return { routeKm, ambulanceMin: Math.max(10, Math.round(routeKm * 1.45 + 14)), helicopterMin: Math.max(8, Math.round(km * 0.45 + 7)) };
}

function renderTransportStep() {
  const hospital = appState.selectedDestination;
  const eta = transportEstimates();
  const routeLabel = eta.routeKm === 0 ? '<1 km estimado' : `~${eta.routeKm} km estimados`;
  $('#allocationContent').innerHTML = `${modalHeader(2, 'Escolha um transporte', 'Selecione um recurso demonstrativo para esta transferência.')}${destinationSummary(hospital)}<div class="transport-options"><label class="transport-option"><input type="radio" name="transport" value="ambulancia" checked><span class="transport-glyph">＋</span><span class="transport-copy"><strong>Ambulância avançada · USA 04</strong><small>Base: ${escapeHtml(appState.origin.municipality)} · disponibilidade simulada</small></span><span class="transport-route"><strong>${eta.ambulanceMin} min</strong><small>${routeLabel}</small></span></label><label class="transport-option"><input type="radio" name="transport" value="helicoptero"><span class="transport-glyph">⌁</span><span class="transport-copy"><strong>Aeronave aeromédica · PR 01</strong><small>Base regional · disponibilidade simulada</small></span><span class="transport-route"><strong>${eta.helicopterMin} min</strong><small>~${Math.round(distanceKm(appState.origin, hospital))} km em linha reta</small></span></label></div><div class="transport-note">Tempos e veículos são ilustrativos. Esta tela não aciona ambulâncias, aeronaves ou centrais de regulação.</div><div class="modal-actions"><button class="button button-subtle" id="backToReservation">Voltar</button><button class="button button-primary" id="confirmTransport">Alocar transporte <span>→</span></button></div>`;
  $('#backToReservation').addEventListener('click', renderReserveStep);
  $('#confirmTransport').addEventListener('click', () => {
    appState.transport = $('input[name="transport"]:checked')?.value || 'ambulancia';
    renderSuccessStep();
  });
}

function renderSuccessStep() {
  const hospital = appState.selectedDestination;
  const vehicle = appState.transport === 'helicoptero' ? 'Aeronave aeromédica · PR 01' : 'Ambulância avançada · USA 04';
  const protocol = `DEMO-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  $('#allocationContent').innerHTML = `${modalHeader(3, 'Coordenação demonstrativa concluída', 'A vaga e o transporte foram alocados apenas nesta simulação.')}
    <div class="success-mark">✓</div>${destinationSummary(hospital)}<div class="protocol-card"><span>PROTOCOLO DE DEMONSTRAÇÃO<strong>${protocol}</strong></span><span>STATUS<strong>Vaga e transporte simulados</strong></span><span>TRANSPORTE<strong>${vehicle}</strong></span></div><div class="modal-data-callout" style="margin-top:12px"><span>ⓘ</span><p>Nenhuma vaga real foi reservada. Confirmação com o hospital, regulação e despacho de transporte não ocorreram.</p></div><div class="modal-actions"><button class="button button-primary button-full" id="finishAllocation">Concluir demonstração <span>✓</span></button></div>`;
  $('#finishAllocation').addEventListener('click', () => {
    closeAllocationModal();
    showToast('Demonstração concluída', 'O fluxo de coordenação foi percorrido.');
  });
}

function closeAllocationModal() {
  $('#allocationModal').classList.add('hidden');
  $('#allocationPanel').classList.add('hidden');
  $('#resultsPanel').classList.remove('hidden');
  if (appState.routeLine && appState.map) appState.map.removeLayer(appState.routeLine);
  appState.routeLine = null;
  appState.selectedDestination = null;
  appState.selectedPatient = null;
  if (appState.map) renderMap();
  renderResults();
}

function showToast(title, message) {
  const toast = $('#toast');
  $('#toastTitle').textContent = title;
  $('#toastMessage').textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(appState.toastTimer);
  appState.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3600);
}

function openNotes() {
  $('#demoNotes').classList.remove('hidden');
}

function closeNotes() {
  $('#demoNotes').classList.add('hidden');
}

function openHistory(type) {
  closeAllocationModal();
  const transportContent = type === 'transport';
  $('#modalContent').innerHTML = `<span class="modal-kicker"><i></i> DADOS DE DEMONSTRAÇÃO</span><h2 id="modalTitle">${transportContent ? 'Recursos de transporte' : 'Solicitações recentes'}</h2><p>Informações de exemplo criadas para apresentar o fluxo da plataforma.</p><div class="destination-summary"><span class="destination-icon">${transportContent ? '➤' : '▤'}</span><div><strong>${transportContent ? '2 recursos demonstrativos' : '1 solicitação de demonstração'}</strong><small>${transportContent ? 'Ambulância avançada · aeronave aeromédica' : 'Paciente demonstração #001 · obstétrico'}</small></div><span class="summary-sim">SIMULADO</span></div><div class="modal-data-callout"><span>ⓘ</span><p>${transportContent ? 'Bases, equipes e veículos não representam escala real nem disponibilidade operacional.' : 'A solicitação não contém dados pessoais e não foi enviada a nenhum hospital.'}</p></div><div class="modal-actions"><button class="button button-primary button-full" id="closeHistory">Fechar</button></div>`;
  $('#allocationModal').classList.remove('hidden');
  $('#closeHistory').addEventListener('click', closeAllocationModal);
}

function setupEvents() {
  $('#loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    login($('#email').value, $('#password').value);
  });
  $('#fillDemo').addEventListener('click', () => {
    $('#email').value = DEMO_EMAIL;
    $('#password').value = DEMO_PASSWORD;
    showLoginError('');
    $('#email').focus();
  });
  $('#togglePassword').addEventListener('click', () => {
    const input = $('#password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  $('#openEncontra').addEventListener('click', openEncontra);
  $('#backHome').addEventListener('click', (event) => { event.preventDefault(); openHome(); });
  $('#switchProduct').addEventListener('click', openHome);
  $('#logoutHome').addEventListener('click', logout);
  $('#logoutApp').addEventListener('click', logout);
  $('#bedType').addEventListener('change', (event) => selectBedType(event.target.value));
  $('#hospitalSearch').addEventListener('input', refreshDashboard);
  $('#availableOnly').addEventListener('change', renderResults);
  $('#showAllResults').addEventListener('click', () => {
    $('#availableOnly').checked = false;
    renderResults();
  });
  $('#newRequest').addEventListener('click', () => {
    $('#bedType').focus();
    showToast('Nova solicitação', 'Escolha o tipo de leito e uma opção próxima.');
  });
  $('#fitMap').addEventListener('click', () => {
    if (!appState.map) return;
    if (appState.selectedDestination) closeAllocationModal();
    appState.map.fitBounds(PARANA_BOUNDS, { padding: [20, 20] });
  });
  $$('[data-nav]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-nav]').forEach((item) => item.classList.toggle('active', item === button));
    if (button.dataset.nav === 'requests') openHistory('requests');
    else if (button.dataset.nav === 'transport') openHistory('transport');
    else {
      closeAllocationModal();
      showToast('Mapa de hospitais', 'Consulte a rede e filtre os hospitais próximos.');
    }
  }));
  $('#resultsList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-select-hospital]');
    if (button) selectDestination(button.dataset.selectHospital, true);
  });
  $('#patientSearch').addEventListener('input', renderPatientOptions);
  $('#patientOptions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-select-patient]');
    if (button) selectDemoPatient(button.dataset.selectPatient);
  });
  $('#selectedPatientCard').addEventListener('click', (event) => {
    if (!event.target.closest('#changePatient')) return;
    appState.selectedPatient = null;
    renderPatientChooser();
    renderReserveStep();
    $('#patientSearch').focus();
  });
  $('#map').addEventListener('click', (event) => {
    const button = event.target.closest('.popup-action');
    if (button) selectDestination(button.dataset.hospital, false);
  });
  $('#closeModal').addEventListener('click', closeAllocationModal);
  $('#closeAllocationPanel').addEventListener('click', closeAllocationModal);
  $('#allocationModal').addEventListener('click', (event) => {
    if (event.target === $('#allocationModal')) closeAllocationModal();
  });
  $('#dataNotesLink').addEventListener('click', (event) => { event.preventDefault(); openNotes(); });
  $('#homeDataNotes').addEventListener('click', (event) => { event.preventDefault(); openNotes(); });
  $('#dashDataNotes').addEventListener('click', (event) => { event.preventDefault(); openNotes(); });
  $('#closeNotes').addEventListener('click', closeNotes);
  $('#closeNotesButton').addEventListener('click', closeNotes);
  $('#demoNotes').addEventListener('click', (event) => { if (event.target === $('#demoNotes')) closeNotes(); });
  $('#homeUser').addEventListener('click', () => showToast('Lucas Berr', 'Gestor hospitalar · Santa Casa de Curitiba'));
  $('.top-user').addEventListener('click', () => showToast('Lucas Berr', 'Gestor hospitalar · Santa Casa de Curitiba'));
  $('.help-round').addEventListener('click', openNotes);
}

async function boot() {
  setupEvents();
  try {
    await loadData();
  } catch (error) {
    console.error(error);
    showLoginError('Os dados locais não carregaram. Sirva o projeto por HTTP usando o README.');
  }
  if (sessionStorage.getItem('encontra-demo-user') === 'lucas') showScreen('homeScreen');
}

boot();
