// Citation formatting, bundled for the browser (see `npm run build`).
// Exposes window.BiblibFormat = { styles, format, exportAs }.
import { Cite, plugins } from '@citation-js/core';
import '@citation-js/plugin-csl';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-ris';

import apa from '../styles/apa.csl';
import mla from '../styles/modern-language-association.csl';
import chicagoAd from '../styles/chicago-author-date.csl';
import chicagoNb from '../styles/chicago-notes-bibliography.csl';
import harvard from '../styles/harvard-cite-them-right.csl';
import ieee from '../styles/ieee.csl';
import vancouver from '../styles/nlm-citation-sequence.csl';
import ama from '../styles/american-medical-association.csl';
import acs from '../styles/american-chemical-society.csl';
import localeEnUS from '../styles/locales-en-US.xml';

const STYLES = [
  { id: 'apa', label: 'APA 7th edition', xml: apa },
  { id: 'mla', label: 'MLA 9th edition', xml: mla },
  { id: 'chicago-ad', label: 'Chicago 18th (author-date)', xml: chicagoAd },
  { id: 'chicago-nb', label: 'Chicago 18th (notes & bibliography)', xml: chicagoNb },
  { id: 'harvard', label: 'Harvard (Cite Them Right)', xml: harvard },
  { id: 'ieee', label: 'IEEE', xml: ieee },
  { id: 'vancouver', label: 'Vancouver (NLM)', xml: vancouver },
  { id: 'ama', label: 'AMA 11th edition', xml: ama },
  { id: 'acs', label: 'ACS', xml: acs },
];

const csl = plugins.config.get('@csl');
for (const s of STYLES) csl.styles.add('ck-' + s.id, s.xml);
csl.locales.add('en-US', localeEnUS);
const template = (id) => 'ck-' + (STYLES.some((s) => s.id === id) ? id : 'apa');

const makeCite = (items) => new Cite(items.map((i) => ({ ...i })), { forceType: '@csl/list+object' });

// Returns { entries: [{id, html, intext}], textOnly: [{id, intext}] }.
// textOnly holds sources the style cites in the text but leaves out of the list
// (e.g. APA personal communications, Chicago legal cases).
function format(items, style) {
  if (!items.length) return { entries: [], textOnly: [] };
  const t = template(style);
  const cite = makeCite(items);
  const bib = cite.format('bibliography', { format: 'html', template: t, lang: 'en-US', asEntryArray: true });
  const entries = bib.map(([id, html], idx) => {
    let intext = '';
    try {
      intext = cite.format('citation', { format: 'text', template: t, lang: 'en-US', entry: id }).trim();
      // Each citation is rendered on its own, so numeric styles always say "1"; use the list number.
      if (html.includes('csl-left-margin')) intext = intext.replace(/\b1\b/, String(idx + 1));
    } catch (e) { /* some styles fail on sparse records */ }
    return { id, html: html.trim(), intext };
  });
  const listed = new Set(entries.map((e) => e.id));
  const textOnly = items.filter((i) => !listed.has(i.id)).map((i) => {
    let intext = '';
    try {
      intext = cite.format('citation', { format: 'html', template: t, lang: 'en-US', entry: i.id }).trim();
    } catch (e) { /* leave blank */ }
    return { id: i.id, intext };
  });
  return { entries, textOnly };
}

function exportAs(items, fmt) {
  if (fmt !== 'bibtex' && fmt !== 'ris') throw new Error('Unknown export format');
  return makeCite(items).format(fmt);
}

window.BiblibFormat = {
  styles: STYLES.map(({ id, label }) => ({ id, label })),
  format,
  exportAs,
};
