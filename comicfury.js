// ComicFury — https://comicfury.com
// Manga source for Zangetsu: adult (18+/21+) webcomics that their own
// creators publish free on ComicFury's hosting. Only titles whose creators
// flagged sexual content are listed; anything tagged as involving minors is
// refused when opened.

var SOURCE_ID = 'comicfury';
var SITE = 'https://comicfury.com';
var UA = 'ZangetsuSources/1.0 (personal reader; https://github.com/Spyou/Zangetsu)';
// Minors, and the school settings that usually mean minors in sexual content.
var BLOCKED = /\b(loli|lolicon|shota|shotacon|cub|underage|under ?age|minor|minors|child|children|kid|kids|toddler|teen|teens|teenager|preteen|jailbait|high ?school|middle ?school|junior ?high|school ?girls?|school ?boys?|schoolgirls?|schoolboys?)\b/i;

function getInfo() {
  return { name: 'ComicFury 18+', lang: 'en', baseUrl: SITE,
           logo: SITE + '/images/cf-diamond.png', type: 'manga', version: '1.1.0' };
}

function getSettings() {
  return [
    { key: 'level', label: 'Mức nội dung', type: 'enum', default: '2', options: [
      { value: '2', label: 'Chỉ nội dung tình dục mạnh (21+)' },
      { value: '1', label: 'Có cảnh nóng trở lên (18+)' }
    ] },
    { key: 'minPages', label: 'Ẩn truyện quá ngắn', type: 'enum', default: '10', options: [
      { value: '0', label: 'Không ẩn' },
      { value: '10', label: 'Dưới 10 trang' },
      { value: '30', label: 'Dưới 30 trang' }
    ] }
  ];
}

// ── helpers ────────────────────────────────────────────────────────────────

function _setting(key, dflt) {
  try {
    var mine = (globalThis.__settings || {})[typeof __SOURCE_ID !== 'undefined' ? __SOURCE_ID : SOURCE_ID] || {};
    return mine[key] != null && mine[key] !== '' ? mine[key] : dflt;
  } catch (e) { return dflt; }
}

function _html(url) {
  return fetch(url, { headers: { 'User-Agent': UA } }).then(function (r) {
    if (!r.ok) throw new Error('ComicFury: HTTP ' + r.status);
    return r.body || '';
  });
}

function _slug(url) {
  var s = String(url);
  var m = s.match(/[?&]url=([a-z0-9_-]+)/i) || s.match(/\/\/([a-z0-9_-]+)\.thecomicseries\.com/i);
  return m ? m[1].toLowerCase() : '';
}

function _site(slug) { return 'https://' + slug + '.thecomicseries.com'; }
function _profile(slug) { return SITE + '/comicprofile.php?url=' + slug; }

// ── search results ─────────────────────────────────────────────────────────

// One page of ComicFury search (30 results), parsed and filtered to the
// sexual-content level and length chosen in settings.
function _searchPage(query, sort, page, extra) {
  var url = SITE + '/search.php?vr=1&combinedquery=' + encodeURIComponent(query) +
            '&sort=' + sort + '&fs=2&fn=2&fv=2&fl=2' + (extra || '') + (page > 1 ? '&page=' + page : '');
  return _html(url).then(function (html) {
    var level = parseInt(_setting('level', '2'), 10);
    var minPages = parseInt(_setting('minPages', '10'), 10);
    var blocks = html.split('class="webcomic-result"').slice(1);
    var items = [];
    blocks.forEach(function (b) {
      var slug = (b.match(/comicprofile\.php\?url=([a-z0-9_-]+)/i) || [])[1];
      if (!slug) return;
      var title = htmlText((b.match(/webcomic-result-title" title="([^"]*)"/) || [])[1] || slug);
      var s = /images\/s2\.png/.test(b) ? 2 : /images\/s1\.png/.test(b) ? 1 : 0;
      var pages = parseInt((b.match(/stat-value">(\d+)/) || [])[1] || '0', 10);
      if (s < level || pages < minPages || BLOCKED.test(title)) return;
      var avatar = (b.match(/<img src="([^"]*comicavatars[^"]+)"/) || [])[1];
      items.push({ id: slug, title: title, url: _profile(slug),
                   cover: avatar ? (avatar.charAt(0) === '/' ? SITE + avatar : avatar) : null,
                   dubBadge: s === 2 ? '21+' : '18+', genres: [pages + ' trang'],
                   type: 'manga', sourceId: SOURCE_ID });
    });
    return { items: items, raw: blocks.length };
  });
}

// ── catalogue ──────────────────────────────────────────────────────────────

var SORT_RELEVANCE = 0, SORT_POPULAR = 1, SORT_UPDATED = 2;

// `pages`: result pages (30 titles each) per row. The first rows get two;
// the genre rows one, so the whole home stays inside the time budget.
var SHELVES = [
  { title: 'Phổ biến', q: '#nsfw', sort: SORT_POPULAR, pages: 2 },
  { title: 'Mới cập nhật', q: '#nsfw', sort: SORT_UPDATED, pages: 2 },
  { title: 'Đã hoàn thành', q: '#nsfw', sort: SORT_POPULAR, pages: 1, extra: '&lastupdate=4' },
  { title: 'Tình cảm', q: '#nsfw #romance', sort: SORT_POPULAR, pages: 2 },
  { title: 'Giả tưởng', q: '#nsfw #fantasy', sort: SORT_POPULAR, pages: 2 },
  { title: 'Hài hước', q: '#nsfw #comedy', sort: SORT_POPULAR, pages: 1 },
  { title: 'Chính kịch', q: '#nsfw #drama', sort: SORT_POPULAR, pages: 1 },
  { title: 'Hành động', q: '#nsfw #action', sort: SORT_POPULAR, pages: 1 },
  { title: 'Phiêu lưu', q: '#nsfw #adventure', sort: SORT_POPULAR, pages: 1 },
  { title: 'Kinh dị', q: '#nsfw #horror', sort: SORT_POPULAR, pages: 1 },
  { title: 'Khoa học viễn tưởng', q: '#nsfw #scifi', sort: SORT_POPULAR, pages: 1 },
  { title: 'Quái vật', q: '#nsfw #monster', sort: SORT_POPULAR, pages: 1 },
  { title: 'Ác quỷ', q: '#nsfw #demon', sort: SORT_POPULAR, pages: 1 },
  { title: 'BDSM', q: '#bdsm', sort: SORT_POPULAR, pages: 1 },
  { title: 'Smut', q: '#smut', sort: SORT_POPULAR, pages: 1 },
  { title: 'Erotic', q: '#erotic', sort: SORT_POPULAR, pages: 1 },
  { title: 'Hentai', q: '#hentai', sort: SORT_POPULAR, pages: 1 },
  { title: 'Boys\' Love', q: '#yaoi', sort: SORT_POPULAR, pages: 1 },
  { title: 'Gay', q: '#nsfw #gay', sort: SORT_POPULAR, pages: 1 },
  { title: 'Girls\' Love', q: '#yuri', sort: SORT_POPULAR, pages: 1 },
  { title: 'Lesbian', q: '#nsfw #lesbian', sort: SORT_POPULAR, pages: 1 },
  { title: 'LGBT', q: '#nsfw #lgbt', sort: SORT_POPULAR, pages: 1 },
  { title: 'Furry', q: '#nsfw #furry', sort: SORT_POPULAR, pages: 1 }
];

// Zangetsu shows a JS source's home rows as-is (no "see all"). Five rows
// at a time, cut off after 20 s so the app's 30 s getHome timeout never
// discards finished rows.
function getHome(opts) {
  var deadline = Date.now() + 20000;
  var rows = new Array(SHELVES.length), next = 0;
  function row(s) {
    return _searchPage(s.q, s.sort, 1, s.extra).then(function (a) {
      if (s.pages < 2 || a.raw < 30) return a.items;
      return _searchPage(s.q, s.sort, 2, s.extra).then(function (b) { return a.items.concat(b.items); },
                                                       function () { return a.items; });
    });
  }
  function worker() {
    if (next >= SHELVES.length || Date.now() > deadline) return Promise.resolve();
    var i = next++;
    return row(SHELVES[i]).then(function (items) {
      var seen = {};
      rows[i] = { title: SHELVES[i].title, items: items.filter(function (it) {
        if (seen[it.id]) return false; seen[it.id] = true; return true;
      }) };
    }, function () {}).then(worker);
  }
  return Promise.all([worker(), worker(), worker(), worker(), worker()]).then(function () {
    var out = rows.filter(function (r) { return r && r.items.length; });
    if (!out.length) throw new Error('ComicFury: không tải được danh sách');
    return out;
  });
}

function popular(opts) {
  return search('*', (opts && opts.page) || 1, opts);
}

// Zangetsu asks for search page 2, 3… with an EMPTY query, and stops at the
// first empty page. Filtering can empty a whole ComicFury page, so keep a
// cursor: each app page pulls site pages until it has something to show.
var _cur = { q: '', sitePage: 1 };

function search(query, page, opts) {
  page = page > 0 ? page : 1;
  var q = String(query || '').trim();
  if (q) _cur.q = q;
  else if (page > 1) q = _cur.q;
  if (page === 1) _cur.sitePage = 1;
  var sort = SORT_RELEVANCE, cq = q;
  // "*" (or "tất cả") = every adult-flagged title, most popular first.
  if (!q || q === '*' || /^(tất cả|all)$/i.test(q)) { cq = '#nsfw'; sort = SORT_POPULAR; }
  function pull(tries) {
    var sp = _cur.sitePage++;
    return _searchPage(cq, sort, sp).then(function (r) {
      if (r.items.length || r.raw === 0 || tries <= 1) return r.items;
      return pull(tries - 1);
    });
  }
  return pull(4);
}

// ── detail ─────────────────────────────────────────────────────────────────

function _info(html, name) {
  var re = new RegExp('<span class="infoname">' + name + ':</span>\\s*<span class="info">([\\s\\S]*?)</span>');
  var m = html.match(re);
  return m ? htmlText(m[1]) : '';
}

// Chapters from the comic's archive. Layouts differ ("chapter-…" or
// "nl-chapter-…") but every chapter has an <h3> linking its first page
// followed by an /archive/<id> "comics in this chapter" link.
function _chaptersFrom(html, slug) {
  var re = /<h3>\s*<a href="\/comics\/(\d+)\/?">([\s\S]*?)<\/a>\s*<\/h3>[\s\S]{0,800}?href="\/archive\/(\d+)"/g;
  var list = [], m;
  while ((m = re.exec(html)) !== null) {
    list.push({ first: parseInt(m[1], 10), title: htmlText(m[2]) || ('Chương ' + (list.length + 1)), id: m[3] });
  }
  list.sort(function (a, b) { return a.first - b.first; });
  if (list.length) {
    return list.map(function (c, i) {
      return { id: slug + '-' + c.id, title: c.title, number: i + 1, url: _site(slug) + '/archive/' + c.id };
    });
  }
  // No chapters: the archive lists pages directly — split into parts of 40.
  var pages = _pageLinks(html);
  var out = [];
  for (var i = 0; i < pages.length; i += 40) {
    var n = out.length + 1;
    out.push({ id: slug + '-p' + n, title: 'Phần ' + n + ' (trang ' + (i + 1) + '–' + Math.min(i + 40, pages.length) + ')',
               number: n, url: _site(slug) + '/archive/#part=' + (n - 1) });
  }
  return out;
}

function _pageLinks(html) {
  var re = /<a [^>]*class="[^"]*archivecomictitle[^"]*"[^>]*>/g, out = [], seen = {}, m;
  while ((m = re.exec(html)) !== null) {
    var href = (m[0].match(/href="([^"]+)"/) || [])[1];
    if (href && !seen[href]) { seen[href] = true; out.push(href); }
  }
  return out;
}

function getDetail(url) {
  var slug = _slug(url);
  if (!slug) return Promise.reject('ComicFury: bad url ' + url);
  return Promise.all([_html(_profile(slug)), _html(_site(slug) + '/archive/')]).then(function (res) {
    var p = res[0], archive = res[1];
    var title = htmlText((p.match(/<div class="authorname">\s*([\s\S]*?)<br/) || [])[1] || slug);
    var tagline = htmlText((p.match(/<\/div>\s*<em>([\s\S]*?)<\/em>/) || [])[1] || '');
    var desc = (p.match(/Webcomic description<\/h2>\s*<div class="pccontent">([\s\S]*?)(<div class="description-tags">|<\/div>)/) || [])[1] || '';
    desc = htmlText(desc.replace(/<br\s*\/?>/gi, '\n')).trim();
    var tags = [], tm, tre = /class="webcomic-profile-tag">([^<]+)</g;
    while ((tm = tre.exec(p)) !== null) tags.push(htmlText(tm[1]));
    if (tags.some(function (t) { return BLOCKED.test(t); }) || BLOCKED.test(title)) {
      throw new Error('ComicFury: truyện này bị bộ lọc nội dung chặn');
    }
    var authors = [], am, are = /class="authorname">([^<]+)<\/a>/g;
    while ((am = are.exec(p)) !== null) if (authors.indexOf(am[1]) === -1) authors.push(htmlText(am[1]));
    var avatar = (p.match(/<img src="([^"]*comicavatars[^"]+)"/) || [])[1];
    var status = /^Completed/i.test(_info(p, 'Activity status')) ? 'completed' : 'ongoing';
    var head = [];
    if (tagline) head.push(tagline);
    if (authors.length) head.push('Tác giả: ' + authors.join(', '));
    var count = _info(p, 'Number of comics');
    if (count) head.push('Số trang: ' + count);
    head.push('Đọc miễn phí do tác giả đăng trên ComicFury — ủng hộ tác giả tại trang truyện.');
    return {
      id: slug, title: title, url: _profile(slug),
      cover: avatar ? (avatar.charAt(0) === '/' ? SITE + avatar : avatar) : null,
      description: head.join('\n') + (desc ? '\n\n' + desc : ''),
      status: status, genres: tags.slice(0, 12), studios: authors, isAdult: true,
      type: 'manga', sourceId: SOURCE_ID, chapters: _chaptersFrom(archive, slug)
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function (d) { return d.chapters; });
}

// ── pages ──────────────────────────────────────────────────────────────────

function _imagesOf(html) {
  var out = [], re = /<img[^>]*(?:id="comicimage"|class="[^"]*comicsegmentimage[^"]*")[^>]*>/g, m;
  while ((m = re.exec(html)) !== null) {
    var src = (m[0].match(/src="([^"]+)"/) || [])[1];
    if (src) out.push(src);
  }
  return out;
}

// Every comic page is its own HTML page, so fetch them ten at a time.
var BATCH = 10;

function getPages(chapterUrl) {
  var slug = _slug(chapterUrl);
  var base = _site(slug);
  var part = String(chapterUrl).match(/#part=(\d+)/);
  var listUrl = part ? base + '/archive/' : String(chapterUrl).replace(/#.*$/, '');
  return _html(listUrl).then(function (html) {
    var links = _pageLinks(html);
    if (part) links = links.slice(parseInt(part[1], 10) * 40, parseInt(part[1], 10) * 40 + 40);
    if (!links.length) throw new Error('ComicFury: chương trống');
    var results = new Array(links.length);
    function batch(from) {
      if (from >= links.length) return Promise.resolve();
      var reqs = [];
      for (var i = from; i < Math.min(from + BATCH, links.length); i++) {
        (function (idx) {
          var u = links[idx].charAt(0) === '/' ? base + links[idx] : links[idx];
          reqs.push(_html(u).then(function (h) { results[idx] = _imagesOf(h); },
                                  function () { results[idx] = []; }));
        })(i);
      }
      return Promise.all(reqs).then(function () { return batch(from + BATCH); });
    }
    return batch(0).then(function () {
      var pages = [];
      results.forEach(function (imgs) { (imgs || []).forEach(function (u) { pages.push({ url: u }); }); });
      if (!pages.length) throw new Error('ComicFury: không đọc được ảnh');
      return pages;
    });
  });
}
