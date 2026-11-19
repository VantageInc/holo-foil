// Логотип Vantage, тиснённый голографической фольгой на тёмной бумажной карточке.
// Рисует набор holospot (материалы holo.spot, MIT) — тот же движок, которым сняты эталонные видео.
// Здесь только сцена: карточка, свет, камера, движение.
import * as THREE from 'three';
import { Holo } from 'holospot';
import { mountPanel } from './panel.js';

// Набор holospot получает картинки через fetch(), в том числе data:-адреса: так к нему приходит композиция
// (buildArtwork) и свои текстуры для рельефа. На claude.ai (опубликованная страница) fetch по data: запрещён
// политикой площадки, набор молча остаётся без картинки, и карточка выходит пустой. Поэтому data:-адреса
// разбираем здесь сами, без сети; всё остальное идёт в обычный fetch.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null;
  if (!url || !url.startsWith('data:')) return nativeFetch(input, init);
  try {
    const comma = url.indexOf(',');
    const meta = url.slice(5, comma), body = url.slice(comma + 1);
    const bytes = meta.endsWith(';base64') ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body));
    return Promise.resolve(new Response(new Blob([bytes], { type: meta.split(';')[0] || 'text/plain' }), { status: 200 }));
  } catch (err) {
    return Promise.reject(err);
  }
};

const PHONE = matchMedia('(pointer: coarse)').matches;

const CONFIG = {
  logo: new URL('./logo.svg', import.meta.url).href,
  // Композиция на карточке, по образцу карточки из эталонного видео: глобус, под ним во всю ширину надпись
  // Vantage Inc., две строки мелкого текста слева и код справа, внизу три соединённых овала с подписями.
  // Глобус и надпись берутся из logo.svg (они разделяются по пустой полосе между ними), остальное рисуется
  // здесь же; всё вместе идёт в движок одной картинкой. Размеры — в долях ширины композиции.
  art: {
    width: 50,                  // ширина композиции на карточке, мм
    globe: 0.74,                // ширина глобуса
    lines: ['SOLVITUR IN SILENTIO', 'MXXIV'],   // мелкий текст слева, по строке
    code: 'AXM',                // справа на уровне последней строки
    pills: ['INTENT', 'PROVE', 'SETTLE'],
    font: 'Bahnschrift, "Segoe UI", Arial, sans-serif',   // системный шрифт Windows; текст в картинке, файл шрифта не нужен
    textSize: 0.048, pillTextSize: 0.045, tracking: 0.08, bold: 0.035,   // размер, разрядка и утолщение штриха текста
    gaps: [0.05, 0.055, 0.05],  // отступы: глобус — надпись — текст — овалы
    pillHeight: 0.168, pillRing: 0.031, pillNeck: 0.36,   // высота овалов, толщина их контура, толщина перемычки (доля высоты)
  },
  // low | medium | high — шейдеры тяжёлые. На телефоне и планшете (палец вместо мыши) — low и без запаса
  // по разрешению: так советует автор набора, иначе слабая графика не тянет.
  quality: PHONE ? 'low' : 'high',
  // Сглаживание: кадр считается с запасом по разрешению и уменьшается до размера окна. 2 — вчетверо больше
  // пикселей на обычном экране; набор сам урежет запас, если кадр не помещается в его лимит (8,3 Мп на high).
  supersample: PHONE ? 1 : 2,

  // Цвета фольги. Значения по умолчанию; на странице ими управляет раздел «Цвета» панели (panel.js), его
  // настройки хранятся в браузере и перекрывают эти. «Копировать» в панели даёт такой же объект.
  // Движок считает настоящую радугу; после него отдельный проход переводит её оттенки в цвета палитры.
  //   palette — цвета; hue — на какой оттенок радуги (0…1 по кругу: 0 красный, 0.33 зелёный, 0.66 синий) цвет
  //             встаёт. Пять фирменных цветов стоят на круге неравномерно: между зелёным и синим и между синим
  //             и рубиновым пусто по трети круга, туда добавлены два мостика — бирюзовый и фиолетовый.
  //   amount  — 0 — радуга как есть, 1 — только цвета палитры
  //   white   — фольга с насыщенностью ниже первого числа остаётся белой и серебряной (блики, пересвет), выше
  //             второго — чистый цвет палитры, между ними — плавный переход от белого к цвету
  //   gain    — яркость: при 1 точный цвет палитры получается только в самых ярких местах фольги
  //   lift    — насколько самые яркие места светлеют к белому (0 — ровная заливка цветом)
  //   soft    — ширина перехода между соседними цветами: 0 — резкая граница, 0.5 — сплошной градиент
  colours: {
    palette: [
      { hex: '#F35A0E', hue: 0.07 },   // оранжевый
      { hex: '#FFC123', hue: 0.15 },   // жёлтый
      { hex: '#249118', hue: 0.33 },   // зелёный
      { hex: '#0FA3A3', hue: 0.5 },    // бирюзовый — мостик
      { hex: '#1D52D8', hue: 0.66 },   // синий
      { hex: '#7A35D6', hue: 0.8 },    // фиолетовый — мостик
      { hex: '#BA214A', hue: 0.96 },   // рубиновый
    ],
    amount: 1, white: [0.06, 0.32], gain: 1.25, lift: 1.4, soft: 0.4,
  },

  // Свечение вокруг ярких бликов (раздел «Свечение» панели). amount — сила, 0…0.1 (предел движка);
  // radius — как далеко оно расходится, пиксели.
  glow: { amount: 0.055, radius: 10 },

  // Фильтр поверх всего кадра (раздел «Фильтр» панели), накладывается последним:
  //   glow     — мягкое свечение от всего светлого в кадре, 0…1.5; в отличие от свечения движка, светится
  //              вся фольга, а не только самые яркие блики
  //   glowSize — насколько далеко оно расходится (1 — около 12 и 24 пикселей окна в двух слоях)
  //   vignette — затемнение к краям кадра, 0…1
  //   noise    — зерно по всему кадру, 0…0.25; 0.04 едва заметно
  filter: { glow: 0.35, glowSize: 1, vignette: 0.35, noise: 0.04 },

  // Текстура фольги. Это значения по умолчанию; на странице ими управляет панель «Текстура» (panel.js), её
  // настройки хранятся в браузере и перекрывают эти. Кнопка «Копировать» в панели даёт такой же объект —
  // его можно вставить сюда, чтобы сделать новым значением по умолчанию.
  //   id       — какая текстура из библиотеки ниже (null — без текстуры)
  //   amount   — общая сила, 0…2
  //   scale    — сколько раз текстура повторяется по ширине карточки
  //   coverage — какая доля фольги задета: 0 — только самые светлые места текстуры, 1 — почти вся фольга
  //   invert   — поменять светлое и тёмное местами
  // На что влияет (каждое 0…1, работает там, где текстура светлая):
  //   matte  — матовость: цвет бледнеет, блеск гаснет; поверхность остаётся гладкой
  //   dark   — затемнение
  //   hue    — сдвиг цвета: фольга под текстурой уходит в соседний цвет палитры
  //   relief — рельеф: текстура вдавливается в саму фольгу движка (bump.map). Осторожно: при заметной силе
  //            фольга выглядит мятой, а текстуры с царапинами дают прямые полоски.
  // Подобрано в панели 19.11: «Подтёки», мелкий рисунок, матовость вполсилы, лёгкий сдвиг цвета.
  texture: { id: 'drips', amount: 1, scale: 2.11, coverage: 0.6, invert: false, matte: 0.48, dark: 0, hue: 0.13, relief: 0.02 },

  // Библиотека текстур для панели: карта шероховатости и карты рельефа набора holospot.
  textures: [
    ...[['drips', 'Подтёки']]
      .map(([id, name]) => ({ id, name, url: new URL(`./textures/${id}.jpg`, import.meta.url).href, thumb: new URL(`./textures/thumbs/${id}.jpg`, import.meta.url).href })),
    ...[['scratches', 'Царапины', 'jpg'], ['brushed', 'Шлифовка', 'png'], ['sandblast', 'Пескоструй', 'png'], ['fingerprint', 'Отпечатки', 'png'], ['linen', 'Лён', 'png'], ['hammered', 'Чеканка', 'png'], ['crinkle', 'Мятая фольга', 'png']]
      .map(([id, name, ext]) => ({ id, name, url: new URL(`./vendor/holospot/assets/bumps/${id}.${ext}`, import.meta.url).href, thumb: new URL(`./textures/thumbs/${id}.jpg`, import.meta.url).href })),
  ],
  // world — свет стоит в сцене: при облёте камеры фольга остаётся цветной. camera — свет едет с камерой:
  // на облёте фольга быстро уходит из радуги в тёмный хром (проверено по сетке ракурсов).
  lights: new URLSearchParams(location.search).get('lights') ?? 'world',
  card: [63, 88],               // лицевая сторона, мм
  // Объектив камеры (кадр 36 × 24 мм). Длинный: камера далеко, на логотип она смотрит почти под одним углом,
  // поэтому он окрашен одним-двумя цветами, а не всей радугой сразу (при 62 мм по нему шёл весь спектр).
  lensMm: 160,
  fill: 0.86,                   // при zoom 1 карточка занимает эту долю окна

  // Камера неподвижна и смотрит на карточку строго фронтально: az и el — 0 (градусы вокруг карточки).
  // zoom — наезд (ограничен: композиция не шире 82 % свободной части окна). При камере сверху (el 10) и
  // наклонённой карточке цвета были насыщеннее, но карточка выглядела заваленной — убрано 19.11.
  camera: { az: 0, el: 0, zoom: 1.6 },

  // Карточка сама плавно поворачивается влево-вправо вокруг вертикальной оси. centre и amplitude — градусы,
  // period — секунд на полный ход туда и обратно. pitch — постоянный наклон вперёд; 0 — карточка стоит прямо.
  spin: { centre: 2, amplitude: 16, period: 12 },
  pitch: 0,
  // Перетаскивание: зажать и тащить — карточка поворачивается за рукой. turn — на сколько градусов её поворачивает
  // протяжка через всё окно (по ширине, по высоте); limit — пределы поворота. Пружина передемпфирована
  // (damping больше 2·√stiffness): карточка идёт за рукой вязко, с отставанием и без перелёта.
  // resume — через сколько секунд после отпускания она возвращается к своему вращению.
  drag: { turn: [80, 55], limit: [50, 32], stiffness: 18, damping: 11, resume: 1.5 },

  // Настройки holospot. Бумага и фольга: docs/materials/emboss.md, свет и картинка: docs/scene-settings.md.
  settings: {
    // Логотип. Фольга и рельеф — как у бумажной карточки holo.spot (пресет image-emboss): матовая фольга
    // (gloss 0), низкий рельеф с фаской, рваный край. Своё здесь: прямые штрихи (rainbow) вместо колец —
    // цвет идёт по логотипу широкими полосами, а не пятнами.
    'emboss.x': 31.5, 'emboss.y': 44,
    'emboss.foil': 'rainbow', 'emboss.pitch': 1000, 'emboss.grooveAngle': 120,
    'emboss.height': 60, 'emboss.shoulder': 0.12, 'emboss.profile': 'bevel', 'emboss.puff': 0.3,
    'emboss.gloss': 0, 'emboss.showThrough': 0, 'emboss.foilBump': 0.29,
    'emboss.edgeBreakup': 0.1, 'emboss.foilCoverage': 1,   // край почти чистый: рваный читается как плохое сглаживание
    // бумага: тёмно-серый хлопок — в кадре она видна, а не сливается с фоном
    'emboss.stock': 'cotton', 'emboss.paperColour': '#1c1c1e', 'emboss.thickness': 0.8,
    // рельефа у фольги нет: поверхность гладкая, текстура накладывается как шероховатость (CONFIG.texture)
    'bump.map': 'none', 'bump.strength': 0,
    'card.wear': 0.3,
    // Свет. Окружение — авторское (боковые полосы, отражатель над камерой): вне радуги фольга белая и
    // серебряная, а не тёмная. Три точечных источника стоят «лесенкой» поперёк штрихов фольги: каждый даёт
    // цвет в своей полосе наклонов. Они вдвое ярче авторских, чтобы цвет перебивал серебро.
    // Панель выключена: при фронтальной камере она отражается прямо в объектив и выбеливает фольгу.
    'studio.panel.on': false, 'studio.panel.dir': { x: -0.3, y: -0.7 }, 'studio.panel.width': 22, 'studio.panel.length': 8,
    'studio.panel.radiance': 6, 'studio.panel.distance': 0.45,
    // distance 2.5 м: далёкий свет красит логотип ровнее, цвет меняется по нему плавно, а не полосами.
    // Все три стоят на 30° выше карточки (y 0.5). Камера смотрит фронтально, карточка поворачивается
    // влево-вправо, значит зеркальные отражения света ходят по горизонтали на уровне камеры; свет, стоящий
    // выше, зеркалит мимо объектива и не выбеливает фольгу. Цвет от этого не меняется: его задаёт положение
    // света поперёк штрихов фольги (0.35, 0.6, 0.9 вдоль направления (0.87, 0.5)), оно сохранено.
    // По замеру насыщенность фольги выросла примерно вдвое против света на уровне камеры.
    'studio.spotA.on': true, 'studio.spotA.dir': { x: 0.407, y: 0.5 }, 'studio.spotA.size': 1.5, 'studio.spotA.radiance': 3600, 'studio.spotA.distance': 2.5,
    'studio.spotB.on': true, 'studio.spotB.dir': { x: 0.118, y: 0.5 }, 'studio.spotB.size': 1.5, 'studio.spotB.radiance': 3600, 'studio.spotB.distance': 2.5,
    'studio.spotC.on': true, 'studio.spotC.dir': { x: 0.754, y: 0.5 }, 'studio.spotC.size': 1.5, 'studio.spotC.radiance': 3600, 'studio.spotC.distance': 2.5,
    'studio.ambient.rims': 0.9, 'studio.ambient.fill': 0.45, 'studio.ambient.scrim': 0.35,
    'studio.ambient.cameraSide': 0.019, 'studio.ambient.cameraTexture': 0.5,
    'studio.ambient.backdrop': 0.27, 'studio.ambient.rotation': -28,
    // картинка: экспозиция, слабое свечение вокруг бликов, плёночное зерно; глубина резкости выключена.
    // wideGamut выключен, чтобы цвета палитры выводились ровно как заданы (sRGB).
    'display.ev': 0.2, 'display.wideGamut': false,   // свечение (display.glare) задаётся в CONFIG.glow
    'grain.amount': 0.07,
    'dof.on': false,
  },
};

const msg = document.getElementById('msg');
function fail(text) { msg.style.display = 'grid'; msg.textContent = text; }

const rad = THREE.MathUtils.degToRad;

// Собирает композицию CONFIG.art в одну картинку (PNG с прозрачностью): где непрозрачно, там фольга.
async function buildArtwork(W = 3000) {
  const A = CONFIG.art;
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.round(w), height: Math.round(h) });

  // logo.svg с явным размером, иначе браузер не знает, во сколько пикселей его рисовать
  const svgText = await (await fetch(CONFIG.logo)).text();
  const vb = svgText.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
  const RW = 3400, RH = Math.round(RW * vb[3] / vb[2]);
  const sized = svgText.replace('<svg ', `<svg width="${RW}" height="${RH}" `);
  const logo = new Image();
  logo.src = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  await logo.decode();
  URL.revokeObjectURL(logo.src);

  // где глобус и где надпись: по уменьшенной копии ищем пустую полосу между ними и границы каждой части
  const k = 8, sw = Math.round(RW / k), sh = Math.round(RH / k);
  const small = canvas(sw, sh).getContext('2d', { willReadFrequently: true });
  small.drawImage(logo, 0, 0, sw, sh);
  const px = small.getImageData(0, 0, sw, sh).data;
  const rowFilled = (y) => { for (let x = 0; x < sw; x++) if (px[(y * sw + x) * 4 + 3] > 16) return true; return false; };
  const rows = Array.from({ length: sh }, (_, y) => rowFilled(y));
  const top = rows.indexOf(true);
  const gapStart = rows.indexOf(false, top);
  const gapEnd = rows.indexOf(true, gapStart);
  if (gapStart < 0 || gapEnd < 0) throw new Error('в logo.svg не нашлась пустая полоса между глобусом и надписью');
  const bounds = (y0, y1) => {
    let x0 = sw, x1 = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < sw; x++) if (px[(y * sw + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    // в пикселях большой картинки, с запасом в один маленький пиксель
    return { x: Math.max(0, (x0 - 1) * k), y: Math.max(0, (y0 - 1) * k), w: Math.min(RW, (x1 - x0 + 3) * k), h: Math.min(RH, (y1 - y0 + 2) * k) };
  };
  const globe = bounds(top, gapStart), word = bounds(gapEnd, rows.lastIndexOf(true) + 1);

  // раскладка сверху вниз
  const globeW = W * A.globe, globeH = globeW * globe.h / globe.w;
  const wordH = W * word.h / word.w;
  const fs = W * A.textSize, lineH = fs * 1.22;
  const textH = fs * 0.74 + lineH * (A.lines.length - 1);      // 0.74 — высота прописных
  const pillH = W * A.pillHeight;
  const yWord = globeH + W * A.gaps[0];
  const yText = yWord + wordH + W * A.gaps[1];
  const yPill = yText + textH + W * A.gaps[2];
  const cv = canvas(W, yPill + pillH);
  const g = cv.getContext('2d');
  g.fillStyle = '#000';

  g.drawImage(logo, globe.x, globe.y, globe.w, globe.h, (W - globeW) / 2, 0, globeW, globeH);
  g.drawImage(logo, word.x, word.y, word.w, word.h, 0, yWord, W, wordH);

  const text = (str, x, baseline, size, weight, align) => {
    g.font = `${weight} ${size}px ${A.font}`;
    g.letterSpacing = `${size * A.tracking}px`;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    // разрядка добавляется и после последней буквы — убираем её, чтобы край текста стоял точно
    const tx = align === 'right' ? x + size * A.tracking : align === 'center' ? x + size * A.tracking / 2 : x;
    g.fillText(str, tx, baseline);
    // штрих чуть толще: тонкие буквы тонут в фаске тиснения
    g.lineWidth = size * A.bold; g.lineJoin = 'round'; g.strokeStyle = '#000';
    g.strokeText(str, tx, baseline);
  };
  A.lines.forEach((str, i) => text(str, 0, yText + fs * 0.74 + lineH * i, fs, 700, 'left'));
  text(A.code, W, yText + fs * 0.74 + lineH * (A.lines.length - 1), fs, 700, 'right');

  // Три овала, слитые перемычками. Соседние овалы перекрываются ровно настолько, чтобы перемычка была толщиной
  // pillNeck от высоты; размытие с порогом скругляет острый стык, как у капель.
  const n = A.pills.length, ry = pillH / 2;
  const q = Math.sqrt(1 - A.pillNeck ** 2);              // половина шага между центрами в долях радиуса
  const step = W / (n - 1 + 1 / q), rx = step / (2 * q);  // шаг между центрами и радиус: крайние овалы касаются краёв
  const cx = (i) => rx + step * i;
  const soft = W * 0.006, pad = Math.ceil(soft * 3);
  const blob = canvas(W + pad * 2, pillH + pad * 2);
  const b = blob.getContext('2d', { willReadFrequently: true });
  b.filter = `blur(${soft}px)`;
  for (let i = 0; i < n; i++) { b.beginPath(); b.ellipse(pad + cx(i), pad + ry, rx, ry, 0, 0, Math.PI * 2); b.fill(); }
  const img = b.getImageData(0, 0, blob.width, blob.height);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.max(0, Math.min(255, (img.data[i] - 112) * 8));   // порог с мягким краем
  b.putImageData(img, 0, 0);
  g.drawImage(blob, -pad, yPill - pad);
  const ring = W * A.pillRing, ps = W * A.pillTextSize;
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(cx(i), yPill + ry, step / 2 - ring * 0.55, ry - ring, 0, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  A.pills.forEach((str, i) => text(str, cx(i), yPill + ry + ps * 0.37, ps, 700, 'center'));

  return cv.toDataURL('image/png');
}

const MAX_COLOURS = 12;   // сколько цветов помещается в палитру

// Проход после движка: готовый кадр копируется в текстуру, и оттенки радуги заменяются цветами палитры.
// Бумага не трогается; бледная фольга (блики, пересвет, серебро) становится белой, насыщенная — цветом палитры.
// Здесь же накладывается карта шероховатости: для каждого пикселя луч из камеры пересекается с плоскостью
// карточки, и по точке попадания берётся значение карты.
function makePalettePass(renderer, viewCamera, card) {
  const rgb = (hex) => new THREE.Vector3(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
  const n = MAX_COLOURS;
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);   // пока текстура не выбрана
  blank.needsUpdate = true;
  card.geometry.computeBoundingBox();
  const cardWidth = card.geometry.boundingBox.max.x - card.geometry.boundingBox.min.x;
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      tFrame: { value: null },
      uPal: { value: Array.from({ length: n }, () => new THREE.Vector3(1, 1, 1)) },
      uHue: { value: new Array(n).fill(0) }, uCount: { value: 1 },
      uAmount: { value: 0 }, uGain: { value: 1 }, uSoft: { value: 0.4 }, uLift: { value: 1 },
      uWhite: { value: new THREE.Vector2(0.18, 0.5) },
      tRough: { value: blank }, uRough: { value: 0 }, uRoughRange: { value: new THREE.Vector2(0.13, 0.53) }, uRoughScale: { value: 1 / cardWidth },
      uTexMatte: { value: 1 }, uTexDark: { value: 0 }, uTexHue: { value: 0 }, uTexInvert: { value: 0 },
      uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCardInv: { value: new THREE.Matrix4() },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tFrame; uniform vec3 uPal[${n}]; uniform float uHue[${n}]; uniform int uCount; uniform float uAmount, uGain, uSoft, uLift; uniform vec2 uWhite;
      uniform sampler2D tRough; uniform float uRough, uRoughScale, uTexMatte, uTexDark, uTexHue, uTexInvert; uniform vec2 uRoughRange; uniform mat4 uProjInv, uCamWorld, uCardInv;
      varying vec2 vUv;
      // точка карточки под этим пикселем, в долях её ширины
      vec2 cardUv() {
        vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 ro = (uCardInv * uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 rd = (uCardInv * uCamWorld * vec4(v.xyz / v.w, 1.0)).xyz - ro;
        return (ro + rd * (-ro.z / rd.z)).xy * uRoughScale + 0.5;
      }
      vec3 palette(float h) {
        vec3 col = uPal[0];
        for (int i = 0; i < ${n}; i++) {
          if (i >= uCount) break;
          int j = i == uCount - 1 ? 0 : i + 1;
          float a = uHue[i], b = uHue[j];
          if (b < a) b += 1.0;
          float hh = h < a ? h + 1.0 : h;
          if (uCount > 1 && hh >= a && hh < b) {
            float t = smoothstep(0.5 - uSoft, 0.5 + uSoft, (hh - a) / (b - a));
            col = mix(uPal[i], uPal[j], t);
          }
        }
        return col;
      }
      void main() {
        vec3 c = texture2D(tFrame, vUv).rgb;
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), ch = mx - mn;
        float h = 0.0;
        if (ch > 1e-5) {
          if (mx == c.r) h = (c.g - c.b) / ch; else if (mx == c.g) h = 2.0 + (c.b - c.r) / ch; else h = 4.0 + (c.r - c.g) / ch;
          h = fract(h / 6.0);
        }
        // есть ли у пикселя цвет вообще (бумага и чистое серебро не трогаются) и насколько он насыщен
        float w = uAmount * smoothstep(0.02, 0.1, ch);
        float k = smoothstep(uWhite.x, uWhite.y, ch / max(mx, 1e-4));
        // яркость фольги сохраняется: тёмные места — тёмный оттенок цвета, самые яркие светлеют к белому
        float b = mx * uGain;
        // текстура: tv — её значение под пикселем, a — сила на фольге (яркие пиксели; бумага тёмная)
        float tv = texture2D(tRough, cardUv()).r;
        tv = mix(tv, 1.0 - tv, uTexInvert);
        float a = uRough * smoothstep(uRoughRange.x, uRoughRange.y, tv) * smoothstep(0.28, 0.45, mx);
        vec3 p = palette(fract(h + a * uTexHue * 0.18));   // сдвиг цвета по палитре
        vec3 tint = mix(p * min(b, 1.0), vec3(1.0), clamp((b - 1.0) * uLift, 0.0, 1.0));
        vec3 foil = mix(vec3(mx), tint, k);   // от белого к цвету палитры
        vec3 col = mix(c, foil, w);
        // матовость: цвет бледнеет к серому, блеск гаснет; затемнение: фольга просто темнее
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(mix(lum, 0.5, 0.45)), clamp(a * uTexMatte * 0.75, 0.0, 1.0));
        col *= 1.0 - clamp(a * uTexDark * 0.6, 0.0, 0.9);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  // Дальше — фильтр кадра. Палитра рисуется не на экран, а в текстуру; из неё делается размытая копия светлых
  // мест в два слоя (четверть и восьмая размера кадра), и последний проход складывает всё вместе, затемняет края
  // и добавляет зерно.
  const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const pass = (uniforms, fragmentShader) => new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false, uniforms, vertexShader: VERT, fragmentShader });
  // светлые места кадра, уменьшенные вчетверо; бумага и фон (темнее 0.22) не светятся
  const bright = pass({ tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, `
    uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      vec3 c = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
                     + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
      gl_FragColor = vec4(c * smoothstep(0.22, 0.6, max(c.r, max(c.g, c.b))), 1.0);
    }`);
  // размытие по одной оси (по Гауссу, 9 отсчётов); uStep — шаг и направление
  const blur = pass({ tSrc: { value: null }, uStep: { value: new THREE.Vector2() } }, `
    uniform sampler2D tSrc; uniform vec2 uStep; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
      c += (texture2D(tSrc, vUv + uStep).rgb + texture2D(tSrc, vUv - uStep).rgb) * 0.1945946;
      c += (texture2D(tSrc, vUv + uStep * 2.0).rgb + texture2D(tSrc, vUv - uStep * 2.0).rgb) * 0.1216216;
      c += (texture2D(tSrc, vUv + uStep * 3.0).rgb + texture2D(tSrc, vUv - uStep * 3.0).rgb) * 0.054054;
      c += (texture2D(tSrc, vUv + uStep * 4.0).rgb + texture2D(tSrc, vUv - uStep * 4.0).rgb) * 0.016216;
      gl_FragColor = vec4(c, 1.0);
    }`);
  const final = pass({
    tMain: { value: null }, tGlowA: { value: null }, tGlowB: { value: null },
    uGlow: { value: 0 }, uVignette: { value: 0 }, uNoise: { value: 0 }, uTime: { value: 0 }, uGrain: { value: 2 },
    uCentre: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 },
  }, `
    uniform sampler2D tMain, tGlowA, tGlowB; uniform float uGlow, uVignette, uNoise, uTime, uGrain, uAspect; uniform vec2 uCentre; varying vec2 vUv;
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() {
      vec3 col = texture2D(tMain, vUv).rgb;
      col += (texture2D(tGlowA, vUv).rgb * 0.55 + texture2D(tGlowB, vUv).rgb * 0.45) * uGlow;
      // виньетка: круг вокруг центра карточки, к углам кадра темнее
      vec2 d = (vUv - uCentre) * vec2(uAspect, 1.0);
      col *= 1.0 - uVignette * smoothstep(0.3, 1.0, length(d) * 1.25);
      // зерно: новое в каждом кадре, размером с пиксель окна
      col += (hash(floor(gl_FragCoord.xy / uGrain) + uTime) - 0.5) * uNoise;
      gl_FragColor = vec4(col, 1.0);
    }`);

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new THREE.Vector2();
  const target = () => new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const rtMain = target(), rtA = target(), rtA2 = target(), rtB = target(), rtB2 = target();
  let frame = null, glowSize = 1, tick = 0;
  const draw = (mat, to) => { quad.material = mat; renderer.setRenderTarget(to); renderer.render(scene, camera); };
  return {
    material, cardWidth,
    // настройки цветов (из панели или CONFIG.colours)
    setColours(c) {
      const u = material.uniforms;
      const pal = [...c.palette].sort((a, b) => a.hue - b.hue).slice(0, n);
      pal.forEach((col, i) => { u.uPal.value[i].copy(rgb(col.hex)); u.uHue.value[i] = col.hue; });
      u.uCount.value = pal.length;
      u.uAmount.value = pal.length ? c.amount : 0;
      u.uWhite.value.set(c.white[0], c.white[1]);
      u.uGain.value = c.gain; u.uLift.value = c.lift; u.uSoft.value = c.soft;
    },
    // настройки фильтра кадра (из панели или CONFIG.filter)
    setFilter(f) {
      final.uniforms.uGlow.value = f.glow; final.uniforms.uVignette.value = f.vignette; final.uniforms.uNoise.value = f.noise;
      glowSize = f.glowSize;
    },
    // где в кадре центр карточки (доли ширины и высоты) — вокруг него строится виньетка
    setCentre(x, y, aspect) { final.uniforms.uCentre.value.set(x, y); final.uniforms.uAspect.value = aspect; },
    render() {
      renderer.getDrawingBufferSize(size);
      if (!frame || frame.image.width !== size.x || frame.image.height !== size.y) {
        frame?.dispose();
        frame = new THREE.FramebufferTexture(size.x, size.y);
        frame.minFilter = frame.magFilter = THREE.NearestFilter;
        material.uniforms.tFrame.value = frame;
        rtMain.setSize(size.x, size.y);
        const w4 = Math.max(1, size.x >> 2), h4 = Math.max(1, size.y >> 2), w8 = Math.max(1, size.x >> 3), h8 = Math.max(1, size.y >> 3);
        rtA.setSize(w4, h4); rtA2.setSize(w4, h4); rtB.setSize(w8, h8); rtB2.setSize(w8, h8);
      }
      viewCamera.updateMatrixWorld();
      card.updateMatrixWorld();
      material.uniforms.uProjInv.value.copy(viewCamera.projectionMatrixInverse);
      material.uniforms.uCamWorld.value.copy(viewCamera.matrixWorld);
      material.uniforms.uCardInv.value.copy(card.matrixWorld).invert();
      renderer.setRenderTarget(null);
      renderer.copyFramebufferToTexture(frame);
      draw(material, rtMain);                                   // палитра и текстура
      if (final.uniforms.uGlow.value > 0) {
        bright.uniforms.tSrc.value = rtMain.texture; bright.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
        draw(bright, rtA);
        const k = 1.4 * glowSize;                               // шаг размытия в пикселях уменьшенной копии
        const run = (src, mid, dst) => {
          blur.uniforms.tSrc.value = src.texture; blur.uniforms.uStep.value.set(k / mid.width, 0); draw(blur, mid);
          blur.uniforms.tSrc.value = mid.texture; blur.uniforms.uStep.value.set(0, k / dst.height); draw(blur, dst);
        };
        run(rtA, rtA2, rtA);                                    // ближнее свечение
        run(rtA, rtB2, rtB);                                    // дальнее, из уже размытого
      }
      final.uniforms.tMain.value = rtMain.texture; final.uniforms.tGlowA.value = rtA.texture; final.uniforms.tGlowB.value = rtB.texture;
      final.uniforms.uTime.value = (tick = (tick + 1) % 1024) * 7.13;
      final.uniforms.uGrain.value = renderer.getPixelRatio();
      draw(final, null);
    },
  };
}

// Применяет настройки текстуры (из панели или CONFIG.texture): значения шейдера, сама картинка, рельеф движка.
function makeTextureControl(renderer, palettePass, holo) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  let bumpKey = 'none';
  return (st) => {
    const u = palettePass.material.uniforms;
    const mid = 1 - st.coverage;
    u.uRough.value = st.url ? st.amount : 0;
    u.uRoughScale.value = st.scale / palettePass.cardWidth;
    u.uRoughRange.value.set(mid - 0.2, mid + 0.2);
    u.uTexMatte.value = st.matte; u.uTexDark.value = st.dark; u.uTexHue.value = st.hue; u.uTexInvert.value = st.invert ? 1 : 0;
    if (st.url) {
      let tex = cache.get(st.url);
      if (!tex) {
        tex = loader.load(st.url);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        cache.set(st.url, tex);
      }
      u.tRough.value = tex;
    }
    // рельеф идёт в движок; его настройки меняем, только когда они действительно изменились: карта грузится заново
    const strength = st.url ? Math.min(3, st.amount * st.relief * 1.2) : 0;
    const key = strength > 0 ? [st.url, st.scale.toFixed(2), strength.toFixed(2), st.invert].join('|') : 'none';
    if (key !== bumpKey) {
      bumpKey = key;
      holo.setScene(strength > 0
        ? { 'bump.map': st.url, 'bump.tiling': THREE.MathUtils.clamp(st.scale, 1, 12), 'bump.strength': strength, 'bump.invert': !st.invert }
        : { 'bump.map': 'none', 'bump.strength': 0 });
    }
  };
}

async function main() {
  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, CONFIG.supersample), 3));
  renderer.setSize(innerWidth, innerHeight);
  const canvas = renderer.domElement;
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 700ms ease-out';
  document.body.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();

  const holo = new Holo(renderer, { background: 'black', quality: CONFIG.quality, lights: CONFIG.lights });
  const [wMm, hMm] = CONFIG.card;
  const card = holo.card({
    material: 'emboss', look: 'plain', widthMm: wMm, heightMm: hMm,
    settings: { ...CONFIG.settings, 'emboss.logo': await buildArtwork(), 'emboss.width': CONFIG.art.width },
  });
  const palettePass = makePalettePass(renderer, camera, card);
  const applyTexture = makeTextureControl(renderer, palettePass, holo);
  const applyGlow = (g) => holo.setScene({ 'display.glare': g.amount, 'display.glareRadius': g.radius });
  const applyFilter = (f) => palettePass.setFilter(f);
  // панель настроек; ?ui=0 в адресе — страница без неё, с настройками из CONFIG
  if (new URLSearchParams(location.search).get('ui') === '0') {
    const t = CONFIG.textures.find((x) => x.id === CONFIG.texture.id);
    applyTexture({ ...CONFIG.texture, url: t?.url ?? null });
    palettePass.setColours(CONFIG.colours);
    applyGlow(CONFIG.glow);
    applyFilter(CONFIG.filter);
  } else {
    mountPanel({
      texture: { library: CONFIG.textures, defaults: CONFIG.texture, apply: applyTexture },
      colours: { defaults: CONFIG.colours, max: MAX_COLOURS, apply: (c) => palettePass.setColours(c) },
      glow: { defaults: CONFIG.glow, apply: applyGlow },
      filter: { defaults: CONFIG.filter, apply: applyFilter },
    });
  }
  const draw = () => { holo.render(scene, camera); palettePass.render(); };
  scene.add(card);
  holo.expose();
  const obj = holo.get(card);
  await obj.ready;
  canvas.style.opacity = '1';

  const size = new THREE.Box3().setFromObject(card).getSize(new THREE.Vector3());
  let baseDist = 1, maxZoom = 1;
  function fit() {
    renderer.setSize(innerWidth, innerHeight);
    // Панель занимает правый край окна: карточка вписывается и центрируется в оставшейся части.
    const panel = innerWidth >= 640 ? (document.querySelector('.tx')?.offsetWidth ?? 0) : 0;
    const side = panel ? panel + 24 : 0;
    const aspect = (innerWidth - side) / innerHeight;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(12 / CONFIG.lensMm));
    camera.aspect = innerWidth / innerHeight;
    if (side) camera.setViewOffset(innerWidth, innerHeight, side / 2, 0, innerWidth, innerHeight); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    palettePass.setCentre((innerWidth - side) / 2 / innerWidth, 0.5, innerWidth / innerHeight);
    const t = Math.tan(rad(camera.fov) / 2);
    baseDist = Math.max(size.y / (2 * t * CONFIG.fill), size.x / (2 * t * aspect * CONFIG.fill));
    // наезд не больше, чем нужно, чтобы логотип занял 82 % ширины окна
    const logoW = size.x * CONFIG.art.width / wMm;
    maxZoom = Math.max(1, 0.82 * (2 * t * aspect * baseDist) / logoW);
    camera.near = baseDist / 40; camera.far = baseDist * 20;
  }
  fit();
  addEventListener('resize', fit);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = THREE.MathUtils.clamp;
  const rot = { yaw: CONFIG.spin.centre, pitch: CONFIG.pitch, vy: 0, vp: 0 };   // текущий поворот карточки, градусы
  const hand = { yaw: 0, pitch: 0, x: 0, y: 0, down: false, upAt: -1e9 };      // куда карточку тянет рука
  let manual = 0, phase = 0, pose = null, view = null, lastT = performance.now();

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    hand.down = true; hand.x = e.clientX; hand.y = e.clientY;
    if (manual < 0.01) { hand.yaw = rot.yaw; hand.pitch = rot.pitch; }      // начинаем с того места, где карточка сейчас
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!hand.down) return;
    const { turn, limit } = CONFIG.drag;
    // тянем вправо — лицо карточки поворачивается вправо; тянем вниз — наклоняется вниз
    hand.yaw = clamp(hand.yaw + (e.clientX - hand.x) / innerWidth * turn[0], -limit[0], limit[0]);
    hand.pitch = clamp(hand.pitch + (e.clientY - hand.y) / innerHeight * turn[1], CONFIG.pitch - limit[1], CONFIG.pitch + limit[1]);
    hand.x = e.clientX; hand.y = e.clientY;
  });
  const drop = () => { if (!hand.down) return; hand.down = false; hand.upAt = performance.now(); canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);

  function placeCamera(c) {
    const dist = baseDist / Math.min(c.zoom, maxZoom);
    const az = rad(c.az), el = rad(c.el);
    camera.position.set(dist * Math.sin(az) * Math.cos(el), dist * Math.sin(el), dist * Math.cos(az) * Math.cos(el));
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  // Карточка поворачивается вокруг осей экрана, а не своих: влево-вправо — вокруг вертикали кадра, наклон — вокруг
  // горизонтали кадра. Так строка логотипа остаётся горизонтальной при любом повороте; вокруг собственной оси
  // карточки (камера смотрит сверху) логотип заваливался бы набок.
  const camUp = new THREE.Vector3(), camRight = new THREE.Vector3(), qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion();
  function frame() {
    placeCamera(view ?? CONFIG.camera);
    camera.updateMatrixWorld();
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    qYaw.setFromAxisAngle(camUp, rad(rot.yaw));
    qPitch.setFromAxisAngle(camRight, rad(rot.pitch));
    card.quaternion.copy(qYaw).multiply(qPitch);
    draw();
  }

  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - lastT) / 1000, 1 / 30);     // после скрытой вкладки время не прыгает
    lastT = now;
    if (pose) {
      rot.yaw = pose.yaw; rot.pitch = pose.pitch; rot.vy = rot.vp = 0;
    } else {
      // manual: 1 — карточку ведёт рука, 0 — она вращается сама. После отпускания держится resume секунд,
      // потом плавно уходит в 0; пока рука ведёт, собственное вращение стоит на месте и продолжается с той же точки.
      const held = hand.down || now - hand.upAt < CONFIG.drag.resume * 1000;
      manual += ((held ? 1 : 0) - manual) * Math.min(1, dt * (held ? 12 : 1.6));
      if (!reduced.matches) phase += dt * (1 - manual) * 2 * Math.PI / CONFIG.spin.period;
      const selfYaw = CONFIG.spin.centre + CONFIG.spin.amplitude * Math.sin(phase);
      const ty = selfYaw + (hand.yaw - selfYaw) * manual;
      const tp = CONFIG.pitch + (hand.pitch - CONFIG.pitch) * manual;
      const { stiffness, damping } = CONFIG.drag;
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        rot.vy += (stiffness * (ty - rot.yaw) - damping * rot.vy) * h;
        rot.vp += (stiffness * (tp - rot.pitch) - damping * rot.vp) * h;
        rot.yaw += rot.vy * h;
        rot.pitch += rot.vp * h;
      }
    }
    frame();
  });

  // для проверки и подбора в консоли:
  //   holo.pose(yaw, pitch) — заморозить поворот карточки, градусы; holo.release() — отпустить
  //   holo.view({ az, el, zoom }) — временно переставить камеру; holo.view() — вернуть CONFIG.camera
  //   holo.set({...}) — настройки фольги и бумаги; holo.setScene({...}) — свет и картинка
  //   holo.frame(yaw, pitch) — поставить поворот и нарисовать кадр сразу (вкладка в фоне сама кадры не рисует)
  window.holo = {
    config: CONFIG, kit: holo, obj, card, camera, scene, draw, rot, palette: palettePass.material.uniforms,
    pose: (yaw, pitch = CONFIG.pitch) => { pose = { yaw, pitch }; },
    frame: (yaw = rot.yaw, pitch = rot.pitch) => { rot.yaw = yaw; rot.pitch = pitch; frame(); },
    release: () => { pose = null; },
    view: (c) => { view = c ?? null; },
    artwork: (w) => buildArtwork(w),   // композиция как data-URL — посмотреть её отдельно от фольги
    set: (v) => obj.set(v),
    setScene: (v) => holo.setScene(v),
  };
}

main().catch((err) => { console.error(err); fail('Не удалось запустить эффект: ' + err.message); });
