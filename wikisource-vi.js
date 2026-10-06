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
           type: 'novel', version: '1.0.0' };
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

function _api(params) {
  params.format = 'json';
  params.formatversion = '2';
  return fetch(API + '?' + _qs(params), { headers: { 'User-Agent': UA } })
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
    if (seen[t]) continue;
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

// One batched pageimages call per listing. Most works have no image; those
// keep cover:null and the app draws its placeholder.
function _withCovers(items) {
  if (!items.length) return items;
  return _api({ action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '300',
                pilimit: '50', titles: items.map(function (i) { return i.title; }).join('|') })
    .then(function (j) {
      var byTitle = {};
      var pages = (j && j.query && j.query.pages) || [];
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].thumbnail) byTitle[pages[i].title] = pages[i].thumbnail.source;
      }
      items.forEach(function (it) { if (byTitle[it.title]) it.cover = byTitle[it.title]; });
      return items;
    }, function () { return items; });
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
  return Promise.all(SHELVES.map(function (s) {
    return _searchPage('incategory:"' + s.cat + '"', 1)
      .then(function (items) { return { title: s.title, items: items }; },
            function () { return { title: s.title, items: [] }; });
  })).then(function (rows) {
    return rows.filter(function (r) { return r.items.length > 0; });
  });
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

    return {
      id: realTitle, title: realTitle, url: _pageUrl(realTitle),
      cover: (page && page.thumbnail && page.thumbnail.source) || null,
      description: desc.join('\n'), status: 'completed', genres: genres,
      studios: author ? [author] : [], year: year || null,
      type: 'novel', sourceId: SOURCE_ID, chapters: chapters
    };
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
