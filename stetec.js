/* Před a po: štětec pod kurzorem setře hotový thumbnail a ukáže fotku,
 * ze které vznikl. Stopa štětce pomalu zarůstá, takže náhled se sám
 * vrátí do hotové podoby.
 *
 * Zapne se jen u náhledu, který má u tlačítka ve výběru data-pred
 * s cestou k původní fotce. Bez ní se nic nekreslí.
 */
const controls = {
  stopa: 0.11,       // poloměr štětce jako podíl šířky náhledu
  zarust: 0.012,     // jak rychle stopa mizí (podíl za snímek při 60 fps)
};

export function zalozStetec(karta) {
  const obr = karta.querySelector('img');
  const canvas = document.createElement('canvas');
  canvas.className = 'nahledy__stetec';
  canvas.setAttribute('aria-hidden', 'true');
  obr.after(canvas);
  const g = canvas.getContext('2d');
  const maska = document.createElement('canvas');
  const mg = maska.getContext('2d');

  let pred = null;
  let bezi = false;
  let posledniPohyb = 0;
  let posledni = null;
  let cas = 0;

  const velikost = () => {
    const w = obr.offsetWidth;
    const h = obr.offsetHeight;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = maska.width = Math.max(1, Math.round(w * dpr));
    canvas.height = maska.height = Math.max(1, Math.round(h * dpr));
  };
  new ResizeObserver(velikost).observe(obr);

  const tah = (x, y) => {
    const r = canvas.width * controls.stopa;
    const kroky = posledni ? Math.ceil(Math.hypot(x - posledni[0], y - posledni[1]) / (r * 0.3)) : 1;
    for (let i = 1; i <= kroky; i++) {
      const px = posledni ? posledni[0] + ((x - posledni[0]) * i) / kroky : x;
      const py = posledni ? posledni[1] + ((y - posledni[1]) * i) / kroky : y;
      const grad = mg.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.55, 'rgba(0,0,0,.85)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      mg.globalCompositeOperation = 'source-over';
      mg.fillStyle = grad;
      mg.beginPath();
      mg.arc(px, py, r, 0, Math.PI * 2);
      mg.fill();
    }
    posledni = [x, y];
  };

  const snimek = (t) => {
    // Časová značka rAF může být starší než performance.now() z události.
    const dt = Math.min(Math.max((t - cas) / 16.67, 0), 3);
    cas = t;
    // Stopa zarůstá.
    mg.globalCompositeOperation = 'destination-out';
    mg.fillStyle = `rgba(0,0,0,${controls.zarust * dt})`;
    mg.fillRect(0, 0, maska.width, maska.height);

    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(pred, 0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(maska, 0, 0);

    // Po pěti vteřinách bez pohybu je stopa pryč a smyčka se zastaví.
    if (t - posledniPohyb < 5000) requestAnimationFrame(snimek);
    else { bezi = false; g.clearRect(0, 0, canvas.width, canvas.height); }
  };

  canvas.addEventListener('pointermove', (e) => {
    if (!pred) return;
    const r = canvas.getBoundingClientRect();
    tah(((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height);
    posledniPohyb = performance.now();
    if (!bezi) { bezi = true; cas = posledniPohyb; requestAnimationFrame(snimek); }
  });
  canvas.addEventListener('pointerleave', () => { posledni = null; });
  // Klik prochází na obrázek pod canvasem, ať se dál otevírá lightbox.
  canvas.addEventListener('click', () => obr.click());

  return {
    nastav(src) {
      pred = null;
      karta.classList.toggle('ma-pred', !!src);
      mg.clearRect(0, 0, maska.width, maska.height);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (!src) return;
      const i = new Image();
      i.onload = () => { pred = i; velikost(); };
      i.src = src;
    },
  };
}
