/* Společný základ obou 3D scén.
 *
 * Renderer, jedna rAF smyčka, která běží jen když je scéna v obraze,
 * přepočet na změnu velikosti a materiál karty. Karta je Karlova grafika,
 * takže se nesvítí fyzikálním světlem: barvy musí sedět s originálem.
 * Hloubku dělá ztmavení vzdálených karet, mlha do barvy desky a odlesk,
 * který po kartě přejede při otáčení.
 */
import * as THREE from 'three';

export { THREE };

const mobil = matchMedia('(max-width: 900px)');

export function zalozScenu(canvas, { fov = 30 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(fov, 1, 0.1, 60);

  const stav = { sirka: 1, vyska: 1, pomer: 1, videt: false, bezi: false };
  const posluchaci = { snimek: [], velikost: [] };

  const zmer = () => {
    const r = canvas.getBoundingClientRect();
    stav.sirka = Math.max(1, r.width);
    stav.vyska = Math.max(1, r.height);
    stav.pomer = stav.sirka / stav.vyska;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobil.matches ? 1.5 : 2));
    renderer.setSize(stav.sirka, stav.vyska, false);
    kamera.aspect = stav.pomer;
    kamera.updateProjectionMatrix();
    posluchaci.velikost.forEach((fn) => fn(stav));
  };
  new ResizeObserver(zmer).observe(canvas);
  zmer();

  let posledni = 0;
  const smycka = (cas) => {
    if (!stav.videt) { stav.bezi = false; return; }
    // Krok zastropovaný, ať se po návratu na záložku nic neutrhne.
    const dt = Math.min((cas - posledni) / 1000 || 0.016, 0.05);
    posledni = cas;
    posluchaci.snimek.forEach((fn) => fn(dt, cas / 1000));
    renderer.render(scena, kamera);
    requestAnimationFrame(smycka);
  };

  const spust = () => {
    if (stav.bezi || !stav.videt) return;
    stav.bezi = true;
    posledni = performance.now();
    requestAnimationFrame(smycka);
  };

  // Mimo obraz se nekreslí nic.
  new IntersectionObserver(([z]) => {
    stav.videt = z.isIntersecting;
    spust();
  }, { rootMargin: '120px 0px' }).observe(canvas);

  return {
    renderer, scena, kamera, stav,
    priSnimku: (fn) => posluchaci.snimek.push(fn),
    priVelikosti: (fn) => { posluchaci.velikost.push(fn); fn(stav); },
    vykresli: () => renderer.render(scena, kamera),
  };
}

export async function nactiTextury(renderer, adresy) {
  const loader = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  return Promise.all(adresy.map((src) => loader.loadAsync(src).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, aniso);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  })));
}

const vrchol = /* glsl */`
  varying vec2 vUv;
  varying float vHloubka;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vHloubka = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */`
  uniform sampler2D uMapa;
  uniform vec2 uRozmer;      // rozměr karty ve světových jednotkách
  uniform float uPolomer;    // zaoblení rohů
  uniform float uSvetlo;     // 0 = karta v pozadí, 1 = karta vpředu
  uniform float uKryti;
  uniform float uOdraz;      // 1 = zrcadlový odraz na ledě
  uniform float uOdlesk;     // poloha odlesku přes kartu
  uniform float uOdleskSila; // odlesk je vidět jen v pohybu
  uniform vec3 uRub;         // barva zadní strany karty
  uniform vec3 uMlha;
  uniform vec2 uMlhaRozsah;
  varying vec2 vUv;
  varying float vHloubka;

  float zaoblenyObdelnik(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uRozmer;
    float d = zaoblenyObdelnik(p, uRozmer * 0.5, uPolomer);
    float hrana = fwidth(d);
    float maska = 1.0 - smoothstep(-hrana, hrana, d);
    if (maska < 0.01) discard;

    // Zrcadlený odraz má obrácené otočení plochy.
    bool licem = gl_FrontFacing;
    if (uOdraz > 0.5) licem = !licem;

    vec3 barva;
    if (licem) {
      barva = texture2D(uMapa, vUv).rgb;
      float jas = dot(barva, vec3(0.299, 0.587, 0.114));
      barva = mix(vec3(jas), barva, mix(0.45, 1.0, uSvetlo));
      barva *= mix(0.30, 1.0, uSvetlo);
      // Odlesk: šikmý pruh světla, který přejede kartou při otáčení.
      float pruh = vUv.x + vUv.y * 0.45 - uOdlesk;
      barva += vec3(1.0, 0.86, 0.72) * 0.11 * (1.0 - smoothstep(0.0, 0.16, abs(pruh))) * uOdleskSila;
      // Jemný lem nahoře, jako hrana kartonu v protisvětle.
      barva += vec3(1.0, 0.7, 0.45) * 0.05 * smoothstep(0.985, 1.0, vUv.y) * uSvetlo;
    } else {
      barva = uRub * mix(0.55, 1.0, uSvetlo);
    }

    float mlha = smoothstep(uMlhaRozsah.x, uMlhaRozsah.y, vHloubka);
    barva = mix(barva, uMlha, mlha * 0.85);

    float kryti = uKryti * maska;
    if (uOdraz > 0.5) {
      // Odraz slábne směrem od ledu.
      kryti *= 0.4 * (1.0 - smoothstep(0.0, 0.55, vUv.y));
    }
    gl_FragColor = vec4(barva, kryti);
    #include <colorspace_fragment>
  }
`;

export function materialKarty(textura, rozmer, volby = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vrchol,
    fragmentShader: fragment,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: !volby.odraz,
    uniforms: {
      uMapa: { value: textura },
      uRozmer: { value: new THREE.Vector2(rozmer.x, rozmer.y) },
      uPolomer: { value: volby.polomer ?? 0.045 },
      uSvetlo: { value: 1 },
      uKryti: { value: 1 },
      uOdraz: { value: volby.odraz ? 1 : 0 },
      uOdlesk: { value: -1 },
      uOdleskSila: { value: 0 },
      uRub: { value: new THREE.Color(volby.rub ?? 0x2a1a12) },
      uMlha: { value: new THREE.Color(volby.mlha ?? 0x120e0b) },
      uMlhaRozsah: { value: new THREE.Vector2(...(volby.mlhaRozsah ?? [6, 11])) },
    },
  });
}

/* Kurzor nad scénou jako -1..1, vyhlazený v čase. */
export function sledujKurzor(prvek) {
  const k = { x: 0, y: 0, cilX: 0, cilY: 0, uvnitr: false, ndc: new THREE.Vector2(9, 9) };
  prvek.addEventListener('pointermove', (e) => {
    const r = prvek.getBoundingClientRect();
    k.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    k.cilX = k.ndc.x;
    k.cilY = k.ndc.y;
    k.uvnitr = true;
  });
  prvek.addEventListener('pointerleave', () => {
    k.cilX = 0; k.cilY = 0; k.uvnitr = false; k.ndc.set(9, 9);
  });
  k.krok = (dt) => {
    const a = 1 - Math.exp(-dt * 4);
    k.x += (k.cilX - k.x) * a;
    k.y += (k.cilY - k.y) * a;
  };
  return k;
}

export const tlumeni = (dt, rychlost) => 1 - Math.exp(-dt * rychlost);
