// Wikisource tiếng Việt — https://vi.wikisource.org
// Novel source for Zangetsu. Văn học Việt Nam thuộc phạm vi công cộng,
// lấy qua MediaWiki API chính thức (không cào trang).

var SOURCE_ID = 'wikisource-vi';
var SITE = 'https://vi.wikisource.org';
var API = SITE + '/w/api.php';
var UA = 'ZangetsuSources/1.0 (personal reader; https://github.com/Spyou/Zangetsu)';
var PAGE_SIZE = 30;

// Category-backed shelves. Every listing goes through CirrusSearch with
// `incategory:` so paging is a plain offset, not a continuation token.
var SHELVES = [
  { title: 'Tác phẩm chọn lọc', cat: 'Tác phẩm chọn lọc' },
  { title: 'Tiểu thuyết', cat: 'Tiểu thuyết' },
  { title: 'Truyện ngắn', cat: 'Truyện ngắn' },
  { title: 'Truyện thơ', cat: 'Truyện thơ' }
];

function getInfo() {
  return { name: 'Wikisource Tiếng Việt', lang: 'vi', baseUrl: SITE,
           logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Wikisource-logo.svg/200px-Wikisource-logo.svg.png',
           type: 'novel', version: '1.1.0' };
}

// ── helpers ────────────────────────────────────────────────────────────────

function _qs(params) {
  var out = [];
  for (var k in params) {
    if (params.hasOwnProperty(k) && params[k] != null) {
      out.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
  }
  return out.join('&');
}

function _sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

// Wikimedia answers 503/429 when it's busy; one retry after a short pause
// clears almost all of them.
function _get(url, retried) {
  return fetch(url, { headers: { 'User-Agent': UA } }).then(function (r) {
    if ((r.status === 503 || r.status === 429) && !retried) {
      return _sleep(1500).then(function () { return _get(url, true); });
    }
    return r;
  });
}

function _api(params) {
  params.format = 'json';
  params.formatversion = '2';
  return _get(API + '?' + _qs(params))
    .then(function (r) {
      if (!r.ok) throw new Error('Wikisource: HTTP ' + r.status);
      var j;
      try { j = JSON.parse(r.body || 'null'); } catch (e) { throw new Error('Wikisource: bad JSON'); }
      if (j && j.error) throw new Error('Wikisource: ' + (j.error.info || j.error.code));
      return j;
    });
}

// Same escaping MediaWiki itself uses for /wiki/ links (wfUrlencode).
function _pageUrl(title) {
  return SITE + '/wiki/' + encodeURIComponent(String(title).replace(/ /g, '_'))
    .replace(/%(2F|3A|3B|40|24|21|2A|28|29|2C|7E)/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
}

function _titleFromUrl(url) {
  var m = String(url).match(/\/wiki\/([^?#]+)/);
  var raw = m ? m[1] : String(url);
  try { raw = decodeURIComponent(raw); } catch (e) {}
  return raw.replace(/_/g, ' ');
}

function _root(title) { return String(title).split('/')[0]; }

function _item(title, cover) {
  return { id: title, title: title, url: _pageUrl(title), cover: cover || null,
           type: 'novel', sourceId: SOURCE_ID };
}

// Search results include subpages ("Truyện Kiều/Phần 2") and the odd
// non-literary page. Fold subpages into their work and drop duplicates.
function _itemsFromSearch(j) {
  var hits = (j && j.query && j.query.search) || [];
  var seen = {}, out = [];
  for (var i = 0; i < hits.length; i++) {
    var t = _root(hits[i].title);
    if (seen[t] || LEGAL.test(t)) continue;
    seen[t] = true;
    out.push(_item(t));
  }
  return out;
}

function _searchPage(srsearch, page) {
  page = page > 0 ? page : 1;
  return _api({ action: 'query', list: 'search', srsearch: srsearch, srnamespace: '0',
                srlimit: String(PAGE_SIZE), sroffset: String((page - 1) * PAGE_SIZE),
                srprop: '' })
    .then(_itemsFromSearch)
    .then(_withCovers);
}

// Covers, best first: the Wikisource page's own image, then the Vietnamese
// Wikipedia article about the work, then a generated title card. Only a
// handful of works have a real image, so the card is the common case.
function _withCovers(items) {
  if (!items.length) return Promise.resolve(items);
  var titles = items.map(function (i) { return i.title; });
  return _pageImages(API, titles).then(function (ws) {
    var missing = items.filter(function (it) { return !ws[it.title]; });
    var wikiTitle = function (t) { return t.replace(/\s*\([^)]*\)\s*$/, ''); };
    return _pageImages(WIKIPEDIA_API, missing.map(function (it) { return wikiTitle(it.title); }))
      .then(function (wp) {
        items.forEach(function (it) {
          it.cover = ws[it.title] || wp[wikiTitle(it.title)] || _titleCard(it.title);
        });
        return items;
      });
  });
}

var WIKIPEDIA_API = 'https://vi.wikipedia.org/w/api.php';

// title → thumbnail url, following redirects/normalisation back to the
// title we asked for. Never rejects: a failed lookup just means no image.
function _pageImages(api, titles) {
  if (!titles.length) return Promise.resolve({});
  var q = { action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '300', pilimit: '50',
            redirects: '1', titles: titles.slice(0, 50).join('|'), format: 'json', formatversion: '2' };
  return _get(api + '?' + _qs(q)).then(function (r) {
    var j = JSON.parse(r.body || '{}').query || {};
    var back = {};
    (j.normalized || []).concat(j.redirects || []).forEach(function (n) { back[n.to] = back[n.from] || n.from; });
    var out = {};
    (j.pages || []).forEach(function (p) {
      if (!p.thumbnail) return;
      out[p.title] = p.thumbnail.source;
      if (back[p.title]) out[back[p.title]] = p.thumbnail.source;
    });
    return out;
  }).catch(function () { return {}; });
}

var CARD_COLORS = [['7a2e2e', 'f5e6c8'], ['1f3a5f', 'e8eef5'], ['2f5233', 'eef3e2'], ['4a3b6b', 'efe9f7'],
                   ['5c4033', 'f3e9dc'], ['0f4c5c', 'e3f2f1'], ['6b2d5c', 'f7e8f1'], ['3d3d3d', 'f0f0f0']];

// Generated cover: the title on a colour picked from the title, so a work
// keeps the same card everywhere. placehold.co renders Vietnamese with Roboto.
function _titleCard(title) {
  var t = String(title).replace(/\s*\([^)]*\)\s*$/, '');
  var h = 0;
  for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  var c = CARD_COLORS[h % CARD_COLORS.length];
  // Break into ~14-character lines; the service draws "\n" as a line break.
  var words = t.split(/\s+/), lines = [], cur = '';
  words.forEach(function (w) {
    if (cur && (cur + ' ' + w).length > 14) { lines.push(cur); cur = w; } else { cur = cur ? cur + ' ' + w : w; }
  });
  if (cur) lines.push(cur);
  var text = lines.slice(0, 6).join('\\n');
  return 'https://placehold.co/300x450/' + c[0] + '/' + c[1] + '/png?font=roboto&text=' + encodeURIComponent(text);
}

// Removes every <tag ...> block whose opening tag matches attrRe, including
// nested children of the same tag. Regex alone can't balance nested divs,
// so walk open/close tags and count depth.
function _removeBlocks(html, tag, attrRe) {
  var openRe = new RegExp('<' + tag + '\\b[^>]*>', 'gi');
  var out = '', pos = 0, m;
  while ((m = openRe.exec(html)) !== null) {
    if (!attrRe.test(m[0])) continue;
    var depth = 1, scan = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
    scan.lastIndex = m.index + m[0].length;
    var end = -1, t;
    while ((t = scan.exec(html)) !== null) {
      if (t[0].charAt(t[0].length - 2) === '/') continue; // self-closing
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    if (end === -1) end = html.length;
    out += html.slice(pos, m.index);
    pos = end;
    openRe.lastIndex = end;
  }
  return out + html.slice(pos);
}

function _cleanHtml(html) {
  var h = String(html || '');
  h = h.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
       .replace(/<link\b[^>]*>/gi, '')
       .replace(/<!--[\s\S]*?-->/g, '');
  // Navigation header, license boxes, edit links, print-hidden chrome.
  var junk = /(id="headerContainer"|ws-noexport|noprint|licenseContainer|mw-editsection|navbox|catlinks|mw-empty-elt)/i;
  h = _removeBlocks(h, 'div', junk);
  h = _removeBlocks(h, 'table', junk);
  // Page numbers and absolutely-positioned verse line numbers (Truyện Kiều)
  // overlap the text on a phone screen.
  h = _removeBlocks(h, 'span', /mw-editsection|ws-pagenum|pagenum|position:\s*absolute/i);
  // Protocol-relative images (upload.wikimedia.org) need a scheme in the reader.
  h = h.replace(/(src|srcset)="\/\//g, '$1="https://');
  // Keep internal links readable but inert — the reader has no wiki router.
  h = h.replace(/<a\b[^>]*>/gi, '').replace(/<\/a>/gi, '');
  return h.trim();
}

function _headerField(html, id) {
  var m = String(html).match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)</span>\\s*</span>|id="' + id + '"[^>]*>([\\s\\S]*?)</span>'));
  if (!m) return '';
  return htmlText(m[1] || m[2] || '');
}

// Chapter links, in reading order: existing (blue) links into this work's
// own subpages. Red links point at /w/index.php?…redlink=1, so they never
// match the /wiki/ pattern and drop out on their own.
function _chapterLinks(html, root) {
  var prefix = root + '/';
  var re = /<a\b[^>]*href="(\/wiki\/[^"#]+)(?:#[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi;
  var seen = {}, out = [], m;
  while ((m = re.exec(html)) !== null) {
    // Compare decoded titles: hrefs leave some characters (",", "(") raw.
    var title = _titleFromUrl(m[1]);
    if (title.indexOf(prefix) !== 0) continue;
    if (seen[title]) continue;
    seen[title] = true;
    var label = htmlText(m[2]) || title.slice(root.length + 1);
    out.push({ title: title, label: label });
  }
  return out;
}

// ── catalogue ──────────────────────────────────────────────────────────────

function getHome(opts) {
  // One shelf at a time: Wikimedia asks clients not to fire requests in parallel.
  var rows = [];
  return SHELVES.reduce(function (chain, s) {
    return chain.then(function () {
      return _searchPage('incategory:"' + s.cat + '"', 1)
        .then(function (items) { if (items.length) rows.push({ title: s.title, items: items }); },
              function () {});
    });
  }, Promise.resolve()).then(function () { return rows; });
}

function popular(opts) {
  var page = (opts && opts.page) || 1;
  return _searchPage('incategory:"' + SHELVES[0].cat + '"', page);
}

function search(query, page, opts) {
  var q = String(query || '').trim();
  if (!q) return popular({ page: page });
  // Exact-phrase title matches first, then the phrase anywhere (catches an
  // author's name in the work header). Much of the wiki is legislation,
  // which would otherwise bury the literature — drop it.
  var phrase = '"' + q.replace(/"/g, '') + '"';
  return Promise.all([
    _searchPage('intitle:' + phrase, page).catch(function () { return []; }),
    _searchPage(phrase, page)
  ]).then(function (res) {
    var seen = {}, out = [];
    res[0].concat(res[1]).forEach(function (it) {
      if (seen[it.title] || !_notLegal(it)) return;
      seen[it.title] = true;
      out.push(it);
    });
    return out;
  });
}

var LEGAL = /^(Luật|Bộ luật|Hiến pháp|Nghị định|Nghị quyết|Thông tư|Quyết định|Pháp lệnh|Chỉ thị|Công văn|Lệnh|Sắc lệnh|Thông báo|Công ước|Hiệp định|Điều lệ|Quy chế|Quy định)\b/;
function _notLegal(item) { return !LEGAL.test(item.title); }

function getDetail(url) {
  var title = _root(_titleFromUrl(url));
  return Promise.all([
    _api({ action: 'parse', page: title, prop: 'text', redirects: '1' }),
    _api({ action: 'query', titles: title, prop: 'pageimages|categories', redirects: '1',
           piprop: 'thumbnail', pithumbsize: '400', clshow: '!hidden', cllimit: '30' })
      .catch(function () { return null; })
  ]).then(function (res) {
    var parse = res[0].parse;
    var realTitle = parse.title || title;
    // The header template writes ids/classes with "&#95;" for "_".
    var html = String(parse.text || '').replace(/&#95;/g, '_');
    var page = res[1] && res[1].query && res[1].query.pages && res[1].query.pages[0];

    var author = _headerField(html, 'header_author_text');
    var translator = _headerField(html, 'header_translator_text');
    var yearM = html.match(/id="header_year_text"[^>]*>([^<]*)</);
    var year = yearM ? htmlText(yearM[1]).replace(/[()]/g, '').trim() : '';
    var notesM = html.match(/class="header_notes[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    var notes = notesM ? htmlText(notesM[1].replace(/<ul id="plainSister"[\s\S]*?<\/ul>/, '')) : '';
    var desc = [];
    if (author) desc.push('Tác giả: ' + author);
    if (translator) desc.push('Dịch: ' + translator.replace(/\s*dịch$/, ''));
    if (year) desc.push('Năm: ' + year);
    if (notes) desc.push('', notes);

    var links = _chapterLinks(html, realTitle);
    var chapters = links.map(function (c, i) {
      return { id: c.title, title: c.label, number: i + 1, url: _pageUrl(c.title) };
    });
    // A short story or poem lives on the root page itself — read it as one chapter.
    if (!chapters.length) {
      chapters = [{ id: realTitle, title: realTitle, number: 1, url: _pageUrl(realTitle) }];
    }

    var genres = ((page && page.categories) || []).map(function (c) {
      return String(c.title).replace(/^[^:]+:/, '');
    }).filter(function (g) {
      // Licence / layout / maintenance categories aren't genres.
      return !/^(\d+%|PVCC|PD|Trang |Tác phẩm|Văn kiện|Tác giả|Bảo quản|Bài |Sách có)/.test(g);
    });

    var detail = {
      id: realTitle, title: realTitle, url: _pageUrl(realTitle),
      cover: (page && page.thumbnail && page.thumbnail.source) || null,
      description: desc.join('\n'), status: 'completed', genres: genres,
      studios: author ? [author] : [], year: year || null,
      type: 'novel', sourceId: SOURCE_ID, chapters: chapters
    };
    if (detail.cover) return detail;
    // Same Wikipedia → title-card fallback the listings use, so the detail
    // page shows the cover the grid showed.
    return _withCovers([{ title: realTitle }]).then(function (r) { detail.cover = r[0].cover; return detail; });
  });
}

function getChapters(url) {
  return getDetail(url).then(function (d) { return d.chapters; });
}

function getText(chapterUrl) {
  var title = _titleFromUrl(chapterUrl);
  return _api({ action: 'parse', page: title, prop: 'text', redirects: '1', disableeditsection: '1' })
    .then(function (j) {
      var html = _cleanHtml(j.parse.text);
      var name = String(j.parse.title || title);
      return { title: name.indexOf('/') > 0 ? name.slice(name.indexOf('/') + 1) : name, html: html };
    });
}
