/* Green Line — pět snímků rozestavených jako pětka na ledě.
 *
 * Karty leží na tmavém ledu jako na taktické tabuli: tři útočníci vpředu,
 * dva obránci za nimi. Karta pod kurzorem se zvedne a natočí ke kameře,
 * aby se dala číst; bez kurzoru se karty po řadě zvedají samy.
 */
import { THREE, zalozScenu, nactiTextury, materialKarty, sledujKurzor, tlumeni } from './tri-zaklad.js';

const controls = {
  zdvih: 0.62,
  naklon: 1.05,      // o kolik se zvednutá karta natočí ke kameře (rad)
  priblizeni: 0.36,
  tuhost: 7,
  autoInterval: 2.8,
  kurzorX: 0.45,
  kurzorY: 0.25,
};

const NAZVY = { C: 'Centr', LW: 'Levé křídlo', RW: 'Pravé křídlo', LD: 'Levý obránce', RD: 'Pravý obránce' };
// Útočníci dál od kamery (směrem k soupeřově bráně), obránci blíž.
const POZICE = { C: [0, -1.0], LW: [-1.5, -0.74], RW: [1.5, -0.74], LD: [-0.8, 0.82], RD: [0.8, 0.82] };
const POZICE_MOBIL = { C: [0, -1.06], LW: [-1.14, -0.62], RW: [1.14, -0.62], LD: [-0.58, 0.86], RD: [0.58, 0.86] };

// Led sahá daleko za modrou čáru, ať jeho vzdálená hrana nikdy není vidět.
const LED = { sirka: 11, hloubka: 11 };

/* Led je procedurální: lajny kluziště, škrábance od bruslí a vinětace. */
function texturaLedu() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = Math.round(2048 * (LED.hloubka / LED.sirka));
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const naPx = (x, z) => [((x + LED.sirka / 2) / LED.sirka) * W, ((z + LED.hloubka / 2) / LED.hloubka) * H];
  const m = W / LED.sirka;

  const [, sy] = naPx(0, 0.4);
  const zaklad = g.createRadialGradient(W / 2, sy, 0, W / 2, sy, W * 0.5);
  zaklad.addColorStop(0, '#2b211c');
  zaklad.addColorStop(0.55, '#181210');
  zaklad.addColorStop(1, '#0f0b09');
  g.fillStyle = zaklad;
  g.fillRect(0, 0, W, H);

  // Škrábance od bruslí: tisíce tenkých oblouků s nízkým krytím.
  let semeno = 7;
  const nahoda = () => ((semeno = (semeno * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let i = 0; i < 2200; i++) {
    const x = nahoda() * W, y = nahoda() * H;
    const r = 80 + nahoda() * 900;
    const a = nahoda() * Math.PI * 2;
    g.strokeStyle = `rgba(255, 240, 225, ${0.012 + nahoda() * 0.03})`;
    g.lineWidth = 0.6 + nahoda() * 1.4;
    g.beginPath();
    g.arc(x, y, r, a, a + 0.05 + nahoda() * 0.25);
    g.stroke();
  }

  const cara = (z, barva, tl) => {
    const [, y] = naPx(0, z);
    g.fillStyle = barva;
    g.fillRect(0, y - (tl * m) / 2, W, tl * m);
  };
  const kruh = (x, z, r, barva, tl) => {
    const [px, py] = naPx(x, z);
    g.strokeStyle = barva;
    g.lineWidth = tl * m;
    g.beginPath();
    g.arc(px, py, r * m, 0, Math.PI * 2);
    g.stroke();
  };
  const tecka = (x, z, r, barva) => {
    const [px, py] = naPx(x, z);
    g.fillStyle = barva;
    g.beginPath();
    g.arc(px, py, r * m, 0, Math.PI * 2);
    g.fill();
  };

  cara(-2.15, 'rgba(255, 255, 255, .13)', 0.09);  // modrá čára, tady jen světlá
  cara(2.05, 'rgba(225, 101, 11, .42)', 0.07);    // středová červená v barvě webu
  kruh(0, 2.05, 0.95, 'rgba(255, 255, 255, .10)', 0.025);
  tecka(0, 2.05, 0.06, 'rgba(225, 101, 11, .5)');
  for (const x of [-2.75, 2.75]) {
    kruh(x, -0.25, 0.9, 'rgba(225, 101, 11, .22)', 0.025);
    tecka(x, -0.25, 0.08, 'rgba(225, 101, 11, .45)');
  }

  const [, vy] = naPx(0, 0.2);
  const vineta = g.createRadialGradient(W / 2, vy, W * 0.14, W / 2, vy, W * 0.46);
  vineta.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vineta.addColorStop(1, 'rgba(10, 7, 5, .85)');
  g.fillStyle = vineta;
  g.fillRect(0, 0, W, H);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function texturaStinu() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0, 0, 0, .9)');
  gr.addColorStop(0.5, 'rgba(0, 0, 0, .45)');
  gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export async function spust(clanek, { priOtevreni }) {
  const deska = clanek.querySelector('.green__scena');
  const canvas = deska.querySelector('canvas');
  const stitkyVrstva = deska.querySelector('.green__stitky');
  const figury = [...clanek.querySelectorAll('.bento figure')];
  const pozice = figury.map((f) => f.dataset.pozice);
  const adresy = figury.map((f) => f.querySelector('img').currentSrc || f.querySelector('img').src);

  const z = zalozScenu(canvas, { fov: 30 });
  const textury = await nactiTextury(z.renderer, adresy);
  const img = textury[0].image;
  const w = 1;
  const h = w * (img.height / img.width);

  const led = new THREE.Mesh(
    new THREE.PlaneGeometry(LED.sirka, LED.hloubka),
    new THREE.MeshBasicMaterial({ map: texturaLedu() }),
  );
  led.rotation.x = -Math.PI / 2;
  z.scena.add(led);

  const stinTex = texturaStinu();
  const geo = new THREE.PlaneGeometry(w, h);
  const mobil = matchMedia('(max-width: 900px)');

  const karty = textury.map((t, i) => {
    const karta = new THREE.Mesh(geo, materialKarty(t, { x: w, y: h }, { polomer: 0.04, mlhaRozsah: [11, 16] }));
    karta.userData.index = i;
    const stin = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.5, h * 1.5),
      new THREE.MeshBasicMaterial({ map: stinTex, transparent: true, depthWrite: false, opacity: 0.55 }),
    );
    stin.rotation.x = -Math.PI / 2;
    z.scena.add(stin, karta);

    const stitek = document.createElement('span');
    stitek.className = 'green__stitek';
    stitek.innerHTML = `<b>${pozice[i]}</b><span class="green__stitek-nazev"> · ${NAZVY[pozice[i]] || ''}</span>`;
    stitkyVrstva.append(stitek);

    return { karta, stin, stitek, zdvih: 0, cil: [0, 0], sirkaStitku: 0 };
  });

  const rozestav = () => {
    const tabulka = mobil.matches ? POZICE_MOBIL : POZICE;
    karty.forEach((k, i) => { k.cil = tabulka[pozice[i]] || [0, 0]; });
  };
  rozestav();
  mobil.addEventListener('change', rozestav);

  let oddaleni = 1;
  z.priVelikosti((s) => {
    oddaleni = s.pomer >= 1.6 ? 1 : 1 + (1.6 - s.pomer) * 0.24;
    karty.forEach((k) => { k.sirkaStitku = k.stitek.offsetWidth; });
  });

  /* Poloha desky na stránce kvůli jemnému najetí kamery při scrollu. */
  let stred = 0;
  const premer = () => {
    const r = deska.getBoundingClientRect();
    stred = r.top + scrollY + r.height / 2;
  };
  premer();
  new ResizeObserver(premer).observe(document.body);

  const kurzor = sledujKurzor(deska);
  const paprsek = new THREE.Raycaster();
  const jenKarty = karty.map((k) => k.karta);
  const v = new THREE.Vector3();
  const cilKamery = new THREE.Vector3(0, 0, -0.1);

  let pod = -1;           // karta pod kurzorem
  let auto = 0;           // karta zvednutá automaticky
  let autoCas = 0;
  let uvod = 0;
  let pripraveno = false;

  z.priSnimku((dt, cas) => {
    kurzor.krok(dt);

    if (kurzor.uvnitr) {
      paprsek.setFromCamera(kurzor.ndc, z.kamera);
      const hit = paprsek.intersectObjects(jenKarty, false)[0];
      pod = hit ? hit.object.userData.index : -1;
    } else {
      pod = -1;
      autoCas += dt;
      if (autoCas > controls.autoInterval) { autoCas = 0; auto = (auto + 1) % karty.length; }
    }
    deska.classList.toggle('ukazuje-kartu', pod >= 0);
    const zvednuta = kurzor.uvnitr ? pod : (uvod >= 1 ? auto : -1);

    if (pripraveno) uvod = Math.min(1, uvod + dt / 1.8);

    karty.forEach((k, i) => {
      // Nástup: hráči najedou na led zezadu kamery, jeden po druhém.
      const n = Math.min(1, Math.max(0, (uvod * 1.8 - i * 0.14) / 1));
      const nastup = 1 - Math.pow(1 - n, 4);

      k.zdvih += ((zvednuta === i ? 1 : 0) - k.zdvih) * tlumeni(dt, controls.tuhost);
      const l = k.zdvih;
      const [x, zz] = k.cil;
      const dojezd = (1 - nastup) * 5;

      k.karta.position.set(
        x * (0.6 + 0.4 * nastup),
        0.012 + l * controls.zdvih + Math.sin(cas * 1.2 + i * 1.7) * 0.004,
        zz + dojezd + l * controls.priblizeni,
      );
      k.karta.rotation.set(-Math.PI / 2 + l * controls.naklon, 0, (1 - nastup) * (i % 2 ? 0.5 : -0.5));
      k.karta.scale.setScalar(1 + l * 0.14);

      k.stin.position.set(k.karta.position.x + l * 0.12, 0.004, k.karta.position.z + l * 0.25);
      k.stin.scale.setScalar(1 + l * 0.5);
      k.stin.material.opacity = (0.55 - l * 0.3) * nastup;

      const u = k.karta.material.uniforms;
      const nekdo = zvednuta >= 0 ? 1 : 0;
      u.uSvetlo.value = 1 - nekdo * (1 - l) * 0.38;
      u.uKryti.value = nastup;
      u.uOdlesk.value = -0.4 + l * 1.9;
      u.uOdleskSila.value = Math.sin(Math.PI * l);

      // Štítek pod kartou, promítnutý z 3D do HTML.
      v.set(k.karta.position.x, k.karta.position.y, k.karta.position.z + (h / 2) * Math.cos(l * controls.naklon) + 0.1);
      v.project(z.kamera);
      const sx = (v.x * 0.5 + 0.5) * z.stav.sirka - k.sirkaStitku / 2;
      const sy = (-v.y * 0.5 + 0.5) * z.stav.vyska + 4;
      k.stitek.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      k.stitek.classList.toggle('je-zvednuty', l > 0.5);
    });

    const posun = Math.max(-1, Math.min(1, (scrollY + innerHeight / 2 - stred) / innerHeight));
    z.kamera.position.set(
      kurzor.x * controls.kurzorX,
      (5.1 - posun * 0.5 + kurzor.y * controls.kurzorY) * oddaleni,
      (4.9 + posun * 0.3) * oddaleni,
    );
    z.kamera.lookAt(cilKamery);
  });

  let start = null;
  deska.addEventListener('pointerdown', (e) => { start = [e.clientX, e.clientY]; });
  deska.addEventListener('pointerup', (e) => {
    if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    paprsek.setFromCamera(ndc, z.kamera);
    const hit = paprsek.intersectObjects(jenKarty, false)[0];
    if (hit) priOtevreni(hit.object.userData.index);
  });

  await z.renderer.compileAsync(z.scena, z.kamera);
  z.vykresli();
  pripraveno = true;
  deska.classList.add('scena--pripravena');
}
