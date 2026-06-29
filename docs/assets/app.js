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
let cachedVoices = [];
let lineAudioPlayer = null;
let currentLineManifest = null;

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
      <div id="today-audio"></div>
      <button class="btn-primary" type="button" data-file="${todayEntry.file}">
        开始学习
      </button>
    </div>`;

  container.querySelector('.btn-primary').addEventListener('click', () => {
    openEntry(todayEntry.file);
  });

  audioExistsForDate(todayEntry.date).then(hasAudio => {
    if (hasAudio) {
      const slot = document.getElementById('today-audio');
      if (slot) slot.innerHTML = renderAudioPlayer(todayEntry.date);
    }
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

function audioUrlForDate(dateStr) {
  return resolveUrl(`audio/${dateStr}.mp3`);
}

async function audioExistsForDate(dateStr) {
  try {
    const res = await fetch(audioUrlForDate(dateStr), { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

function renderAudioPlayer(dateStr) {
  return `
    <div class="audio-section">
      <p class="audio-label">🎧 语音讲解</p>
      <p class="audio-hint">开车或通勤时可听，跟着讲解过一遍今日歌曲</p>
      <div class="audio-player-wrap">
        <audio id="audio-${dateStr}" controls class="audio-player" preload="metadata" src="${audioUrlForDate(dateStr)}">
          您的浏览器不支持音频播放
        </audio>
        <div class="playback-speed">
          <span class="speed-label">速度</span>
          <button type="button" class="speed-btn" onclick="setSpeed('${dateStr}', 0.75)">0.75x</button>
          <button type="button" class="speed-btn active" onclick="setSpeed('${dateStr}', 1)">1x</button>
          <button type="button" class="speed-btn" onclick="setSpeed('${dateStr}', 1.25)">1.25x</button>
          <button type="button" class="speed-btn" onclick="setSpeed('${dateStr}', 1.5)">1.5x</button>
        </div>
      </div>
    </div>`;
}

function setSpeed(dateStr, rate) {
  const audio = document.getElementById(`audio-${dateStr}`);
  if (!audio) return;
  audio.playbackRate = rate;
  const wrap = audio.closest('.audio-player-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.remove('active');
    if (parseFloat(btn.textContent) === rate) btn.classList.add('active');
  });
}

function extractEnglishLine(cardEl) {
  const clone = cardEl.cloneNode(true);
  clone.querySelectorAll('.speak-btn').forEach(el => el.remove());
  let text = (clone.textContent || '')
    .replace(/^▸\s*原句\s*[：:]\s*/u, '')
    .split(/中文释义/u)[0]
    .trim();
  return text.replace(/\s+/g, ' ').trim();
}

function loadSpeechVoices() {
  return new Promise(resolve => {
    if (!window.speechSynthesis) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, { once: true });
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 300);
  });
}

function pickSpeechVoice(lang) {
  const [language, region] = lang.split('-');
  return cachedVoices.find(v => v.lang === lang)
    || cachedVoices.find(v => v.lang.startsWith(`${language}-`) && (!region || v.lang.includes(region)))
    || cachedVoices.find(v => v.lang.startsWith(language))
    || null;
}

function speakEnglish(text, lang = 'en-US') {
  if (!text || !window.speechSynthesis) return Promise.resolve(false);
  return loadSpeechVoices().then(() => new Promise(resolve => {
    const synth = window.speechSynthesis;
    synth.cancel();
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.88;
      const voice = pickSpeechVoice(lang);
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      synth.speak(utterance);
    }, 50);
  }));
}

async function fetchLineManifest(dateStr) {
  try {
    const res = await fetch(resolveUrl(`audio/lines/${dateStr}.json`));
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function playLineAudio(url, btn) {
  if (!url) return Promise.resolve(false);
  if (lineAudioPlayer) {
    lineAudioPlayer.pause();
    lineAudioPlayer = null;
  }
  document.querySelectorAll('.speak-btn.playing').forEach(el => el.classList.remove('playing'));
  lineAudioPlayer = new Audio(resolveUrl(url));
  if (btn) btn.classList.add('playing');
  return lineAudioPlayer.play()
    .then(() => {
      lineAudioPlayer.onended = () => {
        if (btn) btn.classList.remove('playing');
        lineAudioPlayer = null;
      };
      lineAudioPlayer.onerror = () => {
        if (btn) btn.classList.remove('playing');
        lineAudioPlayer = null;
      };
      return true;
    })
    .catch(() => {
      if (btn) btn.classList.remove('playing');
      lineAudioPlayer = null;
      return false;
    });
}

async function playLyricLine(text, lang, mp3Url, btn) {
  if (btn) btn.disabled = true;
  try {
    if (mp3Url) {
      const ok = await playLineAudio(mp3Url, btn);
      if (ok) return;
    }
    if (btn) btn.classList.add('playing');
    if (text) await speakEnglish(text, lang);
  } finally {
    if (btn) {
      btn.disabled = false;
      if (!lineAudioPlayer) btn.classList.remove('playing');
    }
  }
}

function addSpeakButtons(wrapper, artistId, lineManifest = null) {
  const lang = artistId === 'sampha' ? 'en-GB' : 'en-US';
  const manifestLines = lineManifest?.lines || [];
  wrapper.querySelectorAll('.lyric-card').forEach((card, index) => {
    const line = extractEnglishLine(card);
    if (!line) return;
    const mp3Url = manifestLines[index]?.url || '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'speak-btn';
    btn.setAttribute('aria-label', '朗读原句');
    btn.textContent = '🔊 朗读';
    btn.dataset.index = String(index);
    card.appendChild(btn);
  });
}

function enhanceMarkdown(html, artistId = '', lineManifest = null) {
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
    if (p.innerHTML.includes('<strong>▸ 原句')) {
      const card = document.createElement('div');
      card.className = 'lyric-card';
      card.innerHTML = p.innerHTML;
      p.replaceWith(card);
    }
  });

  addSpeakButtons(wrapper, artistId, lineManifest);
  return wrapper;
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
    const hasAudio = await audioExistsForDate(entry.date);
    meta.innerHTML = `
      <h2>${entry.title}</h2>
      <p>${entry.artistName || ARTIST_NAMES[entry.artist]} · ${formatDate(entry.date)}</p>
      ${hasAudio ? renderAudioPlayer(entry.date) : ''}`;
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
    const lineManifest = entry ? await fetchLineManifest(entry.date) : null;
    currentLineManifest = lineManifest;
    body.replaceChildren(enhanceMarkdown(marked.parse(md), entry?.artist || '', lineManifest));
  } catch (err) {
    body.innerHTML = `<p class="error-state">内容加载失败（${err.message}），请刷新后重试。</p>`;
  }
}

document.getElementById('back-btn').addEventListener('click', showHome);
document.getElementById('lesson-body').addEventListener('click', e => {
  const btn = e.target.closest('.speak-btn');
  if (!btn) return;
  e.preventDefault();
  const index = Number(btn.dataset.index);
  const lineInfo = currentLineManifest?.lines?.[index];
  const card = btn.closest('.lyric-card');
  const text = lineInfo?.text || (card ? extractEnglishLine(card) : '');
  const lang = currentLineManifest?.artist === 'sampha' ? 'en-GB' : 'en-US';
  const mp3Url = lineInfo?.url || '';
  playLyricLine(text, lang, mp3Url, btn);
});
document.getElementById('artist-filter').addEventListener('change', e => {
  renderHistory(e.target.value, document.getElementById('search-input').value);
});
document.getElementById('search-input').addEventListener('input', e => {
  renderHistory(document.getElementById('artist-filter').value, e.target.value);
});

async function init() {
  await loadSpeechVoices();
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
