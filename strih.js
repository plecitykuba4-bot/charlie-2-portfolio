/* Kudy jsem šel — cesta jako střižna.
 *
 * Projekty jsou klipy na stopách, scroll táhne přehrávací hlavu přes roky.
 * Klip pod hlavou se rozsvítí, v monitoru naskočí jeho titulek a vlevo
 * jeho popis. Hlava dojíždí tlumeně v rAF, scroll jen určuje cíl.
 */
const TLUMENI = 6;
const DELKA_TC = 465; // celková stopáž v sekundách, jen pro běžící timecode

export function spust(sekce) {
  const strih = sekce.querySelector('.strih');
  const osa = strih.querySelector('.strih__osa');
  const stopy = strih.querySelector('.strih__stopy');
  const hlava = strih.querySelector('.strih__hlava');
  const hlavaRok = strih.querySelector('.strih__hlava-rok');
  const tc = strih.querySelector('.strih__tc');
  const info = strih.querySelector('.strih__info');
  const pole = {
    stopa: info.querySelector('.strih__stopa'),
    nazev: info.querySelector('.strih__nazev'),
    roky: info.querySelector('.strih__roky'),
    popis: info.querySelector('.strih__popis'),
    titulek: strih.querySelector('.strih__titulek'),
    role: strih.querySelector('.strih__titulek-role'),
  };
  const klipy = [...strih.querySelectorAll('.strih__klip')].map((el) => ({
    el,
    od: Number(el.dataset.od),
    do: Number(el.dataset.do),
  }));

  const styl = getComputedStyle(osa);
  const Z = Number(styl.getPropertyValue('--zacatek'));
  const K = Number(styl.getPropertyValue('--konec'));
  const TED = Number(styl.getPropertyValue('--ted'));

  /* Rozměry se měří jen při změně layoutu, ne každý snímek. */
  let zacatek = 0;
  let delka = 1;
  let drahaX = 0;
  let drahaW = 1;
  const zmer = () => {
    const r = strih.getBoundingClientRect();
    zacatek = r.top + scrollY;
    delka = Math.max(1, r.height - innerHeight);
    const s = stopy.getBoundingClientRect();
    const d = stopy.querySelector('.strih__draha').getBoundingClientRect();
    drahaX = d.left - s.left;
    drahaW = d.width;
  };
  zmer();
  new ResizeObserver(zmer).observe(document.body);

  const cil = () => {
    const p = Math.min(1, Math.max(0, (scrollY - zacatek) / delka));
    return Z + p * (TED - Z);
  };

  let t = cil();
  let aktivni = null;

  const ukaz = (k) => {
    if (k === aktivni) return;
    aktivni = k;
    pole.stopa.textContent = k.el.dataset.stopa;
    pole.nazev.textContent = k.el.textContent;
    pole.nazev.classList.toggle('je-dlouhy', k.el.textContent.length > 24);
    pole.roky.textContent = k.el.dataset.roky;
    pole.popis.textContent = k.el.dataset.popis;
    pole.role.textContent = k.el.textContent;
    for (const el of [info, pole.titulek]) {
      el.classList.remove('meni');
      void el.offsetWidth;
      el.classList.add('meni');
    }
  };

  const krok = (dt) => {
    t += (cil() - t) * (1 - Math.exp(-dt * TLUMENI));
    const x = drahaX + ((t - Z) / (K - Z)) * drahaW;
    hlava.style.transform = `translateX(${x.toFixed(1)}px)`;
    hlavaRok.textContent = Math.floor(t);

    const sekundy = ((t - Z) / (TED - Z)) * DELKA_TC;
    const s = Math.floor(sekundy);
    tc.textContent = ['00', String(Math.floor(s / 60)).padStart(2, '0'), String(s % 60).padStart(2, '0'),
      String(Math.floor((sekundy - s) * 25)).padStart(2, '0')].join(':');

    // Pod hlavou může být víc klipů; vede ten, který začal nejpozději.
    let vede = null;
    for (const k of klipy) {
      const bezi = t >= k.od - 0.001 && t <= k.do + 0.001;
      k.el.classList.toggle('je-prosly', t >= k.od);
      if (bezi && (!vede || k.od >= vede.od)) vede = k;
    }
    klipy.forEach((k) => k.el.classList.toggle('je-aktivni', k === vede));
    if (vede) ukaz(vede);
  };

  /* Smyčka běží jen když je střižna v obraze. Scroll ji navíc probudí,
     kdyby observer nevystřelil. */
  let videt = false;
  let bezi = false;
  let posledni = 0;
  const smycka = (cas) => {
    if (!videt) { bezi = false; return; }
    krok(Math.min((cas - posledni) / 1000 || 0.016, 0.05));
    posledni = cas;
    requestAnimationFrame(smycka);
  };
  const start = () => {
    if (bezi || !videt) return;
    bezi = true;
    posledni = performance.now();
    requestAnimationFrame(smycka);
  };
  new IntersectionObserver(([z]) => { videt = z.isIntersecting; start(); }, { rootMargin: '80px 0px' }).observe(strih);

  // Klik na klip dojede hlavou na jeho začátek.
  klipy.forEach((k) => k.el.addEventListener('click', () => {
    const p = (k.od - Z + 0.04) / (TED - Z);
    scrollTo({ top: zacatek + Math.min(1, p) * delka, behavior: 'smooth' });
  }));

  krok(1);
}
