const CONTAINER_ID = 'orbit-delta-v';

/* ======= Editable formula functions =======
   Edit these functions to change how values are computed.
   Each function receives plain numeric inputs (in SI-like units):
   - radiusKm: planet radius (km)
   - mu_km3_s2: standard gravitational parameter (km^3/s^2)
   - launchLatDeg: launch latitude in degrees
   - orbitAltKm: orbit altitude above surface in km
   - siteRotationSpeedKmS: tangential speed of launch site from planet rotation (km/s)
   - You may add or remove parameters as you like; keep return values numeric.
*/

/** Return orbital velocity (km/s) for circular orbit at radius = radiusKm + orbitAltKm.
 * default physics: v = sqrt(mu / r)
 */
function computeOrbitalVelocity(mu_km3_s2, radiusKm, orbitAltKm) {
  const r = (radiusKm + orbitAltKm);
  if (r <= 0 || mu_km3_s2 <= 0) return 0;
  return Math.sqrt(mu_km3_s2 / r);
}

/** Return launch site velocity (km/s) from planet rotation given latitude.
 * default: v = (2*pi*R / rotationPeriod) * cos(lat)
 * where rotationPeriod is seconds per rotation. For Earth default we'll use sidereal day ~86164 s.
 */
function computeLaunchSiteVelocity(radiusKm, launchLatDeg, rotationPeriodSec) {
  const R_km = radiusKm;
  const latRad = launchLatDeg * Math.PI / 180;
  const equatorialCircumferenceKm = 2 * Math.PI * R_km;
  const equatorialSpeedKmS = equatorialCircumferenceKm / rotationPeriodSec;
  return equatorialSpeedKmS * Math.cos(latRad);
}

/** Delta-V potential (km/s):
 */
function computeDeltaVPotential(mu_km3_s2, orbitAltKm, radiusKm) {
  return Math.sqrt(mu_km3_s2/radiusKm) * Math.sqrt(2-(radiusKm/(radiusKm+orbitAltKm)))-Math.sqrt(mu_km3_s2/(radiusKm+orbitAltKm));
}

/** Delta-V gravity loss (km/s): default a simple fixed function by orbit altitude.
 * This is a placeholder: typical gravity losses may be ~1.5 - 2.5 km/s depending on trajectory.
 */
function computeDeltaVGravity(orbitAltKm) {
  return 1.6; //LEO estimate only
}

/** Delta-V drag loss (km/s): placeholder based on low altitude.
 */
function computeDeltaVDrag(orbitAltKm) {
  return 0.1; //LEO estimate only
}

/** Total Delta-V (km/s): v_orbit + deltaPotential + deltaVGravity + deltaVDrag - v_launchSite */
function computeTotalDeltaV(vOrbit, deltaVPotentialKmS, deltaVGravityKmS, deltaVDragKmS, vLaunchSite) {
  return vOrbit + deltaVPotentialKmS + deltaVGravityKmS + deltaVDragKmS - vLaunchSite;
}

/** Orbital Period (seconds): calculate orbit period from planet radius, orbit altitude, and mu.
 **/
function computeOrbitalPeriod(mu_km3_s2, radiusKm, orbitAltKm) {
  return 2*Math.PI*Math.sqrt(Math.pow(radiusKm + orbitAltKm, 3)/mu_km3_s2);
}

/* ======= Planet database (editable) =======
   Each planet entry has:
     name, radiusKm, mu_km3_s2 (GM), rotationPeriodSec (optional)
   Update or add planets as needed.
*/
const PLANETS = [

  { name: 'Earth', 
    radiusKm: 6378, 
    mu_km3_s2: 3.986E5, 
    rotationPeriodSec: 86164.0905 }, // 23h 56m 4.0905s

  { name: 'Mercury', 
    radiusKm: 2440, 
    mu_km3_s2: 2.203E4, 
    rotationPeriodSec: 5067032 }, // 58.646 days

  { name: 'Venus', 
    radiusKm: 6051, 
    mu_km3_s2: 3.248E5, 
    rotationPeriodSec: 20996798 }, // 243.025 days (retrograde)

  { name: 'Mars', 
    radiusKm: 3396, 
    mu_km3_s2: 4.282E4, 
    rotationPeriodSec: 88642.6848 }, // 24h 37m 22.6848s

  { name: 'Jupiter', 
    radiusKm: 71492, 
    mu_km3_s2: 1.266E8, 
    rotationPeriodSec: 35729.685 }, // 9h 55m 29.685s

  { name: 'Saturn', 
    radiusKm: 60268, 
    mu_km3_s2: 3.793E7, 
    rotationPeriodSec: 38361 }, // ~10h 39m (System III)

  { name: 'Uranus', 
    radiusKm: 25559, 
    mu_km3_s2: 5.793E6, 
    rotationPeriodSec: 62064 }, // 17h 14m (retrograde)

  { name: 'Neptune', 
    radiusKm: 24760, 
    mu_km3_s2: 6.836E6, 
    rotationPeriodSec: 57996 }, // 16h 6m
];


/* ======= UI builder ======= */

/** Helper to create element with classes, attrs, content */
function el(tag, options = {}) {
  const d = document.createElement(tag);
  if (options.id) d.id = options.id;
  if (options.className) d.className = options.className;
  if (options.html !== undefined) d.innerHTML = options.html;
  if (options.text !== undefined) d.textContent = options.text;
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) d.setAttribute(k, v);
  }
  return d;
}

/** Format numbers nicely */
function fmt(n, decimals = 3) {
  if (Number.isFinite(n)) return Number(n).toFixed(decimals);
  return '-';
}

/** Build the full UI into the container */
function buildUI(container) {
  container.classList.add('odv-container');

  // header
  const header = el('div', { className: 'odv-header', text: 'Orbit Delta V calculator' });
  container.appendChild(header);

  const main = el('div', { className: 'odv-main' });
  container.appendChild(main);

  // left column: inputs
  const left = el('div', { className: 'odv-left' });
  main.appendChild(left);

  // Right column: outputs
  const right = el('div', { className: 'odv-right' });
  main.appendChild(right);

  // Left: Planet select
  const planetRow = el('div', { className: 'odv-row' });
  planetRow.appendChild(el('label', { className: 'odv-label', text: 'Launch planet:' }));
  const planetSelect = el('select', { id: 'odv-planet' });
  PLANETS.forEach(p => {
    const o = el('option', { text: p.name, attrs: { value: p.name } });
    planetSelect.appendChild(o);
  });
  planetRow.appendChild(planetSelect);
  left.appendChild(planetRow);

  // Latitude input
  const latRow = el('div', { className: 'odv-row' });
  latRow.appendChild(el('label', { className: 'odv-label', text: 'Launch latitude (N):' }));
  const latInput = el('input', { id: 'odv-lat', attrs: { type: 'number', min: '-90', max: '90', step: '0.01', value: '0' } });
  latRow.appendChild(latInput);
  left.appendChild(latRow);

  // Launch site quick choices (radio buttons)
  const sites = [
    { id: 'gsc', name: 'Guiana Space Center', lat: 5.235 },
    { id: 'cc', name: 'Cape Canaveral', lat: 28.3922 },
    { id: 'vdb', name: 'Vandenberg', lat: 34.7420 },
    { id: 'baikonur', name: 'Baikonur', lat: 45.964 },
    { id: 'plesetsk', name: 'Plessetsk', lat: 62.9275 },
    { id: 'other', name: 'Other', lat: null },
  ];
  const siteBox = el('div', { className: 'odv-sitebox' });
  sites.forEach(s => {
    const id = `odv-site-${s.id}`;
    const wrapper = el('div', { className: 'odv-site' });
    const input = el('input', { attrs: { type: 'radio', name: 'odv-site', id, value: s.lat || '' } });
    const label = el('label', { attrs: { for: id }, text: s.name });
    wrapper.appendChild(input);
    wrapper.appendChild(label);
    siteBox.appendChild(wrapper);
  });
  left.appendChild(siteBox);

  // Orbit altitude input
  const altRow = el('div', { className: 'odv-row' });
  altRow.appendChild(el('label', { className: 'odv-label', text: 'Orbit altitude (km):' }));
  const altInput = el('input', { id: 'odv-alt', attrs: { type: 'number', min: '0', step: '1', value: '400' } });
  altRow.appendChild(altInput);
  left.appendChild(altRow);

  // Orbit categories list (informational)
  const orbitInfo = el('div', { className: 'odv-orbit-info' });
  orbitInfo.innerHTML = `
    <ul>
      <li>LEO: Low Earth Orbit (&lt; 2,000 km)</li>
      <li>MEO: Medium Earth Orbit (2,000 - 35,786 km)</li>
      <li>GEO: Geostationary Earth Orbit (~35,768 km)</li>
    </ul>
  `;
  left.appendChild(orbitInfo);

  // Calculate button
  const calcRow = el('div', { className: 'odv-calcrow' });
  const calcBtn = el('button', { id: 'odv-calc-btn', className: 'odv-calc-btn', text: 'Calculate' });
  calcRow.appendChild(calcBtn);

  // Assumptions text
  const assumptionsText = el('div', { className: 'odv-assumptions', text: 'Assumptions: Delta-V gravity is 1.6 km/s, Delta-V drag is 0.1 km/s for LEO, valid for Earth only' });
  calcRow.appendChild(assumptionsText);

  left.appendChild(calcRow);

  /* ===== Right column outputs ===== */
  function outputRow(labelText, id) {
    const row = el('div', { className: 'odv-out-row' });
    row.appendChild(el('div', { className: 'odv-out-label', text: labelText }));
    const out = el('div', { className: 'odv-out-value green-box', id });
    out.textContent = '-';
    row.appendChild(out);
    return row;
  }

  right.appendChild(outputRow('Planet Radius (km):', 'odv-out-radius'));
  right.appendChild(outputRow('Orbital Velocity (km/s):', 'odv-out-orbital-vel'));
  right.appendChild(outputRow('Orbital Period (s):', 'odv-out-orbital-period'));
  right.appendChild(outputRow('Launch site velocity (km/s):', 'odv-out-site-vel'));
  right.appendChild(outputRow('Delta-V Potential (km/s):', 'odv-out-dv-potential'));
  right.appendChild(outputRow('Delta-V Gravity (km/s):', 'odv-out-dv-gravity'));
  right.appendChild(outputRow('Delta-V Drag (km/s):', 'odv-out-dv-drag'));
  right.appendChild(outputRow('Total Delta-V (km/s):', 'odv-out-total-dv'));

  /* ===== Event wiring and calculation logic ===== */

  function getSelectedPlanet() {
    const sel = planetSelect.value;
    return PLANETS.find(p => p.name === sel) || PLANETS[0];
  }

  function getSelectedSiteLatitude() {
    // If a site radio is selected and not "other", use it; otherwise fallback to manual lat input
    const siteRadio = container.querySelector('input[name="odv-site"]:checked');
    if (siteRadio && siteRadio.value) return Number(siteRadio.value);
    return Number(latInput.value) || 0;
  }

  function refreshOutputs() {
    const planet = getSelectedPlanet();
    const radiusKm = Number(planet.radiusKm);
    const mu = Number(planet.mu_km3_s2);
    const rotPeriod = planet.rotationPeriodSec || 86164;

    const launchLat = Number(latInput.value) || 0;
    const orbitAlt = Number(altInput.value) || 0;

    // If user selected a site radio, override launchLat
    const siteLat = getSelectedSiteLatitude();

    // compute
    const orbitalV = computeOrbitalVelocity(mu, radiusKm, orbitAlt);
    const orbitalPeriod = computeOrbitalPeriod(mu, radiusKm, orbitAlt);
    const siteV = computeLaunchSiteVelocity(radiusKm, siteLat, rotPeriod);
    const dvPotential = computeDeltaVPotential(mu, orbitAlt, radiusKm);
    const dvGravity = computeDeltaVGravity(orbitAlt);
    const dvDrag = computeDeltaVDrag(orbitAlt);
    const totalDV = computeTotalDeltaV(orbitalV, dvPotential, dvGravity, dvDrag, siteV);

    // update outputs
    container.querySelector('#odv-out-radius').textContent = fmt(radiusKm, 2);
    container.querySelector('#odv-out-orbital-vel').textContent = fmt(orbitalV, 4);
    container.querySelector('#odv-out-orbital-period').textContent = fmt(orbitalPeriod, 0);
    container.querySelector('#odv-out-site-vel').textContent = fmt(siteV, 5);
    container.querySelector('#odv-out-dv-potential').textContent = fmt(dvPotential, 4);
    container.querySelector('#odv-out-dv-gravity').textContent = fmt(dvGravity, 3);
    container.querySelector('#odv-out-dv-drag').textContent = fmt(dvDrag, 3);
    container.querySelector('#odv-out-total-dv').textContent = fmt(totalDV, 4);
  }

  // Wire up events: calculate button and some live updates
  calcBtn.addEventListener('click', (e) => {
    e.preventDefault();
    refreshOutputs();
  });

  // Quick live refresh on changing key inputs
  planetSelect.addEventListener('change', () => {
    const planet = getSelectedPlanet();
    const isEarth = planet.name === 'Earth';
    
    // Show/hide orbit info and manage radio buttons based on planet
    orbitInfo.style.display = isEarth ? 'block' : 'none';
    
    // Enable/disable site radios (all except "other")
    const siteRadios = container.querySelectorAll('input[name="odv-site"]');
    siteRadios.forEach(r => {
      if (r.value === '') {
        // "other" radio is always enabled
        r.disabled = false;
      } else {
        // Other radios disabled if not Earth
        r.disabled = !isEarth;
      }
    });
    
    // Highlight assumptions if not Earth
    if (isEarth) {
      assumptionsText.classList.remove('odv-assumptions-warning');
    } else {
      assumptionsText.classList.add('odv-assumptions-warning');
    }
    
    refreshOutputs();
  });
  latInput.addEventListener('input', () => {
    // Select "other" radio and calculate when manual latitude typed
    const otherRadio = container.querySelector('input[name="odv-site"][value=""]');
    if (otherRadio) otherRadio.checked = true;
    refreshOutputs();
  });
  altInput.addEventListener('input', refreshOutputs);

  // When a site radio is selected, update lat input display and calculate
  const siteRadios = container.querySelectorAll('input[name="odv-site"]');
  siteRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked && r.value) {
        // Show the site latitude in the manual lat input for clarity (but site radio still controls)
        latInput.value = r.value;
      }
      refreshOutputs();
    });
  });

  // default initial compute
  refreshOutputs();
}

/* ===== Initialization ===== */
function initOrbitDeltaV() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.error(`Orbit Delta-V widget: container with id "${CONTAINER_ID}" not found.`);
    return;
  }
  // avoid building twice
  if (container.dataset.odvInitialized) return;
  buildUI(container);
  container.dataset.odvInitialized = '1';
}

// when DOM ready, initialize automatically
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrbitDeltaV);
} else {
  initOrbitDeltaV();
}

/* ===== Export helpers for advanced usage (optional) ===== */
window.OrbitDeltaV = {
  init: initOrbitDeltaV,
  refresh: function() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    const btn = container.querySelector('#odv-calc-btn');
    if (btn) btn.click();
  },
  // Expose the formula functions so they can be called/modified from outside if desired:
  formulas: {
    computeOrbitalVelocity,
    computeLaunchSiteVelocity,
    computeDeltaVPotential,
    computeDeltaVGravity,
    computeDeltaVDrag,
    computeTotalDeltaV
  },
  // Expose planet DB to allow adding planets at runtime:
  planets: PLANETS
};