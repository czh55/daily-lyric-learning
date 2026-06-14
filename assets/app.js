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

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function renderStats() {
  const uniqueArtists = new Set(history.map(e => e.artist)).size;
  document.getElementById('stats').innerHTML = `
    <div><span class="stat-value">${history.length}</span>已学习</div>
    <div><span class="stat-value">${uniqueArtists}</span>位艺人</div>
    <div><span class="stat-value">${songs.length}</span>首曲库</div>
  `;
}

function renderToday() {
  const today = getTodayStr();
  const todayEntry = history.find(e => e.date === today)
    || history.sort((a, b) => b.date.localeCompare(a.date))[0];

  const container = document.getElementById('today-card');

  if (!todayEntry) {
    container.innerHTML = `
      <div class="hero-card empty">
        <p>还没有学习记录</p>
        <p>自动化将在每天早上 8:00 推送今日歌曲</p>
      </div>`;
    return;
  }

  const isToday = todayEntry.date === today;
  const songMeta = songs.find(s => s.slug === todayEntry.slug) || {};

  container.innerHTML = `
    <div class="hero-card">
      <div class="hero-artist">${todayEntry.artistName || ARTIST_NAMES[todayEntry.artist] || todayEntry.artist}</div>
      <div class="hero-title">${todayEntry.title}</div>
      <div class="hero-date">${isToday ? '今日 · ' : ''}${formatDate(todayEntry.date)}</div>
      <div class="hero-tags">
        ${songMeta.difficulty ? `<span class="tag">难度: ${songMeta.difficulty}</span>` : ''}
        ${songMeta.bpm ? `<span class="tag">节奏: ${songMeta.bpm}</span>` : ''}
        <span class="tag">Alternative R&B</span>
      </div>
      <button class="btn-primary" onclick="openEntry('${todayEntry.file}')">
        开始学习 →
      </button>
    </div>`;
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

  if (filterArtist) {
    filtered = filtered.filter(e => e.artist === filterArtist);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.artistName || ARTIST_NAMES[e.artist] || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>暂无匹配记录</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(entry => {
    const songMeta = songs.find(s => s.slug === entry.slug) || {};
    return `
      <div class="history-card" onclick="openEntry('${entry.file}')">
        <div class="card-date">${formatDate(entry.date)}</div>
        <div class="card-artist">${entry.artistName || ARTIST_NAMES[entry.artist] || entry.artist}</div>
        <div class="card-title">${entry.title}</div>
        <div class="card-tags">
          ${songMeta.difficulty ? `<span class="tag">${songMeta.difficulty}</span>` : ''}
          ${songMeta.bpm ? `<span class="tag">${songMeta.bpm}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function openEntry(filePath) {
  const panel = document.getElementById('reader-panel');
  const overlay = document.getElementById('overlay');
  const body = document.getElementById('reader-body');
  const meta = document.getElementById('reader-meta');

  const entry = history.find(e => e.file === filePath);
  if (entry) {
    meta.innerHTML = `
      <h2>${entry.title}</h2>
      <p>${entry.artistName || ARTIST_NAMES[entry.artist]} · ${formatDate(entry.date)}</p>`;
  }

  body.innerHTML = '<div class="loading">加载内容…</div>';
  panel.classList.add('open');
  overlay.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');

  try {
    const res = await fetch(filePath);
    const md = await res.text();
    body.innerHTML = marked.parse(md);
  } catch {
    body.innerHTML = '<p class="empty-state">内容加载失败，请稍后重试。</p>';
  }
}

function closeReader() {
  document.getElementById('reader-panel').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('reader-panel').setAttribute('aria-hidden', 'true');
}

document.getElementById('close-reader').addEventListener('click', closeReader);
document.getElementById('overlay').addEventListener('click', closeReader);
document.getElementById('artist-filter').addEventListener('change', e => {
  renderHistory(e.target.value, document.getElementById('search-input').value);
});
document.getElementById('search-input').addEventListener('input', e => {
  renderHistory(document.getElementById('artist-filter').value, e.target.value);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeReader();
});

async function init() {
  await loadData();
  renderStats();
  renderToday();
  populateArtistFilter();
  renderHistory();
}

init();
