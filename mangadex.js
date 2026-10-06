// MangaDex — https://mangadex.org
// Manga source for Zangetsu, built on the official public API
// (https://api.mangadex.org/docs). Truyện do nhóm dịch đăng; MangaDex gỡ
// truyện khi có khiếu nại bản quyền.
//
// Mức nội dung chọn trong Cài đặt nguồn: an toàn / gợi cảm / 18+ / 21+.
// Ở mọi mức, truyện gắn tag Loli hoặc Shota đều bị loại.

var SOURCE_ID = 'mangadex';
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
  return { name: 'MangaDex', lang: 'multi', baseUrl: SITE,
           logo: SITE + '/favicon.ico', type: 'manga', version: '1.0.0' };
}

function getSettings() {
  return [
    { key: 'langs', label: 'Ngôn ngữ bản dịch', type: 'multiEnum', default: ['vi'], options: LANG_OPTIONS },
    { key: 'ratings', label: 'Mức nội dung hiển thị', type: 'multiEnum',
      default: ['safe', 'suggestive'], options: RATING_OPTIONS },
    { key: 'dataSaver', label: 'Tiết kiệm dữ liệu (ảnh nén)', type: 'bool', default: false }
  ];
}

// ── settings ───────────────────────────────────────────────────────────────

function _setting(key, dflt) {
  try {
    var all = globalThis.__settings || {};
    var mine = all[typeof __SOURCE_ID !== 'undefined' ? __SOURCE_ID : SOURCE_ID] || all[SOURCE_ID] || {};
    var v = mine[key];
    if (v == null || v === '') return dflt;
    if (Array.isArray(dflt)) {
      if (typeof v === 'string') v = v.split(',');
      return Array.isArray(v) && v.length ? v : dflt;
    }
    return v;
  } catch (e) { return dflt; }
}

function _langs() { return _setting('langs', ['vi']); }
function _ratings() { return _setting('ratings', ['safe', 'suggestive']); }

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
var _blockedTagIds = null;

function _excludedTags() {
  if (_blockedTagIds) return Promise.resolve(_blockedTagIds);
  return _api('/manga/tag').then(function (j) {
    _blockedTagIds = (j.data || []).filter(function (t) {
      var n = String((t.attributes && t.attributes.name && t.attributes.name.en) || '').toLowerCase();
      return BLOCKED_TAGS.indexOf(n) !== -1;
    }).map(function (t) { return t.id; });
    return _blockedTagIds;
  }, function () { return []; });
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

function _item(m) {
  var t = _titles(m);
  return { id: m.id, title: t.title, englishTitle: t.english, url: SITE + '/title/' + m.id,
           cover: _cover(m, 256), genres: _tagNames(m).slice(0, 5),
           status: _status(m.attributes && m.attributes.status),
           type: 'manga', sourceId: SOURCE_ID };
}

function _mangaId(url) {
  var m = String(url).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!m) throw new Error('MangaDex: không đọc được id từ ' + url);
  return m[0].toLowerCase();
}

// ── catalogue ──────────────────────────────────────────────────────────────

function _list(order, page, extra) {
  page = page > 0 ? page : 1;
  return _excludedTags().then(function (excluded) {
    var p = {
      limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE),
      'includes[]': ['cover_art'],
      'contentRating[]': _ratings(),
      'availableTranslatedLanguage[]': _langs(),
      hasAvailableChapters: 'true'
    };
    if (excluded.length) { p['excludedTags[]'] = excluded; p.excludedTagsMode = 'OR'; }
    p['order[' + order + ']'] = 'desc';
    for (var k in extra || {}) if (extra.hasOwnProperty(k)) p[k] = extra[k];
    return _api('/manga', p);
  }).then(function (j) {
    return (j.data || []).filter(function (m) { return !_hasBlockedTag(m); }).map(_item);
  });
}

var SHELVES = [
  { title: 'Phổ biến', order: 'followedCount' },
  { title: 'Mới cập nhật', order: 'latestUploadedChapter' },
  { title: 'Đánh giá cao', order: 'rating' },
  { title: 'Mới thêm', order: 'createdAt' }
];

function getHome(opts) {
  // Sequential on purpose: MangaDex rate-limits bursts (~5 req/s).
  var rows = [];
  return SHELVES.reduce(function (chain, s) {
    return chain.then(function () {
      return _list(s.order, 1).then(function (items) { rows.push({ title: s.title, items: items }); },
                                    function () {});
    });
  }, Promise.resolve()).then(function () {
    if (!rows.length) return _list('followedCount', 1).then(function () { return rows; }); // surface the error
    return rows.filter(function (r) { return r.items.length; });
  });
}

function popular(opts) {
  return _list('followedCount', (opts && opts.page) || 1);
}

function search(query, page, opts) {
  var q = String(query || '').trim();
  if (!q) return popular({ page: page });
  // A pasted MangaDex link or id opens that title directly.
  if (/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(q)) {
    return _api('/manga/' + _mangaId(q), { 'includes[]': ['cover_art'] })
      .then(function (j) { return _hasBlockedTag(j.data) || !_ratingAllowed(j.data) ? [] : [_item(j.data)]; });
  }
  return _list('relevance', page, { title: q });
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
    var count = {};
    rows.forEach(function (c) { var k = c.attributes.chapter || '_'; count[k] = (count[k] || 0) + 1; });
    var out = rows.map(function (c) {
      var a = c.attributes;
      var g = _rel(c, 'scanlation_group');
      var group = g && g.attributes && g.attributes.name;
      var num = parseFloat(a.chapter);
      return { id: c.id, title: _chapterTitle(a, group, count[a.chapter || '_'] > 1),
               number: isNaN(num) ? null : num, url: SITE + '/chapter/' + c.id,
               date: (a.readableAt || a.publishAt || '').slice(0, 10) || null };
    });
    out.sort(function (x, y) {
      if (x.number == null && y.number == null) return 0;
      if (x.number == null) return 1;
      if (y.number == null) return -1;
      return x.number - y.number;
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
