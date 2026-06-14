/* Daily Lyric Learning — App */

const ARTIST_NAMES = {
  'dvsn': 'dvsn',
  '6lack': '6LACK',
  'bryson-tiller': 'Bryson Tiller',
  'frank-ocean': 'Frank Ocean',
  'daniel-caesar': 'Daniel Caesar',
  'her': 'H.E.R.',
  'gallant': 'Gallant',
  'emotional-oranges': 'Emotional Oranges',
  'jhene-aiko': 'Jhené Aiko',
  'sampha': 'Sampha'
};

const ARTIST_COLORS = {
  'dvsn': '#8B5CF6',
  '6lack': '#94A3B8',
  'bryson-tiller': '#F97316',
  'frank-ocean': '#EC4899',
  'daniel-caesar': '#14B8A6',
  'her': '#A855F7',
  'gallant': '#C084FC',
  'emotional-oranges': '#FB923C',
  'jhene-aiko': '#E879F9',
  'sampha': '#6366F1'
};

const DIFFICULTY_LABELS = { easy: '简单', medium: '中等', hard: '困难' };

let history = [];
let artists = [];
let songs = [];
let activeFilter = '';
let activeDateFilter = '';
let calendarView = { year: new Date().getFullYear(), month: new Date().getMonth() };
let currentEntry = null;

// ── Data loading ──────────────────────────────────────────

async function loadData() {
  const [historyRes, artistsRes, songsRes] = await Promise.all([
    fetch('data/history.json'),
    fetch('data/artists.json'),
    fetch('data/songs.json')
  ]);
  history = (await historyRes.json()).entries || [];
  artists = await artistsRes.json();
  songs = await songsRes.json();
}

// ── Utilities ─────────────────────────────────────────────

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function artistName(id) {
  return ARTIST_NAMES[id] || id;
}

function artistColor(id) {
  return ARTIST_COLORS[id] || '#c084fc';
}

function getSongMeta(slug) {
  return songs.find(s => s.slug === slug) || {};
}

function getEntryByDate(dateStr) {
  return history.find(e => e.date === dateStr);
}

function getEntryDatesMap() {
  return new Map(history.map(e => [e.date, e]));
}

function applyFilters() {
  renderToday();
  renderHistory(document.getElementById('search-input').value);
  renderCalendar();
  updateFilterButtons();
}

function updateFilterButtons() {
  document.getElementById('clear-date-filter').hidden = !activeDateFilter;
  document.getElementById('clear-filter').hidden = !activeFilter && !activeDateFilter;
}

function clearAllFilters() {
  activeFilter = '';
  activeDateFilter = '';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.getElementById('search-input').value = '';
  const url = new URL(location.href);
  url.searchParams.delete('date');
  window.history.replaceState(null, '', url.pathname + url.hash);
  applyFilters();
}

function difficultyTag(diff) {
  if (!diff) return '';
  const label = DIFFICULTY_LABELS[diff] || diff;
  return `<span class="tag tag--${diff}">${label}</span>`;
}

function stripFrontMatter(md) {
  return md.replace(/^---[\s\S]*?---\s*/, '');
}

// ── Markdown processing ───────────────────────────────────

function enhanceMarkdown(md) {
  let html = marked.parse(stripFrontMatter(md));

  // Wrap tables for horizontal scroll
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>');
  html = html.replace(/<\/table>/g, '</table></div>');

  // Style verse headings (### Verse 1, ### Pre-Chorus, etc.)
  html = html.replace(
    /<h3>(Verse \d|Pre-Chorus|Chorus|Bridge|Intro|Outro)<\/h3>/gi,
    '<span class="verse-heading">$1</span>'
  );

  // Group consecutive lyric annotation lines into blocks
  html = enhanceLyricBlocks(html);

  // Style quiz section
  html = enhanceQuizSection(html);

  return html;
}

function enhanceLyricBlocks(html) {
  const labelMap = {
    '原句': ['原句', 'lyric-text--quote'],
    '中文释义': ['释义', 'lyric-text--cn'],
    '核心词汇': ['词汇', 'lyric-label--section'],
    '语法点睛': ['语法', 'lyric-label--section'],
    '场景迁移': ['场景', 'lyric-label--section'],
    '文化/背景扩展': ['文化', 'lyric-label--section']
  };

  html = html.replace(
    /<p><strong>▸ (原句|中文释义|核心词汇|语法点睛|场景迁移|文化\/背景扩展)<\/strong>\s*(.*?)<\/p>/gi,
    (match, label, content) => {
      const [shortLabel, cls] = labelMap[label] || [label, ''];
      if (cls === 'lyric-label--section') {
        return `<div class="lyric-section-head"><span class="lyric-label">${shortLabel}</span></div>`;
      }
      const textCls = cls ? `lyric-text ${cls}` : 'lyric-text';
      return `<div class="lyric-line"><span class="lyric-label">${shortLabel}</span><span class="${textCls}">${content}</span></div>`;
    }
  );

  // Wrap consecutive lyric elements into blocks
  html = html.replace(
    /((?:<div class="lyric-(?:line|section-head)">[\s\S]*?<\/div>\s*)+)/gi,
    block => `<div class="lyric-block">${block}</div>`
  );

  // Unwrap nested lyric-blocks
  html = html.replace(/<div class="lyric-block">\s*<div class="lyric-block">/g, '<div class="lyric-block">');
  html = html.replace(/<\/div>\s*<\/div>\s*(?=<hr|<h[23]|<div class="lyric-block">)/g, '</div>');

  return html;
}

function enhanceQuizSection(html) {
  // Blockquote quiz format: > **1. 中文**：... > **答案**：...
  html = html.replace(
    /<blockquote>\s*<p><strong>([\d.]*\s*中文)[：:]<\/strong>\s*(.*?)<\/p>\s*<p><strong>答案[：:]<\/strong>\s*(.*?)<\/p>\s*<\/blockquote>/gi,
    (_, label, question, answer) => `
      <div class="quiz-item">
        <strong>${label}：${question}</strong>
        <div class="quiz-answer" hidden><strong>答案：</strong>${answer}</div>
      </div>`
  );

  if (html.includes('quiz-item')) {
    html = html.replace(
      /(<h2[^>]*id="[^"]*"[^>]*>六、今日学习检测<\/h2>|<h2>六、今日学习检测<\/h2>)/,
      '$1<button class="show-answers-btn" onclick="toggleQuizAnswers(this)">显示答案</button>'
    );
  }

  return html;
}

function toggleQuizAnswers(btn) {
  const section = btn.closest('.markdown-body') || btn.parentElement;
  const answers = section.querySelectorAll('.quiz-answer');
  const hidden = answers[0]?.hasAttribute('hidden');
  answers.forEach(a => hidden ? a.removeAttribute('hidden') : a.setAttribute('hidden', ''));
  btn.textContent = hidden ? '隐藏答案' : '显示答案';
}

window.toggleQuizAnswers = toggleQuizAnswers;

// ── Render: Progress ──────────────────────────────────────

function renderProgress() {
  const learned = history.length;
  const total = songs.length;
  const pct = total ? (learned / total) * 100 : 0;
  const circumference = 97.4;
  const offset = circumference - (pct / 100) * circumference;

  document.getElementById('progress-text').textContent = `${learned}/${total}`;
  const ring = document.getElementById('progress-ring');
  if (ring) ring.style.strokeDashoffset = offset;
}

function renderStats() {
  const uniqueArtists = new Set(history.map(e => e.artist)).size;
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${history.length}</span>
      <span class="stat-label">已学习歌曲</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${uniqueArtists}</span>
      <span class="stat-label">覆盖艺人</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${songs.length - history.length}</span>
      <span class="stat-label">待学习</span>
    </div>`;
}

// ── Render: Today hero ────────────────────────────────────

function renderToday() {
  const today = getTodayStr();
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const selectedEntry = activeDateFilter ? getEntryByDate(activeDateFilter) : null;
  const todayEntry = selectedEntry
    || history.find(e => e.date === today)
    || sorted[0];
  const container = document.getElementById('today-card');
  const heroLabel = document.querySelector('.hero .section-label');

  if (heroLabel) {
    if (activeDateFilter && selectedEntry) {
      heroLabel.innerHTML = `<span class="pulse-dot"></span>${formatDate(activeDateFilter)} 的学习`;
    } else if (activeDateFilter) {
      heroLabel.innerHTML = `<span class="pulse-dot"></span>${formatDate(activeDateFilter)} · 暂无记录`;
    } else {
      heroLabel.innerHTML = `<span class="pulse-dot"></span>今日推荐`;
    }
  }

  if (!todayEntry) {
    container.innerHTML = `
      <div class="hero-card empty">
        <p>${activeDateFilter ? '该日期暂无学习记录' : '还没有学习记录'}</p>
        <p>${activeDateFilter ? '试试选择其他日期，或点击「返回最新」' : '自动化将在每天推送今日歌曲'}</p>
      </div>`;
    return;
  }

  const isToday = !activeDateFilter && todayEntry.date === today;
  const isSelected = activeDateFilter && todayEntry.date === activeDateFilter;
  const meta = getSongMeta(todayEntry.slug);
  const color = artistColor(todayEntry.artist);
  const dateLabel = isSelected
    ? formatDate(todayEntry.date)
    : (isToday ? `✦ 今日 · ${formatDate(todayEntry.date)}` : `最新 · ${formatDate(todayEntry.date)}`);

  container.innerHTML = `
    <div class="hero-card" style="--artist-color: ${color}">
      <div class="hero-inner">
        <div class="hero-artist">${todayEntry.artistName || artistName(todayEntry.artist)}</div>
        <div class="hero-title">${todayEntry.title}</div>
        <div class="hero-date">${dateLabel}</div>
        <div class="hero-tags">
          ${difficultyTag(meta.difficulty)}
          ${meta.bpm ? `<span class="tag">节奏 ${meta.bpm}</span>` : ''}
          <span class="tag">Alternative R&B</span>
        </div>
        <button class="btn-primary" onclick="openEntry('${todayEntry.slug}')" style="--artist-color: ${color}">
          开始学习
          <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`;
}

// ── Render: Artist chips ──────────────────────────────────

function renderArtistChips() {
  const container = document.getElementById('artist-chips');
  container.innerHTML = artists.map(a => {
    const count = history.filter(e => e.artist === a.id).length;
    const color = artistColor(a.id);
    return `
      <button class="chip" data-artist="${a.id}" style="--chip-color: ${color}"
              onclick="setArtistFilter('${a.id}')">
        ${a.name}${count ? ` · ${count}` : ''}
      </button>`;
  }).join('');
}

function setArtistFilter(id) {
  activeFilter = activeFilter === id ? '' : id;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.artist === activeFilter);
  });
  applyFilters();
}

window.setArtistFilter = setArtistFilter;

document.getElementById('clear-filter').addEventListener('click', clearAllFilters);

document.getElementById('clear-date-filter').addEventListener('click', () => {
  activeDateFilter = '';
  const url = new URL(location.href);
  url.searchParams.delete('date');
  window.history.replaceState(null, '', url.pathname + url.hash);
  applyFilters();
});

// ── Calendar ──────────────────────────────────────────────

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month-label');
  const { year, month } = calendarView;
  const entryMap = getEntryDatesMap();
  const today = getTodayStr();

  label.textContent = new Date(year, month, 1).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long'
  });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = (firstDay.getDay() + 6) % 7; // Monday = 0

  let html = '';

  for (let i = 0; i < startPad; i++) {
    html += '<span class="cal-day cal-day--empty"></span>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasEntry = entryMap.has(dateStr);
    const isSelected = activeDateFilter === dateStr;
    const isToday = dateStr === today;

    const classes = [
      'cal-day',
      hasEntry ? 'cal-day--has-entry' : '',
      isSelected ? 'cal-day--selected' : '',
      isToday ? 'cal-day--today' : ''
    ].filter(Boolean).join(' ');

    html += `
      <button class="${classes}" ${hasEntry ? `onclick="setDateFilter('${dateStr}')"` : 'disabled'}
              aria-label="${dateStr}${hasEntry ? ' 有学习记录' : ''}">
        ${day}
        ${hasEntry ? '<i class="cal-dot"></i>' : ''}
      </button>`;
  }

  grid.innerHTML = html;
}

function setDateFilter(dateStr) {
  activeDateFilter = activeDateFilter === dateStr ? '' : dateStr;

  if (activeDateFilter) {
    const [y, m] = activeDateFilter.split('-').map(Number);
    calendarView = { year: y, month: m - 1 };
    const url = new URL(location.href);
    url.searchParams.set('date', activeDateFilter);
    window.history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString() + url.hash);
  } else {
    const url = new URL(location.href);
    url.searchParams.delete('date');
    window.history.replaceState(null, '', url.pathname + url.hash);
  }

  applyFilters();

  if (activeDateFilter) {
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

window.setDateFilter = setDateFilter;

function shiftCalendarMonth(delta) {
  let { year, month } = calendarView;
  month += delta;
  if (month > 11) { month = 0; year++; }
  if (month < 0) { month = 11; year--; }
  calendarView = { year, month };
  renderCalendar();
}

document.getElementById('cal-prev').addEventListener('click', () => shiftCalendarMonth(-1));
document.getElementById('cal-next').addEventListener('click', () => shiftCalendarMonth(1));

// ── Render: History grid ──────────────────────────────────

function renderHistory(searchQuery = '') {
  const grid = document.getElementById('history-grid');
  let filtered = [...history].sort((a, b) => b.date.localeCompare(a.date));

  if (activeDateFilter) filtered = filtered.filter(e => e.date === activeDateFilter);
  if (activeFilter) filtered = filtered.filter(e => e.artist === activeFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.artistName || artistName(e.artist)).toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    const msg = activeDateFilter
      ? '该日期暂无匹配的学习记录'
      : (activeFilter || searchQuery ? '暂无匹配的学习记录' : '暂无学习记录');
    grid.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(entry => {
    const meta = getSongMeta(entry.slug);
    const color = artistColor(entry.artist);
    return `
      <div class="history-card" style="--artist-color: ${color}"
           onclick="openEntry('${entry.slug}')" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter')openEntry('${entry.slug}')">
        <div class="card-date">${formatDate(entry.date)}</div>
        <div class="card-artist">${entry.artistName || artistName(entry.artist)}</div>
        <div class="card-title">${entry.title}</div>
        <div class="card-tags">
          ${difficultyTag(meta.difficulty)}
          ${meta.bpm ? `<span class="tag">${meta.bpm}</span>` : ''}
        </div>
        <svg class="card-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>`;
  }).join('');
}

// ── Render: Catalog ───────────────────────────────────────

function renderCatalog() {
  const learnedSlugs = new Set(history.map(e => e.slug));
  const unlearned = songs.length - learnedSlugs.size;

  document.getElementById('catalog-meta').textContent =
    `共 ${songs.length} 首 · 已学 ${learnedSlugs.size} · 待学 ${unlearned}`;

  const preview = [...songs]
    .sort((a, b) => (learnedSlugs.has(a.slug) ? 1 : 0) - (learnedSlugs.has(b.slug) ? 1 : 0))
    .slice(0, 12);

  document.getElementById('catalog-grid').innerHTML = preview.map(s => {
    const learned = learnedSlugs.has(s.slug);
    const color = artistColor(s.artist);
    return `
      <div class="catalog-item ${learned ? 'learned' : ''}" style="--artist-color: ${color}">
        <div class="cat-artist">${artistName(s.artist)}</div>
        <div class="cat-title">${s.title}</div>
      </div>`;
  }).join('');
}

// ── Reader ────────────────────────────────────────────────

function buildTOC() {
  const body = document.getElementById('reader-body');
  const tocList = document.getElementById('toc-list');
  const headings = body.querySelectorAll('h2');

  tocList.innerHTML = '';
  headings.forEach((h, i) => {
    const id = `section-${i}`;
    h.id = id;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${id}`;
    a.textContent = h.textContent.replace(/^[一二三四五六七]、/, '');
    a.addEventListener('click', e => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (window.innerWidth <= 768) toggleTOC(false);
    });
    li.appendChild(a);
    tocList.appendChild(li);
  });

  // Scroll spy
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        const link = tocList.querySelector(`a[href="#${entry.target.id}"]`);
        if (link) link.classList.add('active');
      }
    });
  }, { root: body, rootMargin: '-20% 0 -70% 0' });

  headings.forEach(h => observer.observe(h));
}

function updateReadingProgress() {
  const body = document.getElementById('reader-body');
  const bar = document.getElementById('reader-progress');
  body.addEventListener('scroll', () => {
    const pct = body.scrollTop / (body.scrollHeight - body.clientHeight) * 100;
    bar.style.width = `${Math.min(100, pct)}%`;
  }, { passive: true });
}

async function openEntry(slugOrPath) {
  const entry = history.find(e => e.slug === slugOrPath || e.file === slugOrPath);
  if (!entry) return;

  currentEntry = entry;
  const color = artistColor(entry.artist);

  const reader = document.getElementById('reader');
  const overlay = document.getElementById('reader-overlay');
  const body = document.getElementById('reader-body');
  const meta = document.getElementById('reader-meta');

  reader.style.setProperty('--reader-accent', color);
  meta.innerHTML = `
    <h2>${entry.title}</h2>
    <p>${entry.artistName || artistName(entry.artist)} · ${formatDate(entry.date)}</p>`;

  body.innerHTML = '<div class="loading-state">加载内容…</div>';
  reader.classList.add('open');
  overlay.classList.add('open');
  reader.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Update URL hash
  window.history.replaceState(null, '', `#${entry.slug}`);

  try {
    const res = await fetch(entry.file);
    const md = await res.text();
    body.innerHTML = enhanceMarkdown(md);
    buildTOC();
    updateReadingProgress();
    body.scrollTop = 0;
    document.getElementById('reader-progress').style.width = '0%';
  } catch {
    body.innerHTML = '<div class="empty-state"><p>内容加载失败，请稍后重试</p></div>';
  }
}

window.openEntry = openEntry;

function closeReader() {
  document.getElementById('reader').classList.remove('open');
  document.getElementById('reader-overlay').classList.remove('open');
  document.getElementById('reader').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  toggleTOC(false);
  window.history.replaceState(null, '', location.pathname);
  currentEntry = null;
}

function toggleTOC(force) {
  const toc = document.getElementById('reader-toc');
  const open = force !== undefined ? force : !toc.classList.contains('open');
  toc.classList.toggle('open', open);
}

document.getElementById('close-reader').addEventListener('click', closeReader);
document.getElementById('reader-overlay').addEventListener('click', closeReader);
document.getElementById('toggle-toc').addEventListener('click', () => toggleTOC());

document.getElementById('search-input').addEventListener('input', e => {
  renderHistory(e.target.value);
  updateFilterButtons();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeReader();
});

// Deep link support
function handleHash() {
  const slug = location.hash.slice(1);
  if (slug && history.some(e => e.slug === slug)) {
    openEntry(slug);
  }
}

// ── Init ──────────────────────────────────────────────────

async function init() {
  await loadData();

  // Restore date filter from URL ?date=YYYY-MM-DD
  const urlDate = new URLSearchParams(location.search).get('date');
  if (urlDate && history.some(e => e.date === urlDate)) {
    activeDateFilter = urlDate;
    const [y, m] = urlDate.split('-').map(Number);
    calendarView = { year: y, month: m - 1 };
  }

  renderProgress();
  renderStats();
  renderToday();
  renderArtistChips();
  renderCalendar();
  renderHistory();
  renderCatalog();
  updateFilterButtons();
  handleHash();
}

init();
