/* Nadpis se drží u hlavy.
 *
 * Nadpis škáluje se šířkou okna, portrét s jeho výškou, takže na širokém
 * monitoru se oba rozejdou a mezi posledním písmenem a hlavou zůstane
 * oranžová díra. Proto se velikost nadpisu dopočítá z toho, kde postava
 * v jeho výšce opravdu začíná.
 *
 * SILUETA je levý okraj neprůhledné části portrétu po jednom procentu
 * jeho výšky (podíl šířky snímku), odečtený z hero-charlie.png.
 */
const SILUETA = [
  0.4302, 0.3928, 0.3669, 0.3252, 0.2993, 0.282, 0.2604, 0.2475, 0.2403,
  0.2302, 0.2173, 0.2029, 0.1899, 0.1784, 0.1712, 0.1655, 0.1597, 0.1554,
  0.1525, 0.1511, 0.1511, 0.1511, 0.1525, 0.154, 0.1583, 0.1612, 0.164,
  0.1698, 0.1755, 0.1755, 0.1827, 0.1928, 0.1971, 0.2029, 0.2158, 0.2187,
  0.2216, 0.2273, 0.2245, 0.2245, 0.2201, 0.2173, 0.2129, 0.2101, 0.2086,
  0.2043, 0.2014, 0.2014, 0.2014, 0.1986, 0.1928, 0.1899, 0.1914, 0.2489,
  0.2388, 0.2331, 0.2317, 0.2288, 0.2245, 0.2187, 0.2144, 0.2058, 0.1971,
  0.1971, 0.2043, 0.2101, 0.1914, 0.1741, 0.1554, 0.1353, 0.1194, 0.1022,
  0.0964, 0.1022, 0.0935, 0.0345, 0.0216, 0.0173, 0.0173, 0.0173, 0.0058,
  0.0058, 0.0086, 0.0187, 0.0158, 0.0043, 0.0043, 0.0043, 0.0043, 0.0043,
  0.0043, 0.0043, 0.0043, 0.0043, 0.0043, 0.0043, 0.0043, 0.0043, 0.0043,
  0.0043, 0.0072,
];

/* O kolik smí nadpis zajet za obrys — v předloze poslední písmeno mizí
   jen špičkou — písmeno musí zůstat čitelné. Podíl šířky nadpisu. */
const PREKRYV = 0.055;

const hero = document.querySelector('.hero');
const title = document.querySelector('.hero__title');
const portret = document.querySelector('.hero__portrait');

function obrysVPasu(portretRect, odY, doY) {
  // Nejmenší (nejlevější) okraj siluety v pásu, který nadpis zabírá.
  const vyska = portretRect.height;
  let min = 1;
  for (let i = 0; i < SILUETA.length; i++) {
    const y = portretRect.top + (vyska * i) / SILUETA.length;
    if (y < odY - vyska / SILUETA.length || y > doY) continue;
    if (SILUETA[i] < min) min = SILUETA[i];
  }
  return min;
}

function dolad() {
  if (!hero || !title || !portret || !portret.complete) return;

  title.style.fontSize = '';
  // Na mobilu stojí nadpis nad portrétem, takže se k hlavě nedolaďuje.
  if (matchMedia('(max-width: 900px)').matches) return;
  const t = title.getBoundingClientRect();
  const p = portret.getBoundingClientRect();
  if (!t.width || !p.width) return;

  const podil = obrysVPasu(p, t.top, t.bottom);
  const hlavaX = p.left + p.width * podil;
  const cil = hlavaX - t.left + t.width * PREKRYV;
  if (cil <= 0) return;

  const zaklad = parseFloat(getComputedStyle(title).fontSize);
  const nova = zaklad * (cil / t.width);
  // Meze, ať nadpis nepřeroste desku ani nezmizí.
  const strop = hero.clientHeight * 0.50;
  title.style.fontSize = Math.max(40, Math.min(nova, strop)) + 'px';
}

if (portret) {
  if (portret.complete) dolad();
  else portret.addEventListener('load', dolad);
  document.fonts?.ready.then(dolad);
  addEventListener('resize', dolad);
}

/* Sekce a jejich bloky najíždějí, jakmile se dostanou do zorného pole.
 *
 * Záměrně bez IntersectionObserver: kdyby z jakéhokoli důvodu nevystřelil,
 * zůstal by celý obsah pod herem neviditelný. Tohle počítá polohu samo
 * a navíc má pojistku, která po chvíli odkryje všechno.
 */
const najizdi = [...document.querySelectorAll(
  '.sekce__hlava, .obory li, .osa li, .blok:not(.cas), .cas__text, .strih__osa, .export, .formular'
)];

/* Nadpisy se neodkrývají posunem, ale odhrnutím masky zleva doprava. */
const odhrnout = [...document.querySelectorAll('.sekce__nadpis')];

if (najizdi.length || odhrnout.length) {
  najizdi.forEach((el) => el.classList.add('najede'));
  odhrnout.forEach((el) => el.classList.add('odhrne'));

  /* Sousedi ve stejné skupině nastupují po sobě, ne naráz. */
  const skupiny = new Map();
  najizdi.forEach((el) => {
    const rodic = el.parentElement;
    const rada = skupiny.get(rodic) || [];
    rada.push(el);
    skupiny.set(rodic, rada);
  });
  skupiny.forEach((rada) => {
    if (rada.length < 2) return;
    rada.forEach((el, i) => {
      el.style.setProperty('--nastup', (i * 80) + 'ms');
    });
  });

  const vse = [...najizdi, ...odhrnout];

  let ceka = false;
  const odkryj = () => {
    ceka = false;
    const mez = innerHeight * 0.88;
    vse.forEach((el) => {
      if (el.classList.contains('je-videt')) return;
      if (el.getBoundingClientRect().top < mez) el.classList.add('je-videt');
    });
  };
  const naplanuj = () => {
    if (ceka) return;
    ceka = true;
    requestAnimationFrame(odkryj);
  };

  addEventListener('scroll', naplanuj, { passive: true });
  addEventListener('resize', naplanuj);
  naplanuj();

  // Pojistka: kdyby výpočet selhal a neodkryl ani první blok, odkryjeme
  // po dvou vteřinách všechno — prázdná stránka je horší než chybějící efekt.
  setTimeout(() => {
    if (document.querySelector('.je-videt')) return;
    vse.forEach((el) => el.classList.add('je-videt'));
  }, 2000);
}


/* Pomocné dotazy na prostředí ------------------------------------------ */
const jemnyPohyb = matchMedia('(prefers-reduced-motion: reduce)');

/* Hloubka v heru -------------------------------------------------------
 *
 * Portrét se při scrollu posouvá pomaleji než text, takže hero získá
 * hloubku. Posun je jen transform a počítá se v už existujícím rAF cyklu.
 */
if (!jemnyPohyb.matches && portret && hero) {
  let planuje = false;

  const hloubka = () => {
    planuje = false;
    const posun = scrollY;
    if (posun > hero.offsetHeight) return;
    hero.style.setProperty('--hloubka', (posun * 0.14).toFixed(1) + 'px');
  };

  addEventListener('scroll', () => {
    if (planuje) return;
    planuje = true;
    requestAnimationFrame(hloubka);
  }, { passive: true });

  hloubka();
}


/* Odeslání formuláře ---------------------------------------------------
 *
 * Formulář odchází na pozadí, takže se neotevírá poštovní klient a
 * návštěvník neopustí stránku. Tlačítko mezitím prochází stavy
 * Odeslat → Odesílám → Odesláno.
 *
 * Bez vyplněného access_key se odesílat nedá; v tom případě to řekneme
 * rovnou místo abychom předstírali, že zpráva odešla.
 */
const formular = document.querySelector('.formular');
const hlaska = document.querySelector('.hlaska');

if (formular && hlaska) {
  const tlacitko = formular.querySelector('button[type="submit"]');
  const popisek = tlacitko.querySelector('span');
  const klid = popisek.dataset.klid || popisek.textContent;

  const stav = (text, trida) => {
    hlaska.textContent = text;
    hlaska.className = 'hlaska' + (trida ? ' hlaska--' + trida : '');
  };

  formular.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!formular.reportValidity()) return;

    const data = new FormData(formular);
    // Dokud formulář nemá klíč, zpráva aspoň neskončí v prázdnu: otevře se
    // e-mail s předvyplněným textem.
    if (!data.get('access_key')) {
      const predmet = 'Zpráva z webu od ' + data.get('jmeno');
      const telo = data.get('zprava') + '\n\n' + data.get('jmeno') + ' <' + data.get('email') + '>';
      location.href = 'mailto:drexleroutreach@gmail.com?subject=' + encodeURIComponent(predmet) + '&body=' + encodeURIComponent(telo);
      stav('Otevřel se vám e-mail s předvyplněnou zprávou, stačí ho odeslat.', 'ok');
      return;
    }

    tlacitko.disabled = true;
    tlacitko.classList.add('btn--pracuje');
    popisek.textContent = 'Odesílám';
    stav('');

    try {
      const odpoved = await fetch(formular.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      });
      const vysledek = await odpoved.json().catch(() => ({}));

      if (odpoved.ok && vysledek.success !== false) {
        tlacitko.classList.remove('btn--pracuje');
        tlacitko.classList.add('btn--hotovo');
        popisek.textContent = 'Odesláno';
        stav('Díky, ozvu se do dvou dnů.', 'ok');
        formular.reset();
        setTimeout(() => {
          tlacitko.classList.remove('btn--hotovo');
          popisek.textContent = klid;
          tlacitko.disabled = false;
        }, 2600);
      } else {
        throw new Error(vysledek.message || 'odeslání selhalo');
      }
    } catch (chyba) {
      tlacitko.classList.remove('btn--pracuje');
      popisek.textContent = klid;
      tlacitko.disabled = false;
      stav('Nepodařilo se odeslat. Zkuste to znovu, nebo napište na drexleroutreach@gmail.com.', 'chyba');
    }
  });
}


/* Menu ------------------------------------------------------------------
 *
 * Kruh se rozevře z burgeru přes celou obrazovku. Esc, klik na odkaz
 * i druhý klik na burger ho zavřou a fokus se vrátí na burger.
 */
const burger = document.querySelector('.nav__burger');
const menu = document.getElementById('menu');

if (burger && menu) {
  const otevri = () => {
    menu.hidden = false;
    // Až další snímek, ať se přechod clip-path opravdu spustí.
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('je-otevrene')));
    document.documentElement.classList.add('menu-otevreno');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Zavřít menu');
    menu.querySelector('a')?.focus({ preventScroll: true });
  };
  const zavri = (vratFokus = true) => {
    menu.classList.remove('je-otevrene');
    document.documentElement.classList.remove('menu-otevreno');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Otevřít menu');
    setTimeout(() => { if (!menu.classList.contains('je-otevrene')) menu.hidden = true; }, 800);
    if (vratFokus) burger.focus({ preventScroll: true });
  };
  burger.addEventListener('click', () => (menu.classList.contains('je-otevrene') ? zavri() : otevri()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) zavri(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('je-otevrene')) zavri(); });
}


/* Magnetická tlačítka a světlo pod kurzorem ------------------------------ */
const jemnyKurzor = matchMedia('(hover: hover) and (pointer: fine)');

if (jemnyKurzor.matches && !jemnyPohyb.matches) {
  document.querySelectorAll('.btn').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mag-x', ((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1) + 'px');
      btn.style.setProperty('--mag-y', ((e.clientY - r.top - r.height / 2) * 0.36).toFixed(1) + 'px');
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.setProperty('--mag-x', '0px');
      btn.style.setProperty('--mag-y', '0px');
    });
  });

  document.querySelectorAll('.znacky figure, .bento figure, .posledni').forEach((el) => {
    el.classList.add('svetlo');
    const naklon = el.matches('.znacky figure') ? 7 : 3;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      el.style.setProperty('--ry', ((x - 0.5) * naklon).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y) * naklon).toFixed(2) + 'deg');
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}


/* Lightbox --------------------------------------------------------------
 *
 * Každý blok s data-galerie je jedna galerie. Šipky a klávesy listují
 * jen v ní, na dotyku se dá táhnout prstem.
 */
const lightbox = document.querySelector('.lightbox');
const galerie = new Map();

if (lightbox && typeof lightbox.showModal === 'function') {
  const obraz = lightbox.querySelector('.lightbox__obraz');
  // Obrázek vzniká až tady: v HTML by bez src visel rozbitý.
  const img = document.createElement('img');
  obraz.prepend(img);
  const popis = obraz.querySelector('figcaption');
  const pocet = lightbox.querySelector('.lightbox__pocet');
  let aktivni = [];
  let index = 0;

  const ukaz = (i, animuj = true) => {
    index = (i + aktivni.length) % aktivni.length;
    const zdroj = aktivni[index];
    img.src = zdroj.src;
    img.alt = zdroj.alt;
    popis.textContent = zdroj.alt;
    pocet.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(aktivni.length).padStart(2, '0');
    if (animuj) {
      obraz.classList.remove('meni');
      void obraz.offsetWidth;
      obraz.classList.add('meni');
    }
  };

  window.otevriGalerii = (blok, i) => {
    aktivni = galerie.get(blok) || [];
    if (!aktivni.length) return;
    lightbox.classList.toggle('lightbox--sam', aktivni.length < 2);
    ukaz(i, false);
    lightbox.showModal();
  };

  document.querySelectorAll('[data-galerie]').forEach((blok) => {
    // Náhledy mají vlastní seznam; obrázek na plátně se jen mění.
    if (blok.classList.contains('nahledy')) {
      galerie.set(blok, [...blok.querySelectorAll('.nahledy__vyber button')]
        .map((b) => ({ src: b.dataset.src, alt: b.getAttribute('aria-label') })));
      return;
    }
    const obrazky = [...blok.querySelectorAll('figure img')];
    galerie.set(blok, obrazky.map((i) => ({ src: i.currentSrc || i.src, alt: i.alt })));
    obrazky.forEach((i, n) => i.addEventListener('click', () => window.otevriGalerii(blok, n)));
  });

  lightbox.querySelector('.lightbox__zavrit').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('.lightbox__sipka--zpet').addEventListener('click', () => ukaz(index - 1));
  lightbox.querySelector('.lightbox__sipka--dal').addEventListener('click', () => ukaz(index + 1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') ukaz(index - 1);
    if (e.key === 'ArrowRight') ukaz(index + 1);
  });
  lightbox.addEventListener('close', () => { img.removeAttribute('src'); });

  let dotyk = null;
  lightbox.addEventListener('touchstart', (e) => { dotyk = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    if (dotyk === null) return;
    const dx = e.changedTouches[0].clientX - dotyk;
    if (Math.abs(dx) > 50) ukaz(index + (dx < 0 ? 1 : -1));
    dotyk = null;
  });
}


/* Thumbnaily: náhled od feedu po celou šířku ------------------------------ */
const nahledy = document.querySelector('.nahledy');

if (nahledy) {
  const platno = nahledy.querySelector('.nahledy__platno');
  const karta = nahledy.querySelector('.nahledy__karta');
  const obr = karta.querySelector('img');
  const posuvnik = nahledy.querySelector('input[type="range"]');
  const px = nahledy.querySelector('.nahledy__px');
  const zastavky = [...nahledy.querySelectorAll('[data-zastavka]')];
  const vyber = [...nahledy.querySelectorAll('.nahledy__vyber button')];
  const NEJMENSI = 168;
  let plna = 900;

  // Posuvník je logaritmický: mezi 168 a 360 px se rozhoduje nejvíc,
  // tak tam dostane nejvíc dráhy.
  const naPx = (v) => NEJMENSI * Math.pow(plna / NEJMENSI, v / 1000);
  const zPx = (p) => (1000 * Math.log(p / NEJMENSI)) / Math.log(plna / NEJMENSI);

  const nastav = (v) => {
    const sirka = naPx(v);
    karta.style.setProperty('--meritko', (sirka / plna).toFixed(4));
    posuvnik.style.setProperty('--plneni', (v / 10).toFixed(1) + '%');
    px.textContent = Math.round(sirka);
    posuvnik.setAttribute('aria-valuetext', Math.round(sirka) + ' pixelů');
    zastavky.forEach((b) => {
      const cil = b.dataset.zastavka === 'max' ? plna : Number(b.dataset.zastavka);
      b.classList.toggle('je-aktivni', Math.abs(cil - sirka) < 4);
    });
  };

  // Plná šířka = plátno bez okraje; na výšku se musí vejít i s popiskem.
  const zmer = () => {
    plna = Math.min(platno.clientWidth * 0.86, platno.clientHeight * 0.8 * (16 / 9));
    karta.style.setProperty('--sirka-plna', plna.toFixed(0) + 'px');
    nastav(Number(posuvnik.value));
  };
  new ResizeObserver(zmer).observe(platno);

  posuvnik.addEventListener('input', () => nastav(Number(posuvnik.value)));

  let animace = 0;
  const dojed = (cil, delka = 900) => {
    cancelAnimationFrame(animace);
    if (jemnyPohyb.matches) { posuvnik.value = cil; nastav(cil); return; }
    const od = Number(posuvnik.value);
    const t0 = performance.now();
    const krok = (t) => {
      const k = Math.min(1, (t - t0) / delka);
      const e = 1 - Math.pow(1 - k, 4);
      posuvnik.value = od + (cil - od) * e;
      nastav(Number(posuvnik.value));
      if (k < 1) animace = requestAnimationFrame(krok);
    };
    animace = requestAnimationFrame(krok);
  };

  zastavky.forEach((b) => b.addEventListener('click', () => {
    const cil = b.dataset.zastavka === 'max' ? 1000 : zPx(Number(b.dataset.zastavka));
    dojed(Math.max(0, Math.min(1000, cil)));
  }));

  // Před a po: jen když má aspoň jeden náhled přiloženou původní fotku.
  let stetec = null;
  if (vyber.some((b) => b.dataset.pred) && jemnyKurzor.matches) {
    import('./stetec.js').then(({ zalozStetec }) => {
      stetec = zalozStetec(karta);
      stetec.nastav(vyber.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.pred);
    });
  }

  vyber.forEach((b, i) => b.addEventListener('click', () => {
    vyber.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    obr.src = b.dataset.src;
    obr.alt = b.getAttribute('aria-label');
    obr.dataset.index = i;
    stetec?.nastav(b.dataset.pred);
  }));

  obr.addEventListener('click', () => window.otevriGalerii?.(nahledy, Number(obr.dataset.index || 0)));

  // Při prvním vstupu do obrazu náhled sám vyroste z feedu na plnou
  // šířku: to je celá pointa bloku, ukázaná dřív, než na něco klikneš.
  new IntersectionObserver(([z], obs) => {
    if (!z.isIntersecting) return;
    obs.disconnect();
    setTimeout(() => dojed(1000, 1800), 350);
  }, { threshold: 0.55 }).observe(platno);
}


/* Video: YouTube až po kliknutí ------------------------------------------ */
document.querySelectorAll('[data-youtube]').forEach((tl) => {
  tl.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + tl.dataset.youtube + '?autoplay=1&rel=0';
    iframe.title = tl.getAttribute('aria-label').replace('Přehrát video ', '');
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    tl.replaceWith(iframe);
  });
});


/* 3D scény ---------------------------------------------------------------
 *
 * Three.js se stáhne, až když se blok blíží. Bez WebGL nebo s omezeným
 * pohybem zůstanou vidět původní mřížky.
 */
const umiWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
})();

const spustPriPriblizeni = (prvek, fn) => {
  new IntersectionObserver(([z], obs) => {
    if (!z.isIntersecting) return;
    obs.disconnect();
    fn();
  }, { rootMargin: '100% 0px' }).observe(prvek);
};

const cas = document.querySelector('.cas');
if (cas && umiWebGL && !jemnyPohyb.matches) {
  cas.classList.add('cas--3d');
  const hodnota = cas.querySelector('.cas__rok-hodnota');
  const popisCasu = cas.querySelector('.cas__popis');
  const tiky = [...cas.querySelectorAll('.cas__osa li')];
  const roky = tiky.map((li) => li.textContent.trim());

  spustPriPriblizeni(cas, () => {
    import('./scena-cas.js').then(({ spust }) => spust(cas, {
      priZmene: (i, smer) => {
        hodnota.textContent = roky[i] === 'Úvod' ? 'MS' : roky[i];
        hodnota.classList.remove('jede-nahoru', 'jede-dolu');
        void hodnota.offsetWidth;
        hodnota.classList.add(smer > 0 ? 'jede-nahoru' : 'jede-dolu');
        popisCasu.textContent = i === 0 ? 'Úvodní slide' : 'Zlato na mistrovství světa';
        tiky.forEach((li, n) => {
          li.classList.toggle('je-aktivni', n === i);
          li.classList.toggle('je-prosly', n < i);
        });
      },
      priOtevreni: (i) => window.otevriGalerii?.(cas, i),
    })).catch((chyba) => {
      // Když 3D selže, vrátí se vodorovný průvod. Prázdná deska je horší.
      console.warn('3D prstenec se nespustil', chyba);
      cas.classList.remove('cas--3d');
    });
  });
}

const green = document.querySelector('.green');
if (green && umiWebGL && !jemnyPohyb.matches) {
  green.classList.add('green--3d');
  spustPriPriblizeni(green, () => {
    import('./scena-green.js').then(({ spust }) => spust(green, {
      priOtevreni: (i) => window.otevriGalerii?.(green, i),
    })).catch((chyba) => {
      console.warn('3D pětka se nespustila', chyba);
      green.classList.remove('green--3d');
    });
  });
}


/* Kudy jsem šel jako střižna --------------------------------------------- */
const cesta = document.getElementById('cesta');
if (cesta && cesta.querySelector('.strih') && !jemnyPohyb.matches) {
  cesta.classList.add('sekce--strih');
  import('./strih.js')
    .then(({ spust }) => spust(cesta))
    .catch((chyba) => {
      console.warn('Střižna se nespustila', chyba);
      cesta.classList.remove('sekce--strih');
    });
}


/* Volba zakázky -----------------------------------------------------------
 *
 * Zaškrtnuté služby se poskládají do pořadí práce. Mezi kroky stojí
 * přeškrtnuté předání, které u jednoho člověka odpadá. Tlačítko výběr
 * vepíše do zprávy ve formuláři; vlastní text návštěvníka nepřepíše.
 */
const exportZakazky = document.querySelector('.export');

if (exportZakazky) {
  const volby = [...exportZakazky.querySelectorAll('input[type="checkbox"]')];
  const plan = exportZakazky.querySelector('.export__plan');
  const souhrn = exportZakazky.querySelector('.export__souhrn');
  const tlacitko = exportZakazky.querySelector('.export__tlacitko');
  const zprava = document.querySelector('.formular textarea[name="zprava"]');
  let minule = new Set();

  const tvar = (n, jeden, dva, pet) => (n === 1 ? jeden : n >= 2 && n <= 4 ? dva : pet);

  const vykresli = () => {
    const vybrane = volby.filter((v) => v.checked);
    const ted = new Set(vybrane.map((v) => v.value));
    plan.textContent = '';

    if (!vybrane.length) {
      const li = document.createElement('li');
      li.className = 'export__prazdny';
      li.textContent = 'Vyberte aspoň jednu věc.';
      plan.append(li);
    }

    vybrane.forEach((v, i) => {
      const novy = !minule.has(v.value);
      if (i > 0) {
        const predani = document.createElement('li');
        predani.className = 'export__predani' + (novy ? ' novy' : '');
        predani.innerHTML = '<s>Předání dalšímu dodavateli</s><em>odpadá</em>';
        plan.append(predani);
      }
      const stitek = v.closest('label');
      const krok = document.createElement('li');
      krok.className = 'export__krok' + (novy ? ' novy' : '');
      krok.innerHTML = '<span class="export__cislo"></span><b></b><small></small>';
      krok.querySelector('.export__cislo').textContent = i + 1;
      krok.querySelector('b').textContent = stitek.querySelector('.export__nazev').textContent;
      krok.querySelector('small').textContent = stitek.querySelector('.export__popis').textContent;
      plan.append(krok);
    });

    const n = vybrane.length;
    souhrn.innerHTML = n
      ? '<strong>' + n + '</strong> ' + tvar(n, 'výstup', 'výstupy', 'výstupů') + ' · <strong>1</strong> člověk · <strong>0</strong> předání'
        + (n > 1 ? '<br>U víc dodavatelů by si práci předávali ' + (n - 1) + '×.' : '')
      : '';
    tlacitko.disabled = !n;
    minule = ted;
  };

  volby.forEach((v) => v.addEventListener('change', vykresli));
  vykresli();

  if (zprava) {
    zprava.addEventListener('input', () => { zprava.dataset.zExportu = '0'; });
  }

  exportZakazky.addEventListener('submit', (e) => {
    e.preventDefault();
    const co = volby.filter((v) => v.checked).map((v) => v.dataset.doZpravy);
    if (!co.length) return;
    const seznam = co.length > 1 ? co.slice(0, -1).join(', ') + ' a ' + co[co.length - 1] : co[0];
    if (zprava && (!zprava.value.trim() || zprava.dataset.zExportu === '1')) {
      zprava.value = 'Dobrý den, potřebuji ' + seznam + '. ';
      zprava.dataset.zExportu = '1';
      zprava.classList.remove('z-exportu');
      void zprava.offsetWidth;
      zprava.classList.add('z-exportu');
    }
    document.getElementById('kontakt')?.scrollIntoView({ behavior: jemnyPohyb.matches ? 'auto' : 'smooth' });
    setTimeout(() => document.querySelector('.formular input[name="jmeno"]')?.focus({ preventScroll: true }), 700);
  });
}
