// MangaDex — https://mangadex.org
// Manga source for Zangetsu, built on the official public API
// (https://api.mangadex.org/docs). Truyện do nhóm dịch đăng; MangaDex gỡ
// truyện khi có khiếu nại bản quyền.
//
// Mức nội dung chọn trong Cài đặt nguồn: an toàn / gợi cảm / 18+ / 21+.
// Ở mọi mức, truyện gắn tag Loli hoặc Shota đều bị loại.

var SOURCE_ID = 'mangadex';
// The same file is installed twice from index.json: "mangadex" (all ages)
// and "mangadex-18" (adult only). The runtime id picks the defaults.
var RUNTIME_ID = typeof __SOURCE_ID !== 'undefined' ? __SOURCE_ID : SOURCE_ID;
var ADULT = /18/.test(RUNTIME_ID);
var DEFAULT_LANGS = ADULT ? ['vi', 'en'] : ['vi'];
var DEFAULT_RATINGS = ADULT ? ['erotica', 'pornographic'] : ['safe', 'suggestive'];
var SITE = 'https://mangadex.org';
var API = 'https://api.mangadex.org';
var UA = 'ZangetsuSources/1.0 (personal reader; https://github.com/Spyou/Zangetsu)';
var PAGE_SIZE = 30;
var FEED_LIMIT = 500;   // API maximum for /manga/{id}/feed
var BLOCKED_TAGS = ['loli', 'shota'];

var LANG_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'es-la', label: 'Español (LATAM)' },
  { value: 'pt-br', label: 'Português (BR)' },
  { value: 'fr', label: 'Français' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'th', label: 'ไทย' },
  { value: 'zh', label: '中文' }
];

var RATING_OPTIONS = [
  { value: 'safe', label: 'An toàn' },
  { value: 'suggestive', label: 'Gợi cảm (16+)' },
  { value: 'erotica', label: 'Nhạy cảm (18+)' },
  { value: 'pornographic', label: 'Người lớn (21+)' }
];

function getInfo() {
  return { name: ADULT ? 'MangaDex 18+' : 'MangaDex', lang: 'multi', baseUrl: SITE,
           logo: SITE + '/favicon.ico', type: 'manga', version: '1.3.0' };
}

function getSettings() {
  return [
    { key: 'langs', label: 'Ngôn ngữ bản dịch', type: 'multiEnum', default: DEFAULT_LANGS, options: LANG_OPTIONS },
    { key: 'ratings', label: 'Mức nội dung hiển thị', type: 'multiEnum',
      default: DEFAULT_RATINGS, options: RATING_OPTIONS },
    { key: 'viFirst', label: 'Ưu tiên chương tiếng Việt (ẩn bản ngôn ngữ khác trùng số chương)',
      type: 'bool', default: true },
    { key: 'dataSaver', label: 'Tiết kiệm dữ liệu (ảnh nén)', type: 'bool', default: false }
  ];
}

// ── settings ───────────────────────────────────────────────────────────────

function _setting(key, dflt) {
  try {
    var all = globalThis.__settings || {};
    // Own id only — the 18+ install must not inherit the all-ages settings.
    var mine = all[RUNTIME_ID] || {};
    var v = mine[key];
    if (v == null || v === '') return dflt;
    if (Array.isArray(dflt)) {
      if (typeof v === 'string') v = v.split(',');
      return Array.isArray(v) && v.length ? v : dflt;
    }
    return v;
  } catch (e) { return dflt; }
}

function _langs() { return _setting('langs', DEFAULT_LANGS); }
function _ratings() { return _setting('ratings', DEFAULT_RATINGS); }

// ── http ───────────────────────────────────────────────────────────────────

// MangaDex's query style is repeated keys: contentRating[]=safe&contentRating[]=…
function _qs(params) {
  var out = [];
  for (var k in params) {
    if (!params.hasOwnProperty(k) || params[k] == null) continue;
    var v = params[k];
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) out.push(encodeURIComponent(k) + '=' + encodeURIComponent(v[i]));
    } else {
      out.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    }
  }
  return out.join('&');
}

function _api(path, params) {
  var url = API + path + (params ? '?' + _qs(params) : '');
  return fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, timeoutMs: 20000 })
    .then(function (r) {
      var j = null;
      try { j = JSON.parse(r.body || 'null'); } catch (e) {}
      if (!r.ok || !j || j.result === 'error') {
        var detail = j && j.errors && j.errors[0] ? (j.errors[0].detail || j.errors[0].title) : '';
        if (r.status === 0 || r.status === 403) {
          throw new Error('MangaDex: không kết nối được (mạng có thể đang chặn MangaDex — thử bật VPN/1.1.1.1)');
        }
        throw new Error('MangaDex: HTTP ' + r.status + (detail ? ' — ' + detail : ''));
      }
      return j;
    });
}

// ── tag filter ─────────────────────────────────────────────────────────────

// Tag ids are looked up by name once per runtime, not hard-coded, so a
// renamed/reissued tag can't silently disable the filter. Results are also
// filtered client-side by tag name as a second line of defence.
// The same lookup also gives the genre rows and "#thể loại" browsing their
// tag ids, keyed by lower-case English name.
var _tagCache = null;

function _tags() {
  if (_tagCache) return Promise.resolve(_tagCache);
  return _api('/manga/tag').then(function (j) {
    var byName = {}, blocked = [];
    (j.data || []).forEach(function (t) {
      var n = String((t.attributes && t.attributes.name && t.attributes.name.en) || '').toLowerCase();
      if (!n) return;
      byName[n] = t.id;
      if (BLOCKED_TAGS.indexOf(n) !== -1) blocked.push(t.id);
    });
    _tagCache = { byName: byName, blocked: blocked };
    return _tagCache;
  }, function () { return { byName: {}, blocked: [] }; });
}

function _excludedTags() {
  return _tags().then(function (t) { return t.blocked; });
}

function _hasBlockedTag(m) {
  var tags = (m.attributes && m.attributes.tags) || [];
  for (var i = 0; i < tags.length; i++) {
    var n = String((tags[i].attributes && tags[i].attributes.name && tags[i].attributes.name.en) || '').toLowerCase();
    if (BLOCKED_TAGS.indexOf(n) !== -1) return true;
  }
  return false;
}

// Lists are gated by contentRating[] server-side; a pasted link isn't.
function _ratingAllowed(m) {
  var r = (m && m.attributes && m.attributes.contentRating) || 'safe';
  return _ratings().indexOf(r) !== -1;
}

// ── mapping ────────────────────────────────────────────────────────────────

function _pick(map, langs) {
  if (!map) return '';
  for (var i = 0; i < langs.length; i++) if (map[langs[i]]) return map[langs[i]];
  if (map.en) return map.en;
  for (var k in map) if (map.hasOwnProperty(k) && map[k]) return map[k];
  return '';
}

function _titles(m) {
  var a = m.attributes || {};
  var langs = _langs();
  var main = _pick(a.title, ['en']);
  var alt = {};
  (a.altTitles || []).forEach(function (t) { for (var k in t) if (t.hasOwnProperty(k) && !alt[k]) alt[k] = t[k]; });
  // Prefer a title in the reader's language when the uploaders gave one.
  var local = '';
  for (var i = 0; i < langs.length; i++) if (alt[langs[i]]) { local = alt[langs[i]]; break; }
  return { title: local || main || alt.en || alt['ja-ro'] || 'Không tên', english: local ? main : (alt.en || null) };
}

function _rel(m, type) {
  var rels = m.relationships || [];
  for (var i = 0; i < rels.length; i++) if (rels[i].type === type) return rels[i];
  return null;
}

function _cover(m, size) {
  var c = _rel(m, 'cover_art');
  var file = c && c.attributes && c.attributes.fileName;
  return file ? 'https://uploads.mangadex.org/covers/' + m.id + '/' + file + '.' + (size || 256) + '.jpg' : null;
}

function _tagNames(m) {
  return ((m.attributes && m.attributes.tags) || []).map(function (t) {
    return (t.attributes && t.attributes.name && (t.attributes.name.en || _pick(t.attributes.name, ['en']))) || '';
  }).filter(Boolean);
}

function _status(s) {
  return { ongoing: 'ongoing', completed: 'completed', hiatus: 'hiatus', cancelled: 'cancelled' }[s] || 'unknown';
}

function _hasVi(m) {
  var langs = (m.attributes && m.attributes.availableTranslatedLanguages) || [];
  return langs.indexOf('vi') !== -1;
}

function _item(m) {
  var t = _titles(m);
  // dubBadge is the corner tag Zangetsu draws on a poster — used here to
  // flag titles that have a Vietnamese translation.
  return { id: m.id, title: t.title, englishTitle: t.english, url: SITE + '/title/' + m.id,
           cover: _cover(m, 256), genres: _tagNames(m).slice(0, 5),
           status: _status(m.attributes && m.attributes.status),
           dubBadge: _hasVi(m) ? '🇻🇳 VI' : null,
           type: 'manga', sourceId: SOURCE_ID };
}

// Mixed-language lists: titles with a Vietnamese translation first, order
// otherwise unchanged.
function _viFirst(items) {
  return items.filter(function (i) { return i.dubBadge; })
    .concat(items.filter(function (i) { return !i.dubBadge; }));
}

function _multiLang() {
  var l = _langs();
  return l.length > 1 && l.indexOf('vi') !== -1;
}

function _mangaId(url) {
  var m = String(url).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!m) throw new Error('MangaDex: không đọc được id từ ' + url);
  return m[0].toLowerCase();
}

// ── catalogue ──────────────────────────────────────────────────────────────

var HOME_ROW_SIZE = 100;   // MangaDex's per-request maximum

function _list(order, page, extra, size) {
  page = page > 0 ? page : 1;
  size = size || PAGE_SIZE;
  return _excludedTags().then(function (excluded) {
    var p = {
      limit: String(size), offset: String((page - 1) * size),
      'includes[]': ['cover_art'],
      'contentRating[]': _ratings(),
      'availableTranslatedLanguage[]': _langs(),
      hasAvailableChapters: 'true'
    };
    if (excluded.length) { p['excludedTags[]'] = excluded; p.excludedTagsMode = 'OR'; }
    p['order[' + order + ']'] = 'desc';
    for (var k in extra || {}) if (extra.hasOwnProperty(k)) p[k] = extra[k];
    // offset + limit may not exceed 10 000 on MangaDex — that's the end.
    if ((page - 1) * size + size > 10000) return { data: [] };
    return _api('/manga', p);
  }).then(function (j) {
    return (j.data || []).filter(function (m) { return !_hasBlockedTag(m); }).map(_item);
  });
}

// Vietnamese genre names → MangaDex tag (English name). Used for the home
// rows and for "#thể loại" searches; English tag names work as-is too.
var GENRES = [
  ['Tình cảm', 'romance'], ['Hành động', 'action'], ['Hài hước', 'comedy'], ['Giả tưởng', 'fantasy'],
  ['Xuyên không', 'isekai'], ['Chính kịch', 'drama'], ['Đời thường', 'slice of life'],
  ['Học đường', 'school life'], ['Phiêu lưu', 'adventure'], ['Trinh thám', 'mystery'],
  ['Kinh dị', 'horror'], ['Tâm lý', 'psychological'], ['Khoa học viễn tưởng', 'sci-fi'],
  ['Lịch sử', 'historical'], ['Thể thao', 'sports'], ['Siêu nhiên', 'supernatural'],
  ['Võ thuật', 'martial arts'], ['Bi kịch', 'tragedy'], ['Harem', 'harem'],
  ['Công sở', 'office workers'], ['Quái vật', 'monster girls'], ['Ma cà rồng', 'vampires'],
  ['Phép thuật', 'magic'], ['Trò chơi', 'video games'], ['Nấu ăn', 'cooking'],
  ['Boys\' Love', 'boys\' love'], ['Girls\' Love', 'girls\' love']
];

function _norm(s) {
  return String(s || '').toLowerCase().normalize('NFC').replace(/^#\s*/, '').trim();
}

// "#tình cảm", "#Romance", "#romance" → tag id (null when unknown).
function _genreTagId(q, tags) {
  var n = _norm(q);
  for (var i = 0; i < GENRES.length; i++) {
    if (_norm(GENRES[i][0]) === n) n = GENRES[i][1];
  }
  return tags.byName[n] || null;
}

var SHELVES = [
  { title: 'Phổ biến', order: 'followedCount' },
  { title: 'Mới cập nhật', order: 'latestUploadedChapter' },
  { title: 'Đánh giá cao', order: 'rating' },
  { title: 'Mới thêm', order: 'createdAt' }
];

// Shown above everything else when the reader picked Vietnamese plus other
// languages: the same lists restricted to titles that have a Vietnamese
// translation, so those don't drown among the English-only ones.
var VI_SHELVES = [
  { title: '🇻🇳 Phổ biến (tiếng Việt)', order: 'followedCount' },
  { title: '🇻🇳 Mới cập nhật (tiếng Việt)', order: 'latestUploadedChapter' },
  { title: '🇻🇳 Đánh giá cao (tiếng Việt)', order: 'rating' }
];

// Genre rows for the 18+ install — the themes adult titles actually use,
// instead of the all-ages list (sports, cooking…).
var ADULT_GENRES = ['Tình cảm', 'Công sở', 'Học đường', 'Hài hước', 'Chính kịch', 'Giả tưởng',
                    'Xuyên không', 'Harem', 'Quái vật', 'Ma cà rồng', 'Đời thường', 'Siêu nhiên',
                    'Tâm lý', 'Phiêu lưu', 'Boys\' Love', 'Girls\' Love'];

function _homeGenres() {
  if (!ADULT) return GENRES.slice(0, HOME_GENRES);
  return ADULT_GENRES.map(function (name) {
    for (var i = 0; i < GENRES.length; i++) if (GENRES[i][0] === name) return GENRES[i];
    return null;
  }).filter(Boolean);
}

var VI_ONLY = { 'availableTranslatedLanguage[]': ['vi'] };

function _merge(a, b) {
  var o = {}, k;
  for (k in a || {}) if (a.hasOwnProperty(k)) o[k] = a[k];
  for (k in b || {}) if (b.hasOwnProperty(k)) o[k] = b[k];
  return o;
}

// Zangetsu shows a JS source's home rows as-is, with no "see all" paging,
// so the home is made big instead: four 100-title lists plus one 100-title
// row per main genre. Fetched three at a time to stay under MangaDex's rate
// limit, and cut off after HOME_BUDGET_MS so the app's 30 s getHome timeout
// never throws the finished rows away.
var HOME_GENRES = 16;
var HOME_BUDGET_MS = 20000;

function getHome(opts) {
  var deadline = Date.now() + HOME_BUDGET_MS;
  return _tags().then(function (tags) {
    var jobs = [];
    // Vietnamese rows go first so they're never the ones the time budget drops.
    if (_multiLang()) {
      VI_SHELVES.forEach(function (s) {
        jobs.push({ title: s.title, run: function () { return _list(s.order, 1, VI_ONLY, HOME_ROW_SIZE); } });
      });
    }
    SHELVES.forEach(function (s) {
      jobs.push({ title: s.title, run: function () { return _list(s.order, 1, null, HOME_ROW_SIZE); } });
    });
    _homeGenres().forEach(function (g) {
      var id = tags.byName[g[1]];
      if (!id) return;
      jobs.push({ title: g[0], run: function () {
        return _list('followedCount', 1, { 'includedTags[]': [id] }, HOME_ROW_SIZE);
      } });
    });
    var rows = new Array(jobs.length), next = 0;
    function worker() {
      if (next >= jobs.length || Date.now() > deadline) return Promise.resolve();
      var i = next++;
      return jobs[i].run().then(function (items) { rows[i] = { title: jobs[i].title, items: items }; },
                                function () {}).then(worker);
    }
    return Promise.all([worker(), worker(), worker()]).then(function () {
      var out = rows.filter(function (r) { return r && r.items.length; });
      if (!out.length) return _list('followedCount', 1).then(function () { return out; }); // surface the error
      return out;
    });
  });
}

function popular(opts) {
  return _list('followedCount', (opts && opts.page) || 1);
}

// Zangetsu asks for search page 2, 3… with an EMPTY query (it doesn't keep
// the query between pages), so remember the last one and keep paging it.
var _lastQuery = '';

function search(query, page, opts) {
  page = page > 0 ? page : 1;
  var q = String(query || '').trim();
  if (q) _lastQuery = q;
  else if (page > 1) q = _lastQuery;
  // A trailing " vi" (or the 🇻🇳 flag) keeps only titles with a Vietnamese
  // translation: "* vi", "#tình cảm vi", "🇻🇳".
  var vi = false;
  if (/(^|\s)(vi|🇻🇳)$/i.test(q) && q.length > 2 || q === '🇻🇳') {
    vi = true;
    q = q.replace(/\s*(vi|🇻🇳)$/i, '').trim() || '*';
  }
  var only = vi ? VI_ONLY : null;
  // "*" (or "tất cả") browses the whole catalogue, most followed first.
  if (!q || q === '*' || _norm(q) === 'tất cả' || _norm(q) === 'all') {
    return _list('followedCount', page, only);
  }
  // A pasted MangaDex link or id opens that title directly.
  if (/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(q)) {
    if (page > 1) return Promise.resolve([]);
    return _api('/manga/' + _mangaId(q), { 'includes[]': ['cover_art'] })
      .then(function (j) { return _hasBlockedTag(j.data) || !_ratingAllowed(j.data) ? [] : [_item(j.data)]; });
  }
  // "#thể loại" browses every title in that genre.
  if (q.charAt(0) === '#') {
    return _tags().then(function (tags) {
      var id = _genreTagId(q, tags);
      if (!id) throw new Error('MangaDex: không có thể loại "' + q.slice(1).trim() + '"');
      return _list('followedCount', page, _merge({ 'includedTags[]': [id] }, only));
    });
  }
  return _list('relevance', page, _merge({ title: q }, only)).then(function (items) {
    return _multiLang() ? _viFirst(items) : items;
  });
}

// ── detail + chapters ──────────────────────────────────────────────────────

function _chapterTitle(a, group, dupes) {
  var parts = [];
  if (a.volume) parts.push('Vol. ' + a.volume);
  parts.push(a.chapter ? 'Ch. ' + a.chapter : 'Oneshot');
  var t = parts.join(' ');
  if (a.title) t += ': ' + a.title;
  if (group && dupes) t += ' [' + group + ']';
  return t;
}

function _feedAll(id) {
  var all = [];
  function page(offset) {
    return _api('/manga/' + id + '/feed', {
      limit: String(FEED_LIMIT), offset: String(offset),
      'translatedLanguage[]': _langs(),
      'contentRating[]': ['safe', 'suggestive', 'erotica', 'pornographic'],
      'includes[]': ['scanlation_group'],
      'order[volume]': 'asc', 'order[chapter]': 'asc',
      includeFutureUpdates: '0', includeEmptyPages: '0', includeExternalUrl: '0'
    }).then(function (j) {
      all = all.concat(j.data || []);
      var next = offset + FEED_LIMIT;
      // offset + limit may not exceed 10 000 on MangaDex.
      if (next < (j.total || 0) && next + FEED_LIMIT <= 10000) return page(next);
      return all;
    });
  }
  return page(0);
}

function _chapters(id) {
  return _feedAll(id).then(function (rows) {
    rows = rows.filter(function (c) {
      var a = c.attributes || {};
      return !a.externalUrl && (a.pages == null || a.pages > 0);
    });
    var multi = _langs().length > 1;
    // With "ưu tiên tiếng Việt" on, a chapter number that has a Vietnamese
    // release shows only that; other languages just fill the gaps.
    if (multi && _langs().indexOf('vi') !== -1 && _setting('viFirst', true) === true) {
      var viNums = {};
      rows.forEach(function (c) { if (c.attributes.translatedLanguage === 'vi') viNums[c.attributes.chapter || '_'] = true; });
      rows = rows.filter(function (c) {
        return c.attributes.translatedLanguage === 'vi' || !viNums[c.attributes.chapter || '_'];
      });
    }
    var count = {};
    rows.forEach(function (c) { var k = c.attributes.chapter || '_'; count[k] = (count[k] || 0) + 1; });
    var out = rows.map(function (c) {
      var a = c.attributes;
      var g = _rel(c, 'scanlation_group');
      var group = g && g.attributes && g.attributes.name;
      var num = parseFloat(a.chapter);
      var title = _chapterTitle(a, group, count[a.chapter || '_'] > 1);
      // Mark the language whenever more than one is in play.
      if (multi && a.translatedLanguage) title = (a.translatedLanguage === 'vi' ? '🇻🇳 ' : '[' + a.translatedLanguage.toUpperCase() + '] ') + title;
      return { id: c.id, title: title,
               number: isNaN(num) ? null : num, url: SITE + '/chapter/' + c.id,
               date: (a.readableAt || a.publishAt || '').slice(0, 10) || null };
    });
    out.sort(function (x, y) {
      if (x.number == null && y.number == null) return 0;
      if (x.number == null) return 1;
      if (y.number == null) return -1;
      if (x.number !== y.number) return x.number - y.number;
      // Same chapter in several languages: Vietnamese first.
      return (y.title.indexOf('🇻🇳') === 0) - (x.title.indexOf('🇻🇳') === 0);
    });
    return out;
  });
}

function getDetail(url) {
  var id = _mangaId(url);
  return Promise.all([
    _api('/manga/' + id, { 'includes[]': ['cover_art', 'author', 'artist'] }),
    _chapters(id)
  ]).then(function (res) {
    var m = res[0].data, a = m.attributes || {};
    if (_hasBlockedTag(m)) throw new Error('MangaDex: truyện này bị bộ lọc nội dung chặn');
    if (!_ratingAllowed(m)) throw new Error('MangaDex: truyện ở mức nội dung chưa bật — bật trong Cài đặt nguồn');
    var t = _titles(m);
    var people = [];
    (m.relationships || []).forEach(function (r) {
      if ((r.type === 'author' || r.type === 'artist') && r.attributes && r.attributes.name &&
          people.indexOf(r.attributes.name) === -1) people.push(r.attributes.name);
    });
    var desc = _pick(a.description, _langs());
    var rating = { safe: '', suggestive: 'Gợi cảm', erotica: '18+', pornographic: '21+' }[a.contentRating] || '';
    var head = [];
    if (people.length) head.push('Tác giả: ' + people.join(', '));
    if (rating) head.push('Mức nội dung: ' + rating);
    var chapters = res[1];
    if (!chapters.length) head.push('(Chưa có chương nào bằng ngôn ngữ đã chọn — đổi trong Cài đặt nguồn.)');
    return {
      id: m.id, title: t.title, englishTitle: t.english, url: SITE + '/title/' + m.id,
      cover: _cover(m, 512), description: head.join('\n') + (desc ? '\n\n' + desc : ''),
      status: _status(a.status), genres: _tagNames(m), studios: people,
      year: a.year ? String(a.year) : null, isAdult: a.contentRating === 'erotica' || a.contentRating === 'pornographic',
      type: 'manga', sourceId: SOURCE_ID, chapters: chapters
    };
  });
}

function getChapters(url) {
  return _chapters(_mangaId(url));
}

function getPages(chapterUrl) {
  var id = _mangaId(chapterUrl);
  return _api('/at-home/server/' + id).then(function (j) {
    var saver = _setting('dataSaver', false) === true;
    var ch = j.chapter || {};
    var files = (saver ? ch.dataSaver : ch.data) || [];
    var dir = saver ? '/data-saver/' : '/data/';
    return files.map(function (f) { return { url: j.baseUrl + dir + ch.hash + '/' + f }; });
  });
}
