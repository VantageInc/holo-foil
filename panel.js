// Панель настроек: разделы «Текстура», «Цвета», «Свечение», «Фильтр». Сама ничего не рисует: собирает настройки и отдаёт
// их в функции apply() из main.js. Настройки каждого раздела и загруженные текстуры хранятся в браузере
// (localStorage) и переживают перезагрузку. «Сбросить» возвращает значения из CONFIG, «Копировать» кладёт
// настройки раздела в буфер в том виде, в каком они записаны в CONFIG.

const KEYS = { texture: 'holo.texture.v1', custom: 'holo.texture.custom.v1', colours: 'holo.colours.v1', glow: 'holo.glow.v1', filter: 'holo.filter.v1', open: 'holo.panel.open.' };

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  // Настройки раздела хранятся вместе со значениями по умолчанию, при которых их подбирали. Если значения
  // по умолчанию в CONFIG с тех пор изменились, сохранённое не берётся: иначе новые значения из CONFIG
  // никогда не дошли бы до страницы.
  load(key, defaults) { const v = this.get(key, null); return v && v.base === JSON.stringify(defaults) && v.state ? v.state : {}; },
  save(key, defaults, state) { return this.set(key, { base: JSON.stringify(defaults), state }); },
};

const CSS = `
.tx { position: fixed; top: 12px; right: 12px; z-index: 10; width: min(272px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
  overflow-y: auto; color: #d9d9de; font: 12px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: rgba(20, 20, 23, .84); border: 1px solid rgba(255, 255, 255, .09); border-radius: 12px;
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); color-scheme: dark; user-select: none; }
.tx * { box-sizing: border-box; }
.tx-sec + .tx-sec { border-top: 1px solid rgba(255, 255, 255, .08); }
.tx-head { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 12px; border: 0; background: none;
  color: inherit; font: inherit; font-weight: 600; letter-spacing: .01em; cursor: pointer; }
.tx-head svg { transition: transform 180ms cubic-bezier(.2, 0, 0, 1); opacity: .6; }
.tx-sec[data-open="false"] .tx-head svg { transform: rotate(-90deg); }
.tx-body { padding: 2px 12px 12px; display: grid; gap: 12px; }
.tx-sec[data-open="false"] .tx-body { display: none; }
.tx-label { color: #86868e; font-size: 11px; margin-bottom: 6px; }
.tx-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.tx-tile { position: relative; aspect-ratio: 1; padding: 0; border: 1px solid rgba(255, 255, 255, .1); border-radius: 7px; background: #2a2a2e center / cover;
  color: #a9a9b0; font: inherit; font-size: 10px; cursor: pointer; overflow: hidden; }
.tx-tile:hover { border-color: rgba(255, 255, 255, .32); }
.tx-tile[aria-pressed="true"] { border-color: #fff; box-shadow: 0 0 0 1px #fff; }
.tx-tile.tx-add { display: grid; place-items: center; font-size: 18px; line-height: 1; color: #d9d9de; background-color: transparent; border-style: dashed; }
.tx-tile input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.tx-del { width: 15px; height: 15px; padding: 0; border: 0; border-radius: 50%; background: rgba(0, 0, 0, .7);
  color: #fff; font: 11px/15px system-ui, sans-serif; cursor: pointer; }
.tx-tile .tx-del { position: absolute; top: 1px; right: 1px; opacity: 0; }
.tx-tile:hover .tx-del, .tx-del:focus-visible { opacity: 1; }
.tx-name { margin-top: 6px; min-height: 16px; }
.tx-note { color: #c9a25a; margin-top: 4px; }
.tx-row { display: grid; grid-template-columns: 1fr auto; align-items: baseline; row-gap: 2px; }
.tx-row output { color: #86868e; font-variant-numeric: tabular-nums; }
.tx input[type="range"] { width: 100%; margin: 0; height: 18px; accent-color: #e9e9ee; cursor: pointer; }
.tx-row input[type="range"] { grid-column: 1 / -1; }
.tx-row small, .tx-hint { grid-column: 1 / -1; color: #86868e; font-size: 11px; }
.tx-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.tx-check input { margin: 0; accent-color: #e9e9ee; }
.tx-group { display: grid; gap: 8px; }
.tx-sep { height: 1px; background: rgba(255, 255, 255, .08); }
.tx-actions { display: flex; gap: 6px; }
.tx-btn { flex: 1; padding: 6px 8px; border: 1px solid rgba(255, 255, 255, .12); border-radius: 7px; background: rgba(255, 255, 255, .05);
  color: inherit; font: inherit; cursor: pointer; }
.tx-btn:hover:not(:disabled) { background: rgba(255, 255, 255, .1); }
.tx-btn:disabled { opacity: .4; cursor: default; }
.tx-strip { display: block; position: static; width: 100%; height: 8px; border-radius: 4px; }   /* static: у страницы все canvas закреплены на весь экран */
.tx-strip + .tx-strip { margin-top: 3px; }
.tx-rainbow { background: linear-gradient(to right, #f00, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00); opacity: .75; }
.tx-colour { display: grid; grid-template-columns: 26px 1fr 15px; align-items: center; gap: 8px; }
.tx-colour input[type="color"] { width: 26px; height: 22px; padding: 0; border: 1px solid rgba(255, 255, 255, .16); border-radius: 5px; background: none; cursor: pointer; }
.tx-colour input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.tx-colour input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 4px; }
.tx-colour .tx-del { background: rgba(255, 255, 255, .1); }
.tx-colour .tx-del:hover { background: rgba(255, 255, 255, .22); }
.tx :focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
`;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c);
  return node;
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const round = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);

// Сворачиваемый раздел панели.
function section(title, key, defaultOpen) {
  const sec = el('section', { className: 'tx-sec' });
  const head = el('button', { className: 'tx-head', type: 'button' });
  head.innerHTML = `<span>${title}</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const body = el('div', { className: 'tx-body' });
  const setOpen = (open) => { sec.dataset.open = String(open); head.setAttribute('aria-expanded', String(open)); store.set(KEYS.open + key, open); };
  head.addEventListener('click', () => setOpen(sec.dataset.open !== 'true'));
  setOpen(store.get(KEYS.open + key, defaultOpen));
  sec.append(head, body);
  return { sec, body };
}

// Ползунок с подписью и значением. get/set читают и пишут настройку, sync — список «обновить вид из настроек».
function slider(sync, id, label, min, max, step, { get, set, format = (v) => v.toFixed(2), hint, onChange }) {
  const input = el('input', { type: 'range', min, max, step, id: 'tx-' + id });
  const out = el('output');
  const show = () => { out.textContent = format(Number(input.value)); };
  sync.push(() => { input.value = get(); show(); });
  input.addEventListener('input', () => { set(Number(input.value)); show(); onChange(); });
  const row = el('div', { className: 'tx-row' }, el('label', { htmlFor: input.id, textContent: label }), out, input);
  if (hint) row.append(el('small', { textContent: hint }));
  return row;
}

// Кнопки «Сбросить» и «Копировать» для раздела.
function actions(onReset, getText) {
  const reset = el('button', { className: 'tx-btn', type: 'button', textContent: 'Сбросить' });
  reset.addEventListener('click', onReset);
  const copy = el('button', { className: 'tx-btn', type: 'button', textContent: 'Копировать', title: 'Скопировать настройки раздела, чтобы вставить в CONFIG' });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(getText()); copy.textContent = 'Скопировано'; } catch { copy.textContent = 'Не вышло'; }
    setTimeout(() => { copy.textContent = 'Копировать'; }, 1400);
  });
  return el('div', { className: 'tx-actions' }, reset, copy);
}

// Своя картинка → квадрат в оттенках серого, не больше 1536 px, как data-URL: и для показа, и для хранения.
async function fileToDataUrl(file) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(1536, side);
  const cv = el('canvas', { width: size, height: size });
  const g = cv.getContext('2d');
  g.filter = 'grayscale(1)';
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  return cv.toDataURL('image/jpeg', 0.85);
}

// ── Текстура ──
function textureSection({ library, defaults, apply }) {
  const { sec, body } = section('Текстура', 'texture', store.get('holo.panel.open', innerWidth >= 640));
  let custom = store.get(KEYS.custom, []).filter((t) => t && t.id && t.url);
  const state = { ...defaults, ...store.load(KEYS.texture, defaults) };
  const all = () => [...library, ...custom];
  const find = (id) => all().find((t) => t.id === id) ?? null;
  if (state.id && !find(state.id)) state.id = defaults.id;
  const sync = [];

  const grid = el('div', { className: 'tx-grid' });
  const name = el('div', { className: 'tx-name' });
  const note = el('div', { className: 'tx-note', hidden: true });
  body.append(el('div', {}, el('div', { className: 'tx-label', textContent: 'Библиотека' }), grid, name, note));

  function tile(t) {
    const b = el('button', { className: 'tx-tile', type: 'button', title: t ? t.name : 'Без текстуры' });
    b.setAttribute('aria-label', t ? t.name : 'Без текстуры');
    b.setAttribute('aria-pressed', String((t ? t.id : null) === state.id));
    if (t) b.style.backgroundImage = `url("${t.thumb ?? t.url}")`; else b.textContent = 'нет';
    b.addEventListener('click', () => { state.id = t ? t.id : null; commit(); });
    if (t && t.custom) {
      const del = el('button', { className: 'tx-del', type: 'button', textContent: '×', title: 'Убрать из библиотеки' });
      del.setAttribute('aria-label', 'Убрать текстуру ' + t.name);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        custom = custom.filter((x) => x.id !== t.id);
        store.set(KEYS.custom, custom);
        if (state.id === t.id) state.id = defaults.id;
        commit();
      });
      b.append(del);
    }
    return b;
  }

  function addTile() {
    const label = el('label', { className: 'tx-tile tx-add', title: 'Загрузить свою текстуру' }, '+');
    const input = el('input', { type: 'file', accept: 'image/*' });
    input.setAttribute('aria-label', 'Загрузить свою текстуру');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const url = await fileToDataUrl(file);
        const t = { id: 'custom-' + Date.now().toString(36), name: file.name.replace(/\.[^.]+$/, ''), url, custom: true };
        custom.push(t);
        const saved = store.set(KEYS.custom, custom);
        note.hidden = saved;
        note.textContent = saved ? '' : 'Текстура загружена, но не сохранится после перезагрузки: в хранилище браузера нет места.';
        state.id = t.id;
        commit();
      } catch {
        note.hidden = false;
        note.textContent = 'Не удалось прочитать файл как картинку.';
      }
    });
    label.append(input);
    return label;
  }

  const live = () => commit(false);
  const num = (key, label, min, max, step, opts = {}) => slider(sync, key, label, min, max, step, { get: () => state[key], set: (v) => { state[key] = v; }, onChange: live, ...opts });
  const invert = el('input', { type: 'checkbox' });
  invert.addEventListener('change', () => { state.invert = invert.checked; live(); });
  sync.push(() => { invert.checked = !!state.invert; });

  body.append(
    el('div', { className: 'tx-group' },
      num('amount', 'Сила', 0, 2, 0.01),
      // размер показываем как размер рисунка: 2 — рисунок вдвое крупнее, то есть вдвое меньше повторов
      num('scale', 'Размер', -2.5, 2, 0.01, { get: () => -Math.log2(state.scale), set: (v) => { state.scale = 1 / 2 ** v; }, format: (v) => '×' + (2 ** v).toFixed(2) }),
      num('coverage', 'Покрытие', 0, 1, 0.01, { format: (v) => Math.round(v * 100) + ' %' }),
      el('label', { className: 'tx-check' }, invert, 'Инвертировать'),
    ),
    el('div', { className: 'tx-sep' }),
    el('div', { className: 'tx-group' },
      el('div', { className: 'tx-label', textContent: 'На что влияет', style: 'margin:0' }),
      num('matte', 'Матовость', 0, 1, 0.01),
      num('dark', 'Затемнение', 0, 1, 0.01),
      num('hue', 'Сдвиг цвета', 0, 1, 0.01),
      num('relief', 'Рельеф', 0, 1, 0.01, { hint: 'Вдавливает текстуру в фольгу. Сильный — мнёт её.' }),
    ),
    actions(() => { Object.assign(state, defaults); commit(); }, () => JSON.stringify(round(Object.fromEntries(Object.keys(defaults).map((k) => [k, state[k]]))))),
  );

  // Отдать настройки в сцену и сохранить. full — перерисовать ещё и библиотеку с ползунками (после выбора или сброса).
  function commit(full = true) {
    apply({ ...state, url: state.id ? (find(state.id)?.url ?? null) : null });
    store.save(KEYS.texture, defaults, state);
    if (!full) return;
    grid.replaceChildren(tile(null), ...all().map(tile), addTile());
    name.textContent = state.id ? (find(state.id)?.name ?? '') : 'Без текстуры';
    sync.forEach((f) => f());
  }
  commit();
  return sec;
}

// ── Цвета ──
function coloursSection({ defaults, max, apply }) {
  const { sec, body } = section('Цвета', 'colours', innerWidth >= 640);
  const saved = store.load(KEYS.colours, defaults);
  const valid = Array.isArray(saved.palette) && saved.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex) && Number.isFinite(c.hue)) && Array.isArray(saved.white);
  const state = { ...clone(defaults), ...(valid ? saved : {}) };
  const sync = [];

  // две полоски: сверху радуга движка, под ней — в какие цвета она превращается
  const preview = el('canvas', { className: 'tx-strip', width: 256, height: 1 });
  const list = el('div', { className: 'tx-group' });
  const add = el('button', { className: 'tx-btn', type: 'button', textContent: '+ Добавить цвет' });
  body.append(
    el('div', {}, el('div', { className: 'tx-label', textContent: 'Радуга фольги → цвета палитры' }), el('div', { className: 'tx-strip tx-rainbow' }), preview),
    el('div', { className: 'tx-group' }, el('div', { className: 'tx-hint', textContent: 'Ползунок у цвета — его место в радуге.' }), list, add),
    el('div', { className: 'tx-sep' }),
  );

  // тот же расчёт, что в шейдере: цвет палитры для оттенка радуги h
  function drawPreview() {
    const pal = [...state.palette].sort((a, b) => a.hue - b.hue);
    const rgb = pal.map((c) => [1, 3, 5].map((i) => parseInt(c.hex.slice(i, i + 2), 16)));
    const g = preview.getContext('2d');
    const img = g.createImageData(preview.width, 1);
    for (let x = 0; x < preview.width; x++) {
      const h = x / preview.width;
      let col = rgb[0] ?? [255, 255, 255];
      for (let i = 0; i < pal.length && pal.length > 1; i++) {
        const j = i === pal.length - 1 ? 0 : i + 1;
        const a = pal[i].hue;
        const b = pal[j].hue < a ? pal[j].hue + 1 : pal[j].hue;
        const hh = h < a ? h + 1 : h;
        if (hh >= a && hh < b) {
          let t = ((hh - a) / (b - a) - (0.5 - state.soft)) / Math.max(2 * state.soft, 1e-4);
          t = Math.min(1, Math.max(0, t));
          t = t * t * (3 - 2 * t);
          col = rgb[i].map((v, k) => v + (rgb[j][k] - v) * t);
        }
      }
      img.data.set([col[0], col[1], col[2], 255], x * 4);
    }
    g.putImageData(img, 0, 0);
  }

  function renderList() {
    list.replaceChildren(...state.palette.map((c, i) => {
      const pick = el('input', { type: 'color', value: c.hex });
      pick.setAttribute('aria-label', `Цвет ${i + 1}`);
      pick.addEventListener('input', () => { c.hex = pick.value; commit(false); });
      const pos = el('input', { type: 'range', min: 0, max: 1, step: 0.005, value: c.hue });
      pos.setAttribute('aria-label', `Место цвета ${i + 1} в радуге`);
      pos.addEventListener('input', () => { c.hue = Number(pos.value); commit(false); });
      const del = el('button', { className: 'tx-del', type: 'button', textContent: '×', title: 'Убрать цвет' });
      del.setAttribute('aria-label', `Убрать цвет ${i + 1}`);
      del.disabled = state.palette.length <= 1;
      del.addEventListener('click', () => { state.palette.splice(i, 1); commit(); });
      return el('div', { className: 'tx-colour' }, pick, pos, del);
    }));
    add.disabled = state.palette.length >= max;
  }

  // новый цвет встаёт в середину самого большого пустого промежутка радуги
  add.addEventListener('click', () => {
    const hues = state.palette.map((c) => c.hue).sort((a, b) => a - b);
    let best = { gap: -1, hue: 0.5 };
    hues.forEach((h, i) => {
      const next = i === hues.length - 1 ? hues[0] + 1 : hues[i + 1];
      if (next - h > best.gap) best = { gap: next - h, hue: (h + (next - h) / 2) % 1 };
    });
    state.palette.push({ hex: '#ffffff', hue: Math.round(best.hue * 200) / 200 });
    commit();
  });

  const live = () => commit(false);
  const num = (key, label, min, max2, step, opts = {}) => slider(sync, 'c-' + key, label, min, max2, step, { get: () => state[key], set: (v) => { state[key] = v; }, onChange: live, ...opts });
  body.append(
    el('div', { className: 'tx-group' },
      num('amount', 'Перекраска', 0, 1, 0.01, { format: (v) => Math.round(v * 100) + ' %', hint: '0 — радуга как есть, 100 — только палитра.' }),
      // один ползунок двигает оба порога белого, расстояние между ними сохраняется
      num('white', 'Белый', 0, 0.6, 0.01, {
        get: () => state.white[0],
        set: (v) => { const w = state.white[1] - state.white[0]; state.white = [v, v + w]; },
        hint: 'Чем больше, тем больше фольги остаётся белой.',
      }),
      num('gain', 'Яркость', 0.6, 2, 0.01),
      num('lift', 'Блики к белому', 0, 3, 0.01),
      num('soft', 'Плавность переходов', 0, 0.5, 0.005),
    ),
    actions(() => { Object.assign(state, clone(defaults)); commit(); }, () => JSON.stringify(round(state))),
  );

  function commit(full = true) {
    apply(state);
    store.save(KEYS.colours, defaults, state);
    drawPreview();
    if (full) { renderList(); sync.forEach((f) => f()); }
  }
  commit();
  return sec;
}

// ── Свечение ──
function glowSection({ defaults, apply }) {
  const { sec, body } = section('Свечение', 'glow', innerWidth >= 640);
  const state = { ...defaults, ...store.load(KEYS.glow, defaults) };
  const sync = [];
  const commit = (full = true) => { apply(state); store.save(KEYS.glow, defaults, state); if (full) sync.forEach((f) => f()); };
  const num = (key, label, min, max, step, opts = {}) => slider(sync, 'g-' + key, label, min, max, step, { get: () => state[key], set: (v) => { state[key] = v; }, onChange: () => commit(false), ...opts });
  body.append(
    el('div', { className: 'tx-group' },
      num('amount', 'Сила', 0, 0.1, 0.001, { format: (v) => Math.round(v * 1000) + ' %', hint: 'Свечение вокруг самых ярких бликов. 100 % — предел движка.' }),
      num('radius', 'Радиус', 2, 32, 1, { format: (v) => v + ' px' }),
    ),
    actions(() => { Object.assign(state, defaults); commit(); }, () => JSON.stringify(round(state))),
  );
  commit();
  return sec;
}

// ── Фильтр кадра ──
function filterSection({ defaults, apply }) {
  const { sec, body } = section('Фильтр', 'filter', innerWidth >= 640);
  const state = { ...defaults, ...store.load(KEYS.filter, defaults) };
  const sync = [];
  const commit = (full = true) => { apply(state); store.save(KEYS.filter, defaults, state); if (full) sync.forEach((f) => f()); };
  const num = (key, label, min, max, step, opts = {}) => slider(sync, 'f-' + key, label, min, max, step, { get: () => state[key], set: (v) => { state[key] = v; }, onChange: () => commit(false), ...opts });
  body.append(
    el('div', { className: 'tx-group' },
      el('div', { className: 'tx-hint', textContent: 'Накладывается поверх всего кадра.' }),
      num('glow', 'Свечение', 0, 1.5, 0.01, { hint: 'Светится вся фольга, а не только блики.' }),
      num('glowSize', 'Размер свечения', 0.4, 2.5, 0.01, { format: (v) => '×' + v.toFixed(2) }),
      num('vignette', 'Виньетка', 0, 1, 0.01),
      num('noise', 'Шум', 0, 0.25, 0.005, { format: (v) => (v * 100).toFixed(1) + ' %' }),
    ),
    actions(() => { Object.assign(state, defaults); commit(); }, () => JSON.stringify(round(state))),
  );
  commit();
  return sec;
}

export function mountPanel({ texture, colours, glow, filter }) {
  document.head.append(el('style', { textContent: CSS }));
  const root = el('aside', { className: 'tx' });
  root.setAttribute('aria-label', 'Настройки фольги');
  root.append(textureSection(texture), coloursSection(colours), glowSection(glow), filterSection(filter));
  document.body.append(root);
}
