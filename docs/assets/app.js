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

let history = [];
let artists = [];
let songs = [];

function resolveUrl(path) {
  return new URL(path, window.location.href).href;
}

function stripFrontmatter(md) {
  if (md.startsWith('---')) {
    const end = md.indexOf('---', 3);
    if (end !== -1) return md.slice(end + 3).trim();
  }
  return md;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function loadData() {
  const [historyRes, artistsRes, songsRes] = await Promise.all([
    fetch(resolveUrl('data/history.json')),
    fetch(resolveUrl('data/artists.json')),
    fetch(resolveUrl('data/songs.json'))
  ]);
  history = (await historyRes.json()).entries || [];
  artists = await artistsRes.json();
  songs = await songsRes.json();
}

function renderStats() {
  const uniqueArtists = new Set(history.map(e => e.artist)).size;
  document.getElementById('stats').innerHTML = `
    <span>${history.length} 已学</span>
    <span>${uniqueArtists} 艺人</span>
    <span>${songs.length} 曲库</span>
  `;
}

function renderToday() {
  const today = getTodayStr();
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const todayEntry = history.find(e => e.date === today) || sorted[0];
  const container = document.getElementById('today-card');

  if (!todayEntry) {
    container.innerHTML = `<p class="empty-state">还没有学习记录</p>`;
    return;
  }

  const isToday = todayEntry.date === today;
  const songMeta = songs.find(s => s.slug === todayEntry.slug) || {};

  container.innerHTML = `
    <div class="today-card">
      <p class="today-artist">${todayEntry.artistName || ARTIST_NAMES[todayEntry.artist] || todayEntry.artist}</p>
      <h3 class="today-title">${todayEntry.title}</h3>
      <p class="today-date">${isToday ? '今日 · ' : ''}${formatDate(todayEntry.date)}</p>
      <p class="today-tags">
        ${songMeta.difficulty ? `<span>${songMeta.difficulty}</span>` : ''}
        ${songMeta.bpm ? `<span>${songMeta.bpm}</span>` : ''}
      </p>
      <button class="btn-primary" type="button" data-file="${todayEntry.file}">
        开始学习
      </button>
    </div>`;

  container.querySelector('.btn-primary').addEventListener('click', () => {
    openEntry(todayEntry.file);
  });
}

function populateArtistFilter() {
  const select = document.getElementById('artist-filter');
  artists.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.name;
    select.appendChild(opt);
  });
}

function renderHistory(filterArtist = '', searchQuery = '') {
  const grid = document.getElementById('history-grid');
  let filtered = [...history].sort((a, b) => b.date.localeCompare(a.date));

  if (filterArtist) filtered = filtered.filter(e => e.artist === filterArtist);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.artistName || ARTIST_NAMES[e.artist] || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state">暂无匹配记录</p>`;
    return;
  }

  grid.innerHTML = filtered.map(entry => `
    <button class="history-item" type="button" data-file="${entry.file}">
      <span class="history-date">${formatDate(entry.date)}</span>
      <span class="history-artist">${entry.artistName || ARTIST_NAMES[entry.artist] || entry.artist}</span>
      <span class="history-title">${entry.title}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.history-item').forEach(btn => {
    btn.addEventListener('click', () => openEntry(btn.dataset.file));
  });
}

function enhanceMarkdown(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('blockquote').forEach(bq => {
    const text = bq.innerHTML;
    if (text.includes('**答案**')) {
      bq.classList.add('quiz');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-toggle';
      btn.textContent = '显示答案';
      btn.addEventListener('click', () => {
        bq.classList.toggle('revealed');
        btn.textContent = bq.classList.contains('revealed') ? '隐藏答案' : '显示答案';
      });
      bq.prepend(btn);
    }
  });

  wrapper.querySelectorAll('p').forEach(p => {
    if (p.innerHTML.startsWith('<strong>▸ 原句</strong>')) {
      const card = document.createElement('div');
      card.className = 'lyric-card';
      card.innerHTML = p.innerHTML;
      p.replaceWith(card);
    }
  });

  return wrapper.innerHTML;
}

function showHome() {
  document.getElementById('home-view').classList.remove('hidden');
  document.getElementById('lesson-view').classList.add('hidden');
  document.getElementById('lesson-view').setAttribute('aria-hidden', 'true');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLesson() {
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('lesson-view').classList.remove('hidden');
  document.getElementById('lesson-view').setAttribute('aria-hidden', 'false');
  window.scrollTo({ top: 0 });
}

async function openEntry(filePath) {
  const entry = history.find(e => e.file === filePath);
  const meta = document.getElementById('lesson-meta');
  const body = document.getElementById('lesson-body');

  if (entry) {
    meta.innerHTML = `
      <h2>${entry.title}</h2>
      <p>${entry.artistName || ARTIST_NAMES[entry.artist]} · ${formatDate(entry.date)}</p>`;
  } else {
    meta.innerHTML = '';
  }

  body.innerHTML = '<p class="loading">加载内容…</p>';
  showLesson();

  try {
    const res = await fetch(resolveUrl(filePath));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = stripFrontmatter(await res.text());
    if (typeof marked === 'undefined') throw new Error('marked not loaded');
    body.innerHTML = enhanceMarkdown(marked.parse(md));
  } catch (err) {
    body.innerHTML = `<p class="error-state">内容加载失败（${err.message}），请刷新后重试。</p>`;
  }
}

document.getElementById('back-btn').addEventListener('click', showHome);
document.getElementById('artist-filter').addEventListener('change', e => {
  renderHistory(e.target.value, document.getElementById('search-input').value);
});
document.getElementById('search-input').addEventListener('input', e => {
  renderHistory(document.getElementById('artist-filter').value, e.target.value);
});

async function init() {
  await loadData();
  renderStats();
  renderToday();
  populateArtistFilter();
  renderHistory();

  const today = getTodayStr();
  const todayEntry = history.find(e => e.date === today);
  if (todayEntry && window.location.hash === '#today') {
    openEntry(todayEntry.file);
  }
}

init();
