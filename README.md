# Biblib

A citation and bibliography generator. Paste a URL, DOI or ISBN (or search by title) and it builds a formatted reference list.

## Run locally

```
npm install
npm start
```

Then open http://localhost:3000. `npm start` builds the browser bundles and runs a small dev server.
To run under Cloudflare's own runtime instead: `npm run build && npx wrangler pages dev public`.

## How it's put together

| Path | What it is |
|---|---|
| `public/` | The site: static HTML, CSS and JS. Built bundles go to `public/vendor/` (not committed). |
| `src/format.js` | Citation formatting (citation-js + official CSL styles from `styles/`), bundled to run in the browser. |
| `src/lookup.js` | DOI / ISBN / web page / title lookups. Needs a server because browsers block cross-site page fetches. |
| `functions/api/lookup.js` | Cloudflare Pages Function that serves `POST /api/lookup` in production. |
| `server.js` | Local dev server (same lookup code). |
| `src/supabase.js`, `public/config.js` | Optional accounts via Supabase. |
| `supabase/schema.sql` | Database table and security rules for accounts. |

## Deploy (Cloudflare Pages)

Connect the GitHub repo in Cloudflare: Workers & Pages → Create → Pages → Connect to Git. Settings:

- Build command: `npm run build`
- Build output directory: `public`

Every push to `main` redeploys.

## Accounts (Supabase)

Without configuration, Biblib runs guest-only: projects are kept in the browser's localStorage. To turn on accounts:

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Put the project URL and anon (public) key in `public/config.js`.
3. In Supabase → Authentication → URL Configuration, set the Site URL to your pages.dev address.

Users can sign up, log in, reset a forgotten password by email, change their password and delete their account. On first login they can move the browser's projects into the account. Projects save automatically. Row-level security ensures each user can only read and change their own projects.

## Features

- **Lookup**: DOIs (via doi.org), ISBNs (Open Library, then Google Books), web pages (citation/OpenGraph/JSON-LD metadata, with DOI detection), and title search (Crossref and Open Library).
- **Styles**: APA 7, MLA 9, Chicago 18 (author-date and notes & bibliography), Harvard (Cite Them Right), IEEE, Vancouver, AMA, ACS. To add a style, drop a `.csl` file in `styles/` and list it in `src/format.js`.
- **Source types**: Website, Book, Journal and Pre-formatted, plus a More menu with artwork, bills, blog posts, TV/radio broadcasts, book chapters, communications, dictionary and encyclopedia entries, films, interviews, legal cases, legislation, magazine and newspaper articles, maps, patents, music scores, songs, speeches and videos. Sources a style leaves out of the reference list (e.g. APA personal communications) appear under "Cited in text only".
- **Projects**: several bibliographies; rename from the sidebar with the pencil icon or by double-clicking.
- **Editing**: per-source form with a live preview, contributor roles, private notes, and missing-field warnings.
- **In-text citations** for every entry.
- **Export**: copy as rich text, or download Word (.doc), HTML, plain text, BibTeX and RIS.
- **Share link**: the whole project travels in the URL fragment, so nothing is uploaded.

## Credits

Citation styles and locale in `styles/` are from the [Citation Style Language](https://github.com/citation-style-language/styles) project, licensed CC BY-SA 3.0.
