/* hohmann-frame.js
   - Drop this file into your site and include it after loading style.css
   - It will attach itself to #hohmann-frame if present, else to <body>
   - Edit formulas in the "FORMULAS" section below
*/

(function () {
  /* ======= FORMULAS: EDIT HERE =======
     Edit these functions to change how values are computed.
     Units:
       - all distances in km
       - velocities in km/s
       - inclinations in degrees
       - mu in km^3/s^2 (planet gravitational parameter)
  */

  function circularVelocity(mu, radius_km) {
    return Math.sqrt(mu / radius_km);
  }

  function hohmannSemiMajorAxis(r1, r2) {
    return (r1 + r2) / 2;
  }

  function orbitVelocityAtRadius(mu, r, a) {
    return Math.sqrt(Math.max(0, mu * (2 / r - 1 / a)));
  }

  function planeChangeDeltaV(v, deltaIncDeg) {
    const dRad = (deltaIncDeg * Math.PI) / 180;
    return 2 * v * Math.sin(dRad / 2);
  }

  function combineDeltaV(dv2_insertion, deltaIncDeg, v2) {
    deltaIncRad= (deltaIncDeg * Math.PI) / 180;
    V_new = v2;
    V_ta = V_new - dv2_insertion;
    return Math.sqrt(V_ta**2 + V_new**2 - 2 * V_ta * V_new * Math.cos(deltaIncRad));
  }

  /* ======= Planet database =======
     mu in km^3/s^2, radius in km
  */
  const PLANETS = {
    Earth: { radius: 6378, mu: 3.986E5 },
    Mercury: { radius: 2440, mu: 2.203E4 },
    Venus: { radius: 6051, mu: 3.248E5 },
    Mars: { radius: 3396, mu: 4.282E4 },
    Jupiter: { radius: 71492, mu: 1.266E8 },
    Saturn: { radius: 60268, mu: 3.793E7 },
    Uranus: { radius: 25559, mu: 5.793E6 },
    Neptune: { radius: 24760, mu: 6.836E6 },
    Custom: { radius: null, mu: null }
  };

  /* ======= UI Helper =======
     Create element with attributes and children
  */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    children.forEach(c => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  }

  function fmt(x) {
    if (!isFinite(x) || isNaN(x)) return "—";
    return Number(x).toFixed(4);
  }

  /* ======= Calculation Engine =======
     Compute all orbital parameters from inputs
  */
  function computeOrbitalResults(planetName, customRadius, startAlt, endAlt, startInc, endInc, burns) {
    // Get planet properties
    let planet = PLANETS[planetName] || PLANETS.Custom;
    let R = planet.radius;
    let mu = planet.mu;

    if (customRadius) R = customRadius;
    if (!mu) mu = 1; // fallback to avoid NaN

    const r1 = R + startAlt;
    const r2 = R + endAlt;

    // Circular velocities
    const v1 = circularVelocity(mu, r1);
    const v2 = circularVelocity(mu, r2);


    // Delta-V calculations
    const dv1 = Math.sqrt(mu/r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
    const dv2_insertion = Math.sqrt(mu/r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));

    const deltaInc = Math.abs(endInc - startInc);
    const dv_inc = planeChangeDeltaV(v2, deltaInc);

    let dv2_total = 0;
    let dv3 = 0;

    if (burns === 2) {
      dv2_total = combineDeltaV(dv2_insertion, deltaInc, v2);
      dv3 = 0;
    } else {
      dv2_total = dv2_insertion;
      dv3 = dv_inc;
    }

    return { v1, v2, dv1, dv2: dv2_total, dv3, burns };
  }

  /* ======= Build UI =======
     Construct the DOM structure
  */
  function buildFrame() {
    const container = document.getElementById("hohmann-frame") || document.body;

    // title header
    const header = el("div", { class: "hf-page-header" }, ["Hohmann Transfer Calculator"]);

    // main wrapper
    const wrapper = el("div", { class: "hf-wrapper" });

    // left panel (controls)
    const left = el("div", { class: "hf-left" });
    const form = el("form", { class: "hf-form", onsubmit: "return false;" });

    // Planet selector + custom radius input
    const planetSelect = el("select", { id: "hf-planet", class: "hf-input" });
    Object.keys(PLANETS).forEach(p => {
      planetSelect.appendChild(el("option", { value: p }, [p]));
    });
    const planetRow = el("div", { class: "hf-row" }, [
      el("label", { class: "hf-label" }, [document.createTextNode("Planet")]),
      planetSelect
    ]);

    const customRadiusInput = el("input", { id: "hf-custom-radius", class: "hf-input hf-small", type: "number", placeholder: "km" });
    const customRadiusRow = el("div", { class: "hf-row" }, [
      el("label", { class: "hf-label" }, ["Or enter your planet radius (km):"]),
      customRadiusInput
    ]);

    // Starting orbit altitude
    const startAltInput = el("input", { id: "hf-start-alt", class: "hf-input hf-small", type: "number", value: "200" });
    const startAltRow = el("div", { class: "hf-row" }, [
      el("label", { class: "hf-label" }, ["Starting orbit altitude (km):"]),
      startAltInput
    ]);

    // Starting inclination
    const startIncInput = el("input", { id: "hf-start-inc", class: "hf-input hf-small", type: "number", value: "28.5" });
    const startIncRow = el("div", { class: "hf-row" }, [
      el("label", { class: "hf-label" }, ["Starting orbit inclination (°):"]),
      startIncInput
    ]);

    // Ending altitude
    const endAltInput = el("input", { id: "hf-end-alt", class: "hf-input hf-small", type: "number", value: "35786" });
    const endAltRow = el("div", { class: "hf-row" }, [
      el("label", { class: "hf-label" }, ["Ending orbit altitude (km):"]),
      endAltInput
    ]);

    // Ending inclination
    const endIncInput = el("input", { id: "hf-end-inc", class: "hf-input hf-small", type: "number", value: "0" });
    const endIncRow = el("div", { class: "hf-row" }, [
      el("label", { class: "hf-label" }, ["Ending orbit inclination (°):"]),
      endIncInput
    ]);

    // Number of burns
    const burnsInputs = [
      el("input", { type: "radio", name: "hf-burns", value: "2", checked: true }),
      el("input", { type: "radio", name: "hf-burns", value: "3" })
    ];
    const burnsRow = el("div", { class: "hf-row hf-burns" }, [
      el("label", { class: "hf-label" }, ["Number of burns:"]),
      el("label", { class: "hf-radio" }, [burnsInputs[0], el("span", {}, ["2"])]),
      el("label", { class: "hf-radio" }, [burnsInputs[1], el("span", {}, ["3"])])
    ]);

    // Calculate button
    const calcRow = el("div", { class: "hf-row" }, [
      el("button", { id: "hf-calc", class: "hf-btn", type: "button" }, ["Calculate"])
    ]);

    form.appendChild(planetRow);
    form.appendChild(customRadiusRow);
    form.appendChild(startAltRow);
    form.appendChild(startIncRow);
    form.appendChild(endAltRow);
    form.appendChild(endIncRow);
    form.appendChild(burnsRow);
    form.appendChild(calcRow);
    left.appendChild(form);

    // right panel (image + results)
    const right = el("div", { class: "hf-right" });
    const imageBox = el("div", { class: "hf-image" }, [
      el("img", { src: "img/hohmann/hohmann-transfer.jpg", alt: "Hohmann Transfer Diagram", class: "hf-image-img" })
    ]);
    right.appendChild(imageBox);

    // results (green text)
    const results = el("div", { class: "hf-results" });
    results.innerHTML = `
      <p class="hf-green">Orbit params: starting orbit velocity: <span id="res-v1">___</span> km/s, final orbit velocity: <span id="res-v2">___</span> km/s</p>
      <p class="hf-green">Delta-V first burn (orbit injection): <span id="res-dv1">___</span> km/s</p>
      <p class="hf-green">Delta-V second burn (<span id="res-dv2-label">orbit insertion & inclination change</span>): <span id="res-dv2">___</span> km/s</p>
      <p class="hf-green" id="res-dv3-container">Delta-V third burn (inclination change): <span id="res-dv3">___</span> km/s</p>
    `;

    // assemble: header first, then content row with left/right
    const contentRow = el("div", { class: "hf-content-row" });
    contentRow.appendChild(left);
    contentRow.appendChild(right);
    
    wrapper.appendChild(header);
    wrapper.appendChild(contentRow);
    wrapper.appendChild(results);
    container.appendChild(wrapper);

    return { wrapper, planetSelect, customRadiusInput, startAltInput, startIncInput, endAltInput, endIncInput, burnsInputs, results };
  }

  /* ======= Event Wiring & Live Updates =======
     Attach event listeners and refresh outputs
  */
  function setupEventHandlers(frameElements) {
    const { wrapper, planetSelect, customRadiusInput, startAltInput, startIncInput, endAltInput, endIncInput, burnsInputs } = frameElements;

    function q(id) { return document.getElementById(id); }

    // Update custom radius field when planet changes
    function updateRadiusField() {
      const planetName = planetSelect.value;
      if (planetName === "Custom") {
        customRadiusInput.disabled = false;
        customRadiusInput.placeholder = "km";
        customRadiusInput.value = "";
      } else {
        const planet = PLANETS[planetName];
        customRadiusInput.value = planet.radius;
        customRadiusInput.disabled = true;
      }
    }

    // Refresh all output values
    function refreshOutputs() {
      const planetName = planetSelect.value;
      const customRadius = Number(customRadiusInput.value) || null;
      const startAlt = Number(startAltInput.value) || 0;
      const endAlt = Number(endAltInput.value) || 0;
      const startInc = Number(startIncInput.value) || 0;
      const endInc = Number(endIncInput.value) || 0;
      const burns = Array.from(burnsInputs).find(r => r.checked).value === "3" ? 3 : 2;

      // Compute orbital results
      const results = computeOrbitalResults(planetName, customRadius, startAlt, endAlt, startInc, endInc, burns);

      // Update output display
      q("res-v1").textContent = fmt(results.v1);
      q("res-v2").textContent = fmt(results.v2);
      q("res-dv1").textContent = fmt(results.dv1);
      q("res-dv2").textContent = fmt(results.dv2);

      // Update labels and visibility based on burn count
      const dv2Label = q("res-dv2-label");
      const dv3Container = q("res-dv3-container");

      if (burns === 2) {
        dv2Label.textContent = "orbit insertion & inclination change";
        dv3Container.style.display = "none";
      } else {
        dv2Label.textContent = "orbit insertion only";
        dv3Container.style.display = "block";
      }

      q("res-dv3").textContent = results.dv3 > 0 ? fmt(results.dv3) : "—";
    }

    // Event listeners
    planetSelect.addEventListener("change", () => {
      updateRadiusField();
      refreshOutputs();
    });

    [customRadiusInput, startAltInput, startIncInput, endAltInput, endIncInput].forEach(inp => {
      inp.addEventListener("input", refreshOutputs);
    });

    burnsInputs.forEach(r => r.addEventListener("change", refreshOutputs));
    wrapper.querySelector("#hf-calc").addEventListener("click", refreshOutputs);

    // Initial setup
    updateRadiusField();
    refreshOutputs();
  }

  /* ======= Main initialization =======
     Build UI and wire up events
  */
  function init() {
    const frameElements = buildFrame();
    setupEventHandlers(frameElements);
  }

  // Auto-run on page load
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState === "interactive" || document.readyState === "complete") {
    init();
  }
})();
