// Source lookup: DOI, ISBN, web page metadata, and title search.
// Shared by the Cloudflare Pages Function (functions/api/lookup.js) and the local dev server.
import { load as cheerioLoad } from 'cheerio/slim';

const UA = 'Biblib/0.1 (citation generator)';

async function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

const today = () => {
  const d = new Date();
  return { 'date-parts': [[d.getFullYear(), d.getMonth() + 1, d.getDate()]] };
};

function parseDate(str) {
  if (!str) return undefined;
  const m = String(str).match(/(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?/);
  if (m) return { 'date-parts': [[+m[1], m[2] && +m[2], m[3] && +m[3]].filter(Boolean)] };
  const d = new Date(str);
  if (!isNaN(d)) return { 'date-parts': [[d.getFullYear(), d.getMonth() + 1, d.getDate()]] };
  const y = String(str).match(/\b(1[5-9]\d\d|20\d\d)\b/);
  return y ? { 'date-parts': [[+y[1]]] } : undefined;
}

function parseName(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  // Organisations and group bylines ("Contributors to Wikimedia projects", "BBC News Staff") stay whole.
  if (/\b(contributors|staff|team|editors|editorial|news|press|inc|ltd|llc|university|association|foundation|organization|organisation|department|agency|institute|society)\b/i.test(name)
    || name.split(' ').length > 4) return { literal: name };
  if (name.includes(',')) {
    const [family, given] = name.split(',').map((x) => x.trim());
    return { family, given };
  }
  const parts = name.split(' ');
  if (parts.length === 1) return { literal: name };
  return { family: parts.pop(), given: parts.join(' ') };
}

const uniqNames = (names) => {
  const seen = new Set();
  return names.filter((n) => {
    if (!n) return false;
    const k = JSON.stringify(n).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const newId = () => 'i' + Math.random().toString(36).slice(2, 10);

// ---------- Lookups ----------
const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+)/i;

async function lookupDOI(doi) {
  doi = doi.replace(/[.,;)\]]+$/, '');
  const r = await fetchWithTimeout('https://doi.org/' + encodeURIComponent(doi).replace(/%2F/g, '/'), {
    headers: { Accept: 'application/vnd.citationstyles.csl+json' },
  });
  if (!r.ok) throw new Error('DOI not found: ' + doi);
  const raw = await r.json();
  const KEEP = ['type', 'title', 'author', 'editor', 'issued', 'container-title', 'volume', 'issue', 'page',
    'publisher', 'publisher-place', 'DOI', 'ISBN', 'ISSN', 'URL', 'edition', 'genre', 'number', 'collection-title', 'event-title'];
  const item = {};
  for (const k of KEEP) if (raw[k] !== undefined) item[k] = raw[k];
  if (!item.issued) item.issued = raw['published-print'] || raw['published-online'] || raw.published || raw.created;
  if (item.issued) item.issued = { 'date-parts': item.issued['date-parts'] };
  if (Array.isArray(item.ISBN)) item.ISBN = item.ISBN[0];
  if (Array.isArray(item.ISSN)) item.ISSN = item.ISSN[0];
  for (const k of ['author', 'editor']) {
    if (item[k]) item[k] = item[k].map(({ given, family, literal, name }) => (family ? { given, family } : { literal: literal || name })).filter((a) => a.family || a.literal);
  }
  if (Array.isArray(item['container-title'])) item['container-title'] = item['container-title'][0];
  if (Array.isArray(item.title)) item.title = item.title[0];
  // doi.org sometimes returns Crossref type names ("journal-article") instead of CSL ones.
  if (CROSSREF_TYPES[item.type]) item.type = CROSSREF_TYPES[item.type];
  item.id = newId();
  return item;
}

function cleanIsbn(q) {
  const s = q.replace(/^isbn[:\s]*/i, '').replace(/[\s-]/g, '');
  return /^(\d{9}[\dX]|\d{13})$/i.test(s) ? s.toUpperCase() : null;
}

async function lookupISBN(isbn) {
  try {
    const r = await fetchWithTimeout(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const data = await r.json();
    const b = data['ISBN:' + isbn];
    if (b) {
      return {
        id: newId(),
        type: 'book',
        title: b.subtitle ? `${b.title}: ${b.subtitle}` : b.title,
        author: (b.authors || []).map((a) => parseName(a.name)).filter(Boolean),
        publisher: b.publishers && b.publishers[0] && b.publishers[0].name,
        'publisher-place': b.publish_places && b.publish_places[0] && b.publish_places[0].name,
        issued: parseDate(b.publish_date),
        'number-of-pages': b.number_of_pages,
        ISBN: isbn,
      };
    }
  } catch (e) { /* fall through to Google Books */ }
  const r = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  const data = await r.json();
  const v = data.items && data.items[0] && data.items[0].volumeInfo;
  if (!v) throw new Error('No book found for ISBN ' + isbn);
  return googleBookToCsl(v, isbn);
}

function googleBookToCsl(v, isbn) {
  return {
    id: newId(),
    type: 'book',
    title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
    author: (v.authors || []).map(parseName).filter(Boolean),
    publisher: v.publisher,
    issued: parseDate(v.publishedDate),
    ISBN: isbn || ((v.industryIdentifiers || []).find((x) => x.type === 'ISBN_13') || {}).identifier,
  };
}

function metaAll($, names) {
  const out = [];
  for (const n of names) {
    $(`meta[name="${n}"], meta[property="${n}"], meta[itemprop="${n}"]`).each((_, el) => {
      const c = $(el).attr('content');
      if (c && c.trim()) out.push(c.trim());
    });
  }
  return out;
}
const meta1 = ($, names) => metaAll($, names)[0];

function jsonLd($) {
  const nodes = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).contents().text());
      const walk = (x) => {
        if (Array.isArray(x)) x.forEach(walk);
        else if (x && typeof x === 'object') {
          nodes.push(x);
          if (x['@graph']) walk(x['@graph']);
        }
      };
      walk(j);
    } catch (e) { /* ignore bad JSON-LD */ }
  });
  const want = /Article|BlogPosting|Report|WebPage|VideoObject|Book|ScholarlyArticle/;
  return nodes.find((n) => want.test([].concat(n['@type'] || []).join(' '))) || {};
}

async function lookupURL(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const r = await fetchWithTimeout(url, { redirect: 'follow', headers: { Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8' } });
  if (!r.ok) throw new Error(`Could not load page (HTTP ${r.status})`);
  const finalUrl = r.url || url;
  const host = new URL(finalUrl).hostname.replace(/^www\./, '');
  const ctype = r.headers.get('content-type') || '';

  if (ctype.includes('pdf')) {
    const file = decodeURIComponent(new URL(finalUrl).pathname.split('/').pop() || 'Document').replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
    return { id: newId(), type: 'report', title: file, publisher: host, URL: finalUrl, accessed: today(), medium: 'PDF' };
  }

  const $ = cheerioLoad(await r.text());

  // Scholarly pages often expose a DOI — use the authoritative record if so.
  const doi = meta1($, ['citation_doi', 'dc.identifier', 'DC.identifier', 'prism.doi']);
  const doiMatch = doi && doi.match(DOI_RE);
  if (doiMatch) {
    try {
      const item = await lookupDOI(doiMatch[1]);
      item.URL = item.URL || finalUrl;
      return item;
    } catch (e) { /* fall back to scraping */ }
  }

  const ld = jsonLd($);
  const ldAuthors = [].concat(ld.author || []).map((a) => (typeof a === 'string' ? a : a && a.name)).filter(Boolean);
  const authorNames = metaAll($, ['citation_author', 'dc.creator', 'DC.creator']);
  const fallbackAuthors = authorNames.length ? [] : metaAll($, ['author', 'article:author', 'parsely-author', 'sailthru.author']).filter((a) => !/^https?:/.test(a));
  const author = uniqNames([...authorNames, ...(authorNames.length ? [] : ldAuthors), ...fallbackAuthors].map(parseName));

  const journal = meta1($, ['citation_journal_title', 'prism.publicationName']);
  const ogType = meta1($, ['og:type']) || '';
  const isVideo = /video/.test(ogType) || /youtube\.com|youtu\.be|vimeo\.com/.test(host) || /VideoObject/.test([].concat(ld['@type'] || []).join());
  const siteName = meta1($, ['og:site_name', 'application-name']) || (ld.publisher && ld.publisher.name) || host;
  let title = meta1($, ['citation_title', 'dc.title', 'DC.title', 'og:title', 'twitter:title']) || ld.headline || ld.name || $('title').first().text().trim();
  // Drop a trailing " | Site name" / " - Wikipedia" suffix when it names the site.
  if (title) {
    const m = title.match(/^(.+?)\s+[|\-–—·]\s+([^|\-–—·]{2,60})$/);
    const hostWord = host.split('.').slice(-2, -1)[0] || '';
    if (m) {
      const tail = m[2].trim().toLowerCase().replace(/^the\s+/, '');
      const site = String(siteName || '').toLowerCase().replace(/^the\s+/, '');
      if (tail === site || tail.replace(/\s+/g, '') === hostWord.toLowerCase() || site.includes(tail)) title = m[1].trim();
    }
  }

  const item = {
    id: newId(),
    type: journal ? 'article-journal'
      : isVideo ? 'motion_picture'
      : meta1($, ['citation_title']) ? 'article' // preprints and repository records (arXiv, SSRN…)
      : /article/.test(ogType) || /NewsArticle/.test([].concat(ld['@type'] || []).join()) ? 'article-newspaper'
      : 'webpage',
    title,
    author,
    issued: parseDate(meta1($, ['citation_publication_date', 'citation_date', 'article:published_time', 'dc.date', 'DC.date', 'date', 'datePublished', 'uploadDate']) || ld.datePublished || ld.uploadDate || $('time[datetime]').first().attr('datetime')),
    'container-title': journal || siteName,
    publisher: meta1($, ['citation_publisher', 'dc.publisher']),
    volume: meta1($, ['citation_volume']),
    issue: meta1($, ['citation_issue']),
    page: [meta1($, ['citation_firstpage']), meta1($, ['citation_lastpage'])].filter(Boolean).join('-') || undefined,
    URL: meta1($, ['og:url']) && /^https?:/.test(meta1($, ['og:url'])) ? meta1($, ['og:url']) : finalUrl,
    accessed: today(),
  };
  if (isVideo) {
    item.medium = 'Video';
    // Video pages rarely carry an author meta tag; the uploader/channel is the conventional "author".
    const channel = $('[itemprop="author"] [itemprop="name"]').attr('content') || $('link[itemprop="name"]').attr('content');
    if (!item.author.length && channel) item.author = [{ literal: channel }];
  }
  // A webpage whose site name is the only "container" reads better without a duplicate publisher.
  if (item.type === 'webpage' && !item.publisher) delete item.publisher;
  return item;
}

const CROSSREF_TYPES = {
  'journal-article': 'article-journal', book: 'book', monograph: 'book', 'edited-book': 'book',
  'book-chapter': 'chapter', 'proceedings-article': 'paper-conference', report: 'report',
  dissertation: 'thesis', 'posted-content': 'article', dataset: 'dataset',
};

async function searchTitle(q) {
  const results = [];
  const tasks = [
    fetchWithTimeout(`https://api.crossref.org/works?rows=5&query.bibliographic=${encodeURIComponent(q)}&select=DOI,title,author,issued,container-title,volume,issue,page,publisher,type,ISBN`)
      .then((r) => r.json())
      .then((j) => {
        for (const w of (j.message && j.message.items) || []) {
          results.push({
            source: 'Crossref',
            item: {
              id: newId(),
              type: CROSSREF_TYPES[w.type] || 'article',
              title: (w.title || [])[0],
              author: (w.author || []).map((a) => (a.family ? { family: a.family, given: a.given } : { literal: a.name })).filter((a) => a.family || a.literal),
              issued: w.issued && w.issued['date-parts'] && w.issued['date-parts'][0][0] ? { 'date-parts': w.issued['date-parts'] } : undefined,
              'container-title': (w['container-title'] || [])[0],
              volume: w.volume, issue: w.issue, page: w.page, publisher: w.publisher, DOI: w.DOI,
              ISBN: (w.ISBN || [])[0],
            },
          });
        }
      }),
    fetchWithTimeout(`https://openlibrary.org/search.json?limit=5&fields=title,subtitle,author_name,first_publish_year,publisher,isbn&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((j) => {
        for (const d of j.docs || []) {
          results.push({
            source: 'Open Library',
            item: {
              id: newId(),
              type: 'book',
              title: d.subtitle ? `${d.title}: ${d.subtitle}` : d.title,
              author: (d.author_name || []).slice(0, 6).map(parseName).filter(Boolean),
              issued: d.first_publish_year ? { 'date-parts': [[d.first_publish_year]] } : undefined,
              publisher: (d.publisher || [])[0],
              ISBN: (d.isbn || []).find((x) => x.length === 13) || (d.isbn || [])[0],
            },
          });
        }
      }),
  ];
  await Promise.allSettled(tasks);
  // Interleave the two sources so books and articles both show near the top.
  const cr = results.filter((r) => r.source === 'Crossref');
  const ol = results.filter((r) => r.source === 'Open Library');
  const mixed = [];
  for (let i = 0; i < Math.max(cr.length, ol.length); i++) {
    if (cr[i]) mixed.push(cr[i]);
    if (ol[i]) mixed.push(ol[i]);
  }
  return mixed.filter((r) => r.item.title);
}

function stripEmpty(item) {
  const out = {};
  for (const [k, v] of Object.entries(item)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out;
}

// Returns { results: [{ source, item }] } or throws with a user-facing message.
export async function lookup(query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Enter a URL, DOI, ISBN or title.');
  const doi = q.match(DOI_RE);
  const isbn = cleanIsbn(q);
  let results;
  try {
    if (doi && !/^https?:\/\/(?!(dx\.)?doi\.org)/i.test(q)) results = [{ source: 'DOI', item: await lookupDOI(doi[1]) }];
    else if (isbn) results = [{ source: 'ISBN', item: await lookupISBN(isbn) }];
    else if (/^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q)) results = [{ source: 'Website', item: await lookupURL(q) }];
    else results = await searchTitle(q);
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'The lookup timed out.' : e.message);
  }
  return { results: results.map((r) => ({ ...r, item: stripEmpty(r.item) })) };
}
