/* Jak šel čas? — deset snímků v prstenci.
 *
 * Scroll jen určuje cílový snímek; samotné otáčení dotahuje tlumení
 * v rAF smyčce, takže prstenec dojíždí měkce a nikdy necuká za kolečkem.
 * Každý snímek má na scrollu prodlevu, kdy stojí vpředu a dá se přečíst.
 */
import { THREE, zalozScenu, nactiTextury, materialKarty, sledujKurzor, tlumeni } from './tri-zaklad.js';

const controls = {
  sirka: 1,          // šířka karty; výška se dopočítá z poměru snímku
  mezera: 0.2,       // mezera mezi kartami po obvodu
  vyplnVysky: 0.6,   // kolik výšky desky zabírá karta vpředu
  vyplnSirky: 0.5,
  prodleva: 0.42,    // podíl úseku scrollu, kdy snímek stojí
  tuhost: 5.5,       // jak rychle prstenec dotáhne cíl
  vysunuti: 0.16,    // o kolik předstoupí karta vpředu
  naklon: 0.045,
  kurzorX: 0.32,
  kurzorY: 0.14,
};

export async function spust(clanek, { priZmene, priOtevreni }) {
  const deska = clanek.querySelector('.cas__scena');
  const canvas = deska.querySelector('canvas');
  const adresy = [...clanek.querySelectorAll('.pruvod img')].map((i) => i.currentSrc || i.src);
  const N = adresy.length;

  const z = zalozScenu(canvas, { fov: 28 });
  const textury = await nactiTextury(z.renderer, adresy);
  const img = textury[0].image;
  const w = controls.sirka;
  const h = w * (img.height / img.width);
  const krok = (Math.PI * 2) / N;
  const R = (N * (w + controls.mezera)) / (Math.PI * 2);

  // Jedna ohnutá geometrie pro všechny karty: plocha stočená na válec
  // o poloměru prstence, takže karty navazují a nevypadají jako desky.
  const geo = new THREE.PlaneGeometry(w, h, 40, 1);
  const poz = geo.attributes.position;
  for (let i = 0; i < poz.count; i++) {
    const a = poz.getX(i) / R;
    poz.setXYZ(i, Math.sin(a) * R, poz.getY(i), Math.cos(a) * R);
  }
  geo.computeBoundingSphere();

  const prstenec = new THREE.Group();
  prstenec.rotation.x = controls.naklon;
  z.scena.add(prstenec);

  const karty = textury.map((t, i) => {
    const rozmer = { x: w, y: h };
    const karta = new THREE.Mesh(geo, materialKarty(t, rozmer));
    const odraz = new THREE.Mesh(geo, materialKarty(t, rozmer, { odraz: true }));
    odraz.scale.y = -1;
    karta.rotation.y = odraz.rotation.y = i * krok;
    karta.userData.index = i;
    prstenec.add(karta, odraz);
    return { karta, odraz, smer: new THREE.Vector3(Math.sin(i * krok), 0, Math.cos(i * krok)), zdvih: 0 };
  });

  /* Kamera se vejde na desku na výšku i na šířku. */
  const cilKamery = new THREE.Vector3();
  let vzdalenost = 6;
  z.priVelikosti((s) => {
    const tg = Math.tan(THREE.MathUtils.degToRad(z.kamera.fov / 2));
    // Na úzké desce smí karta vpředu zabrat víc šířky, jinak by byla drobná.
    const naSirku = s.pomer < 1 ? 0.74 : controls.vyplnSirky;
    const podleVysky = h / (controls.vyplnVysky * 2 * tg);
    const podleSirky = w / (naSirku * 2 * tg * s.pomer);
    vzdalenost = Math.max(podleVysky, podleSirky);
    cilKamery.set(0, -h * 0.12, R);
    karty.forEach(({ karta, odraz }) => {
      [karta, odraz].forEach((m) => m.material.uniforms.uMlhaRozsah.value.set(vzdalenost + 0.6, vzdalenost + 2 * R + 0.2));
    });
  });

  /* Scroll -> cílový snímek. Poloha článku se měří jen při změně layoutu. */
  let zacatek = 0;
  let delka = 1;
  const premer = () => {
    const r = clanek.getBoundingClientRect();
    zacatek = r.top + scrollY;
    delka = Math.max(1, r.height - innerHeight);
  };
  premer();
  new ResizeObserver(premer).observe(document.body);

  const cilPodleScrollu = () => {
    const p = Math.min(1, Math.max(0, (scrollY - zacatek) / delka));
    const x = p * (N - 1);
    const k = Math.min(N - 2, Math.floor(x));
    const f = x - k;
    // Uprostřed úseku snímek stojí, mezi úseky se prstenec otočí.
    const t = Math.min(1, Math.max(0, (f - controls.prodleva / 2) / (1 - controls.prodleva)));
    return k + t * t * (3 - 2 * t);
  };

  let aktualni = cilPodleScrollu();
  let hlaseny = -1;
  let uvod = 0;
  let pripraveno = false;
  const kurzor = sledujKurzor(deska);
  const paprsek = new THREE.Raycaster();
  const jenKarty = karty.map((k) => k.karta);

  const rozdil = (i) => {
    // Vzdálenost karty od čela po obvodu, se znaménkem, v rozsahu ±N/2.
    let d = i - aktualni;
    d -= Math.round(d / N) * N;
    return d;
  };

  z.priSnimku((dt, cas) => {
    kurzor.krok(dt);
    aktualni += (cilPodleScrollu() - aktualni) * tlumeni(dt, controls.tuhost);
    prstenec.rotation.y = -aktualni * krok;
    prstenec.position.y = Math.sin(cas * 0.7) * 0.012;

    if (pripraveno) uvod = Math.min(1, uvod + dt / 1.6);

    karty.forEach((k, i) => {
      const d = rozdil(i);
      const ad = Math.abs(d);
      const vpredu = 1 - Math.min(1, ad);
      // Nástup: karty dosednou od čela do stran, ne naráz.
      const n = Math.min(1, Math.max(0, (uvod * 1.6 - ad * 0.12) / 0.9));
      const nastup = 1 - Math.pow(1 - n, 4);

      k.zdvih += (vpredu * 0.04 - k.zdvih) * tlumeni(dt, 6);
      const y = k.zdvih - (1 - nastup) * 0.5;
      k.karta.position.copy(k.smer).multiplyScalar(vpredu * controls.vysunuti);
      k.karta.position.y = y;
      k.odraz.position.copy(k.karta.position);
      k.odraz.position.y = -h - 0.035 - y;

      // Časová osa má začátek a konec: karty za švem prstence (2024 vedle
      // úvodu) zmizí, takže na krajích je vidět, že dál už nic není.
      const lin = Math.abs(i - aktualni);
      const vSouladu = 1 - Math.min(1, Math.max(0, (lin - (N / 2 - 1.5)) / 1));
      const svetlo = 1 - Math.min(1, ad / 1.7);
      for (const m of [k.karta, k.odraz]) {
        const u = m.material.uniforms;
        u.uSvetlo.value = svetlo * svetlo * (3 - 2 * svetlo);
        u.uKryti.value = nastup * vSouladu;
        // Pruh světla přejede kartou, jen když se hýbe; v klidu zmizí.
        u.uOdlesk.value = 0.72 + d * 2.4;
        u.uOdleskSila.value = Math.min(1, ad * 3) * (1 - Math.min(1, ad / 1.1)) * svetlo;
      }
    });

    z.kamera.position.set(
      kurzor.x * controls.kurzorX,
      0.32 + kurzor.y * controls.kurzorY,
      R + vzdalenost,
    );
    z.kamera.lookAt(cilKamery);

    const nejblizsi = ((Math.round(aktualni) % N) + N) % N;
    if (nejblizsi !== hlaseny) {
      const smer = nejblizsi > hlaseny ? 1 : -1;
      hlaseny = nejblizsi;
      priZmene(nejblizsi, smer);
    }
  });

  /* Klik: karta vpředu se otevře, karta vedle se natočí dopředu. */
  const trefa = () => {
    paprsek.setFromCamera(kurzor.ndc, z.kamera);
    const hit = paprsek.intersectObjects(jenKarty, false)[0];
    return hit ? hit.object.userData.index : -1;
  };

  deska.addEventListener('pointermove', () => {
    const i = trefa();
    deska.classList.toggle('ukazuje-kartu', i >= 0);
  });

  let start = null;
  deska.addEventListener('pointerdown', (e) => { start = [e.clientX, e.clientY]; });
  deska.addEventListener('pointerup', (e) => {
    if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    kurzor.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const i = trefa();
    if (i < 0) return;
    if (Math.abs(rozdil(i)) < 0.5) priOtevreni(i);
    else scrollTo({ top: zacatek + (i / (N - 1)) * delka, behavior: 'smooth' });
  });

  // Shadery přeložit dřív, než se canvas ukáže, jinak první snímek cukne.
  await z.renderer.compileAsync(z.scena, z.kamera);
  z.vykresli();
  pripraveno = true;
  deska.classList.add('scena--pripravena');

  return { skocNa: (i) => scrollTo({ top: zacatek + (i / (N - 1)) * delka, behavior: 'smooth' }) };
}
