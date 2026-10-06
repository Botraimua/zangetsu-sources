// Oglaf — https://www.oglaf.com
// 18+ webcomic (fantasy, adult humour) by Trudy Cooper & Doug Bayne, published
// free by its authors on their own site. Manga source for Zangetsu.
//
// Every story on the archive page is a short comic of one or more pages.
// The whole run is offered as one series ("Oglaf — toàn tập", one chapter per
// story, oldest first); each story can also be opened on its own.

var SOURCE_ID = 'oglaf';
var SITE = 'https://www.oglaf.com';
var UA = 'ZangetsuSources/1.0 (personal reader; https://github.com/Spyou/Zangetsu)';
var PAGE_SIZE = 30;
var SERIES_URL = SITE + '/archive/';

function getInfo() {
  return { name: 'Oglaf (18+)', lang: 'en', baseUrl: SITE,
           logo: 'https://static.oglaf.com/favicon.png', type: 'manga', version: '1.0.0' };
}

// ── helpers ────────────────────────────────────────────────────────────────

function _get(url) {
  return fetch(url, { headers: { 'User-Agent': UA } });
}

function _html(url) {
  return _get(url).then(function (r) {
    if (!r.ok) throw new Error('Oglaf: HTTP ' + r.status);
    return r.body || '';
  });
}

// "fountain-of-doubt" → "Fountain Of Doubt". The archive only has slugs;
// the real title is read from the story page when it's opened.
function _pretty(slug) {
  return String(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function _slug(url) {
  var m = String(url).match(/oglaf\.com\/([^\/?#]+)\//) || String(url).match(/^\/?([^\/?#]+)\/?$/);
  return m ? m[1] : '';
}

// Archive page → [{slug, banner}], newest first. Cached for 10 minutes:
// every listing, search and the series detail read the same page.
var _arch = { at: 0, list: null };

function _archive() {
  if (_arch.list && Date.now() - _arch.at < 600000) return Promise.resolve(_arch.list);
  return _html(SERIES_URL).then(function (html) {
    var re = /<a href="\/([^"\/]+)\/">\s*<img[^>]*src="([^"]*\/archive\/arc-[^"]+)"/g;
    var seen = {}, list = [], m;
    while ((m = re.exec(html)) !== null) {
      if (seen[m[1]]) continue;
      seen[m[1]] = true;
      list.push({ slug: m[1], banner: m[2] });
    }
    _arch = { at: Date.now(), list: list };
    return list;
  });
}

function _storyItem(s) {
  return { id: s.slug, title: _pretty(s.slug), url: SITE + '/' + s.slug + '/', cover: s.banner,
           genres: ['18+', 'Webcomic'], type: 'manga', sourceId: SOURCE_ID };
}

function _seriesItem(list) {
  return { id: 'oglaf-all', title: 'Oglaf — toàn tập', englishTitle: 'Oglaf', url: SERIES_URL,
           cover: list.length ? list[0].banner : null, genres: ['18+', 'Fantasy', 'Comedy', 'Webcomic'],
           status: 'ongoing', type: 'manga', sourceId: SOURCE_ID };
}

function _shuffle(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function _pageOf(list, page) {
  page = page > 0 ? page : 1;
  return list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(_storyItem);
}

// ── catalogue ──────────────────────────────────────────────────────────────

function getHome(opts) {
  return _archive().then(function (list) {
    return [
      { title: 'Đọc trọn bộ', items: [_seriesItem(list)] },
      { title: 'Mới nhất', items: list.slice(0, 100).map(_storyItem) },
      { title: 'Ngẫu nhiên', items: _shuffle(list).slice(0, 60).map(_storyItem) },
      { title: 'Từ đầu', items: list.slice(-100).reverse().map(_storyItem) }
    ];
  });
}

function popular(opts) {
  return _archive().then(function (list) { return _pageOf(list, (opts && opts.page) || 1); });
}

// Zangetsu asks for search page 2, 3… with an EMPTY query, so remember the
// last one and keep paging it.
var _lastQuery = '';

function search(query, page, opts) {
  page = page > 0 ? page : 1;
  var q = String(query || '').trim();
  if (q) _lastQuery = q;
  else if (page > 1) q = _lastQuery;
  return _archive().then(function (list) {
    if (!q || q === '*' || /^(tất cả|all)$/i.test(q)) {
      var out = _pageOf(list, page);
      if (page === 1) out.unshift(_seriesItem(list));
      return out;
    }
    // Slugs drop spaces ("goodideas"), so compare without them.
    var needle = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    return _pageOf(list.filter(function (s) {
      return s.slug.toLowerCase().replace(/[^a-z0-9]/g, '').indexOf(needle) !== -1;
    }), page);
  });
}

// ── detail ─────────────────────────────────────────────────────────────────

function _storyMeta(slug) {
  return _html(SITE + '/' + slug + '/').then(function (html) {
    var t = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    var hover = (html.match(/id="strip"[^>]*title="([^"]*)"/) || html.match(/title="([^"]*)"[^>]*id="strip"/) || [])[1];
    return { title: htmlText(t || _pretty(slug)), hover: hover ? htmlText(hover) : '' };
  });
}

var ABOUT = 'Webcomic 18+ của Trudy Cooper & Doug Bayne — giả tưởng, hài người lớn. ' +
            'Tác giả đăng miễn phí tại oglaf.com; ủng hộ tác giả bằng cách mua sách Oglaf.';

function getDetail(url) {
  var slug = _slug(url);
  if (!slug || slug === 'archive') {
    return _archive().then(function (list) {
      var series = _seriesItem(list);
      var oldestFirst = list.slice().reverse();
      series.description = ABOUT + '\n\n' + oldestFirst.length + ' truyện ngắn, xếp từ cũ đến mới.';
      series.studios = ['Trudy Cooper', 'Doug Bayne'];
      series.isAdult = true;
      series.chapters = oldestFirst.map(function (s, i) {
        return { id: s.slug, title: _pretty(s.slug), number: i + 1, url: SITE + '/' + s.slug + '/' };
      });
      return series;
    });
  }
  return Promise.all([_storyMeta(slug), _archive().catch(function () { return []; })]).then(function (res) {
    var meta = res[0], list = res[1], banner = null;
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) { banner = list[i].banner; break; }
    return {
      id: slug, title: meta.title, url: SITE + '/' + slug + '/', cover: banner,
      description: (meta.hover ? '“' + meta.hover + '”\n\n' : '') + ABOUT,
      status: 'completed', genres: ['18+', 'Webcomic'], studios: ['Trudy Cooper', 'Doug Bayne'],
      isAdult: true, type: 'manga', sourceId: SOURCE_ID,
      chapters: [{ id: slug, title: meta.title, number: 1, url: SITE + '/' + slug + '/' }]
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function (d) { return d.chapters; });
}

// ── pages ──────────────────────────────────────────────────────────────────

function _stripOf(html) {
  var m = html.match(/<img[^>]*id="strip"[^>]*src="([^"]+)"/) || html.match(/<img[^>]*src="([^"]+)"[^>]*id="strip"/);
  return m ? m[1] : null;
}

// Page n of a story lives at /slug/n/ and a missing page is a 404, so probe
// a batch of pages in parallel and stop at the first gap. Sequential
// next-link walking would blow the 15 s call budget on long stories.
var BATCH = 6;

function getPages(chapterUrl) {
  var slug = _slug(chapterUrl);
  if (!slug) return Promise.reject('Oglaf: bad url ' + chapterUrl);
  var pages = [];
  function batch(from) {
    var reqs = [];
    for (var n = from; n < from + BATCH; n++) {
      var url = SITE + '/' + slug + '/' + (n === 1 ? '' : n + '/');
      reqs.push(_get(url).then(function (r) { return r.ok ? _stripOf(r.body || '') : null; },
                               function () { return null; }));
    }
    return Promise.all(reqs).then(function (imgs) {
      for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i]) return pages;
        pages.push({ url: imgs[i] });
      }
      return batch(from + BATCH);
    });
  }
  return batch(1).then(function (p) {
    if (!p.length) throw new Error('Oglaf: không đọc được trang truyện');
    return p;
  });
}
