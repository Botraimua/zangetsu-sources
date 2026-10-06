// Project Gutenberg — https://www.gutenberg.org
// Novel source for Zangetsu. 70.000+ public-domain books. Catalogue from
// Gutenberg's own OPDS feed; text from its HTML edition, split into
// chapters at the <h2>/<h3> headings.

var SOURCE_ID = 'gutenberg';
var SITE = 'https://www.gutenberg.org';
var OPDS = SITE + '/ebooks/search.opds/';
var UA = 'ZangetsuSources/1.0 (personal reader; https://github.com/Spyou/Zangetsu)';
var PAGE_SIZE = 25; // fixed by the OPDS feed

var LANGS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'zh', label: '中文' },
  { value: 'all', label: 'Tất cả ngôn ngữ' }
];

var SHELVES = [
  { title: 'Tải nhiều nhất', q: '' },
  { title: 'Trinh thám', q: 'detective' },
  { title: 'Phiêu lưu', q: 'adventure' },
  { title: 'Khoa học viễn tưởng', q: 'science fiction' },
  { title: 'Thiếu nhi', q: 'children' }
];

function getInfo() {
  return { name: 'Project Gutenberg (sách ngoại văn)', lang: 'en', baseUrl: SITE,
           logo: SITE + '/gutenberg/pg-logo-129x80.png', type: 'novel', version: '1.0.1' };
}

function getSettings() {
  return [{ key: 'lang', label: 'Ngôn ngữ sách', type: 'enum', default: 'en', options: LANGS }];
}

// ── helpers ────────────────────────────────────────────────────────────────

function _setting(key, dflt) {
  try {
    var all = globalThis.__settings || {};
    var mine = all[typeof __SOURCE_ID !== 'undefined' ? __SOURCE_ID : SOURCE_ID] || all[SOURCE_ID] || {};
    return mine[key] != null && mine[key] !== '' ? mine[key] : dflt;
  } catch (e) { return dflt; }
}

function _get(url) {
  return fetch(url, { headers: { 'User-Agent': UA }, timeoutMs: 25000 }).then(function (r) {
    if (!r.ok) throw new Error('Gutenberg: HTTP ' + r.status);
    return r.body || '';
  });
}

function _xmlText(s) {
  return htmlText(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}

function _cover(id) { return SITE + '/cache/epub/' + id + '/pg' + id + '.cover.medium.jpg'; }

// OPDS search feed → items. The feed mixes in navigation entries
// ("Authors", "Subjects", social links); real books have an
// <id>…/ebooks/<n>.opds</id>.
function _feed(q, page) {
  var lang = _setting('lang', 'en');
  var query = String(q || '').trim();
  if (lang !== 'all') query = (query ? query + ' ' : '') + 'l.' + lang;
  var url = OPDS + '?sort_order=downloads' + (query ? '&query=' + encodeURIComponent(query) : '');
  if (page > 1) url += '&start_index=' + ((page - 1) * PAGE_SIZE + 1);
  return _get(url).then(function (xml) {
    var out = [], re = /<entry>([\s\S]*?)<\/entry>/g, m;
    while ((m = re.exec(xml)) !== null) {
      var e = m[1];
      var idM = e.match(/<id>[^<]*\/ebooks\/(\d+)\.opds<\/id>/);
      if (!idM) continue;
      var titleM = e.match(/<title>([\s\S]*?)<\/title>/);
      var title = _xmlText(titleM ? titleM[1] : '').replace(/\s*\((French|German|Spanish|Chinese|Italian|Portuguese|Dutch)\)$/, '');
      out.push({ id: idM[1], title: title, url: SITE + '/ebooks/' + idM[1], cover: _cover(idM[1]),
                 type: 'novel', sourceId: SOURCE_ID });
    }
    return out;
  });
}

function _bookId(url) {
  var m = String(url).match(/ebooks\/(\d+)/) || String(url).match(/epub\/(\d+)/) || String(url).match(/^(\d+)$/);
  if (!m) throw new Error('Gutenberg: bad url ' + url);
  return m[1];
}

// The book's own OPDS entry carries the catalogue card as "Label: value"
// paragraphs (Author, Summary, Subject, Language…).
function _meta(id) {
  return _get(SITE + '/ebooks/' + id + '.opds').then(function (xml) {
    var entry = (xml.match(/<entry>([\s\S]*?)<\/entry>/) || [])[1] || '';
    var title = _xmlText((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    var fields = {};
    var re = /<p>([\s\S]*?)<\/p>/g, m;
    while ((m = re.exec(entry)) !== null) {
      var t = htmlText(m[1]);
      var c = t.indexOf(':');
      if (c <= 0 || c > 20) continue;
      var k = t.slice(0, c).trim(), v = t.slice(c + 1).trim();
      (fields[k] = fields[k] || []).push(v);
    }
    return { title: title, fields: fields };
  });
}

function _person(s) {
  // "Doyle, Arthur Conan, 1859-1930" → "Arthur Conan Doyle"
  var parts = String(s).replace(/,?\s*\d{3,4}\??-\d{0,4}\??$/, '').replace(/\s*\[[^\]]*\]$/, '').split(', ');
  return parts.length >= 2 ? parts[1] + ' ' + parts[0] : parts[0];
}

// ── book HTML → chapters ───────────────────────────────────────────────────

// One book at a time is enough: chapter-to-chapter reading hits the same
// file, and a whole novel is ~1 MB of HTML.
var _cache = { id: null, chapters: null };

function _loadBook(id) {
  if (_cache.id === id && _cache.chapters) return Promise.resolve(_cache.chapters);
  var base = SITE + '/cache/epub/' + id + '/';
  return _get(base + 'pg' + id + '-images.html').then(function (html) {
    var chapters = _split(html, base);
    _cache = { id: id, chapters: chapters };
    return chapters;
  });
}

// Heading → short chapter name. Illustrated editions put the picture's
// caption inside the heading ("I hope Mr. Bingley will like it. CHAPTER II.").
function _headTitle(inner) {
  var t = htmlText(String(inner).replace(/<br\s*\/?>/gi, ' ')).replace(/\{[^}]*\}/g, '').trim();
  if (!t) {
    var alt = String(inner).match(/alt="([^"]+)"/i);
    t = alt ? htmlText(alt[1]) : '';
  }
  var cm = t.match(/\b(CHAPTER|Chapter|BOOK|Book|PART|Part|STAVE|Stave)\b[\s\S]*$/);
  if (cm && cm.index > 0) t = cm[0];
  return t.length > 80 ? t.slice(0, 77) + '…' : t;
}

function _split(html, base) {
  var h = String(html);
  // Drop the licence boilerplate around the book.
  var s = h.indexOf('*** START OF');
  if (s !== -1) {
    var close = h.indexOf('</header>', s);
    if (close === -1 || close - s > 600) close = h.indexOf('***', s + 12);
    h = h.slice(close === -1 ? s : close);
  } else {
    var b = h.search(/<body[^>]*>/i);
    if (b !== -1) h = h.slice(b);
  }
  var f = h.search(/<(footer|section)\b[^>]*id="pg-footer"/i);
  if (f === -1) f = h.indexOf('*** END OF');
  if (f !== -1) h = h.slice(0, f);

  h = h.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
       .replace(/(src|href)="(?!https?:|#|data:|\/\/)([^"]+)"/gi, function (_, a, p) { return a + '="' + base + p + '"'; })
       .replace(/<a\b[^>]*class="pginternal"[^>]*>([\s\S]*?)<\/a>/gi, '$1')
       // Print page numbers ("{ix}", "[23]") mean nothing in a phone reader.
       .replace(/<span\b[^>]*class="pagenum"[^>]*>[\s\S]*?<\/span>/gi, '');

  var tag = (h.match(/<h2\b/gi) || []).length >= 2 ? 'h2' : 'h3';
  var re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'gi');
  var heads = [], m;
  while ((m = re.exec(h)) !== null) heads.push({ at: m.index, title: _headTitle(m[1]) });

  var out = [];
  if (heads.length < 2) {
    out.push({ title: 'Toàn văn', html: h });
    return out;
  }
  // Text before the first heading is the title page + table of contents;
  // only keep it when it actually reads like prose.
  var front = h.slice(0, heads[0].at);
  if (htmlText(front).length > 3000 && !/class="toc"/i.test(front)) out.push({ title: 'Mở đầu', html: front });
  var part = '';
  for (var i = 0; i < heads.length; i++) {
    var t = heads[i].title || ('Phần ' + (i + 1));
    if (/^(table of )?contents\.?$|^list of illustrations\.?$/i.test(t)) continue;
    // Multi-part novels restart "CHAPTER I" in every book — keep them apart.
    if (/^(BOOK|PART|VOLUME)\b/i.test(t)) part = t.split(':')[0];
    else if (part && /^CHAPTER\b/i.test(t)) t = part + ' · ' + t;
    out.push({ title: t, html: h.slice(heads[i].at, i + 1 < heads.length ? heads[i + 1].at : h.length) });
  }
  return out;
}

// ── catalogue ──────────────────────────────────────────────────────────────

function getHome(opts) {
  return Promise.all(SHELVES.map(function (s) {
    return _feed(s.q, 1).then(function (items) { return { title: s.title, items: items }; },
                              function () { return { title: s.title, items: [] }; });
  })).then(function (rows) { return rows.filter(function (r) { return r.items.length; }); });
}

function popular(opts) {
  return _feed('', (opts && opts.page) || 1);
}

function search(query, page, opts) {
  return _feed(query, page);
}

function getDetail(url) {
  var id = _bookId(url);
  return Promise.all([_meta(id), _loadBook(id)]).then(function (res) {
    var meta = res[0], f = meta.fields, chapters = res[1];
    var authors = (f.Author || []).map(_person);
    var desc = [];
    if (authors.length) desc.push('Tác giả: ' + authors.join(', '));
    if (f.Translator) desc.push('Dịch: ' + f.Translator.map(_person).join(', '));
    if (f.Language) desc.push('Ngôn ngữ: ' + f.Language.join(', '));
    if (f.Published) desc.push('Lên Gutenberg: ' + f.Published[0]);
    if (f.Summary) desc.push('', f.Summary[0].replace(/\s*\(This is an automatically generated summary\.\)$/, ''));
    var seen = {};
    var genres = (f.Subject || []).map(function (s) { return s.split(' -- ')[0].replace(/\s*\(.*\)$/, ''); })
      .filter(function (g) { if (!g || seen[g]) return false; seen[g] = true; return true; }).slice(0, 8);
    return {
      id: id, title: meta.title, url: SITE + '/ebooks/' + id, cover: _cover(id),
      description: desc.join('\n'), status: 'completed', genres: genres, studios: authors,
      type: 'novel', sourceId: SOURCE_ID,
      chapters: chapters.map(function (c, i) {
        return { id: id + '-' + i, title: c.title, number: i + 1, url: SITE + '/ebooks/' + id + '#ch' + i };
      })
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function (d) { return d.chapters; });
}

function getText(chapterUrl) {
  var id = _bookId(chapterUrl);
  var m = String(chapterUrl).match(/#ch(\d+)$/);
  var idx = m ? parseInt(m[1], 10) : 0;
  return _loadBook(id).then(function (chapters) {
    var c = chapters[idx];
    if (!c) throw new Error('Gutenberg: chapter ' + idx + ' not found');
    return { title: c.title, html: c.html };
  });
}
