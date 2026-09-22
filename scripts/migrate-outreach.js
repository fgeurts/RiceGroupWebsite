/*
 * migrate-outreach.js
 *
 * Converts the RapidWeaver-generated /outreach tree into Eleventy source files.
 * No external dependencies: run with plain `node scripts/migrate-outreach.js`.
 *
 *   input :  scripts/ORG.outreach/**      (the published RW folder)
 *   output:  src/outreach/**              (.md pages + copied assets)
 *
 * Re-running is safe: it overwrites the generated files.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'ORG.outreach');
const DEST_DIR = path.join(__dirname, '..', 'src', 'outreach');

// RapidWeaver leftovers we do not migrate:
//  - styled/            : an earlier draft of summer2024, not linked from anywhere
//  - photos-2/          : Monoslideshow duplicate of summer2024/photos
//  - files/*-full.html  : one wrapper page per photo; the gallery layout links the JPEG directly
const SKIP_DIRS = ['styled', 'photos-2'];

const ASSET_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];

// <title> in the RW pages is inconsistent (site name repeated, one stale year).
const TITLE_OVERRIDES = {
  'index.html': 'Nuclear & Particle Physics Outreach',
  'quarknet/workshops.html': 'The Rice/UH Greater Houston QuarkNet Center',
  'quarknet/masterclasses.html': 'QuarkNet Masterclasses',
  'quarknet/masterclass2026/index.html': 'QuarkNet Masterclass 2026',
  'quarknet/masterclass2024/masterclass2024/index.html': 'Photos from the 2024 Masterclass',
  'quarknet/summer2023/photos/index.html': 'QuarkNet 2023 Summer Workshop — Photos',
  'quarknet/summer2024/photos/index.html': 'QuarkNet 2024 Summer Workshop — Photos',
  'quarknet/summer2025/photos/index.html': 'QuarkNet 2025 Summer Workshop — Photos'
};

// Pages that lived at .../name.html rather than .../name/ keep that exact URL.
const HTML_PERMALINKS = ['quarknet/workshops.html', 'quarknet/masterclasses.html'];

const SITE_SECTIONS = 'contact|news|people|presentations|publications|local|outreach|resources|rw_common';

/* ------------------------------------------------------------------ helpers */

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function slice(html, startMarker, endMarker) {
  const i = html.indexOf(startMarker);
  if (i < 0) return '';
  const j = html.indexOf(endMarker, i);
  return html.slice(i + startMarker.length, j < 0 ? undefined : j);
}

function pageContent(html) {
  // everything between <div id="content"> and the <div class="clearer"> that follows it
  let c = slice(html, '<div id="content">', '<div class="clearer">').trim();
  return c.replace(/<\/div>\s*$/, '').trim();
}

function pageSidebar(html) {
  const raw = slice(html, '<div id="sidebar">', '<div id="contentContainer">');
  const header = (raw.match(/<h1 class="sideHeader">([\s\S]*?)<\/h1>/) || [, ''])[1].trim();
  let extra = raw.replace(/<h1 class="sideHeader">[\s\S]*?<\/h1>/, '');
  extra = extra.replace(/<\/div>\s*<\/div>\s*$/, '').trim();
  return { header, extra };
}

function pageTitle(html, rel) {
  if (TITLE_OVERRIDES[rel]) return TITLE_OVERRIDES[rel];
  const raw = (html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1];
  const junk = ['Ultrarelativistic Heavy-Ion Physics', 'QuarkNet Rice/UH Center', ''];
  const parts = raw.split('|').map((s) => s.trim()).filter((s) => !junk.includes(s));
  return parts[0] || 'Outreach';
}

/**
 * Turn RapidWeaver's relative URLs into root-relative site URLs.
 * relDir is the page's directory relative to the outreach root, e.g. "quarknet/summer2023".
 */
function rewriteUrls(html, relDir) {
  const base = ['/outreach', relDir].filter(Boolean).join('/');

  return html
    // absolute links back into the same site (only inside attributes, so that
    // URLs that appear as visible text keep reading exactly as they did before)
    .replace(/(src|href)="https?:\/\/(?:geurts|star|heavyions)\.rice\.edu\//g, '$1="/')
    // ../../outreach/... , ../../../contact/... , ../../../resources/... -> /outreach/... etc.
    .replace(new RegExp(`(?:\\.\\./)+(${SITE_SECTIONS})/`, 'g'), '/$1/')
    // sibling asset folders: files/x.jpg, workshops_files/x.png, masterclasses_files/x.png
    .replace(/(src|href)="(?!https?:|\/|#|mailto:)([A-Za-z0-9_.-]*files)\//g, `$1="${base}/$2/`)
    // ./ -> the page itself
    .replace(/(src|href)="\.\/"/g, `$1="${base}/"`)
    .replace(/\?rwcache=\d+/g, '');
}

function yamlString(s) {
  return JSON.stringify(s == null ? '' : String(s));
}

function yamlBlock(key, value, indent = '  ') {
  const lines = String(value).split('\n').map((l) => indent + l.trimEnd());
  return `${key}: |\n${lines.join('\n')}`;
}

/* ------------------------------------------------------ photo album handling */

function parseAlbum(content, relDir) {
  const base = ['/outreach', relDir].filter(Boolean).join('/');
  const albumTitle = (content.match(/<div class="album-title">([\s\S]*?)<\/div>/) || [, ''])[1].trim();
  const albumDescription = (content.match(/<div class="album-description">([\s\S]*?)<\/div>/) || [, ''])[1].trim();

  const thumbSize = (content.match(/class="thumbnail-wrap" style="width:(\d+)px/) || [, '268'])[1];

  const photos = [];
  const re =
    /<a href="files\/([A-Za-z0-9_.-]+)-full\.html"><img src="files\/([A-Za-z0-9_.-]+)-thumb\.jpg" alt="([^"]*)" width="(\d+)" height="(\d+)"\/?><\/a>\s*<p class="thumbnail-caption">([\s\S]*?)<\/p>/g;

  let m;
  while ((m = re.exec(content)) !== null) {
    photos.push({
      full: `${base}/files/${m[1]}-full.jpg`,
      thumb: `${base}/files/${m[2]}-thumb.jpg`,
      alt: m[3],
      width: m[4],
      height: m[5],
      caption: m[6].trim()
    });
  }
  return { albumTitle, albumDescription, thumbSize, photos };
}

function albumFrontMatter(album) {
  const lines = ['album:'];
  for (const p of album.photos) {
    lines.push(`  - thumb: ${yamlString(p.thumb)}`);
    lines.push(`    full: ${yamlString(p.full)}`);
    lines.push(`    width: ${p.width}`);
    lines.push(`    height: ${p.height}`);
    lines.push(`    alt: ${yamlString(p.alt)}`);
    lines.push(`    caption: ${yamlString(p.caption)}`);
  }
  return lines.join('\n');
}

/* -------------------------------------------------------------------- build */

function destForPage(rel) {
  // outreach/index.html                 -> src/outreach/index.md
  // quarknet/workshops.html             -> src/outreach/quarknet/workshops.md   (+ .html permalink)
  // quarknet/summer2023/index.html      -> src/outreach/quarknet/summer2023/index.md
  return path.join(DEST_DIR, rel.replace(/\.html$/, '.md'));
}

function migrate() {
  const files = walk(SOURCE_DIR);
  let pages = 0;
  let assets = 0;
  const report = [];

  for (const file of files) {
    const rel = path.relative(SOURCE_DIR, file).split(path.sep).join('/');
    const ext = path.extname(file).toLowerCase();

    if (ASSET_EXT.includes(ext)) {
      const dest = path.join(DEST_DIR, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
      assets++;
      continue;
    }

    if (ext !== '.html') continue;
    if (/\/files\/[^/]*-full\.html$/.test(rel)) continue; // per-photo wrapper pages

    const html = fs.readFileSync(file, 'utf8');
    const relDir = path.dirname(rel) === '.' ? '' : path.dirname(rel);

    const title = pageTitle(html, rel);
    const rawContent = pageContent(html);
    const content = rewriteUrls(rawContent, relDir);
    const sidebar = pageSidebar(html);

    const fm = [
      'layout: layouts/base.njk',
      `title: ${yamlString(title)}`
    ];

    if (HTML_PERMALINKS.includes(rel)) {
      fm.push(`permalink: ${yamlString('/outreach/' + rel)}`);
    }
    if (sidebar.header) {
      fm.push(`sideHeader: ${yamlString(sidebar.header)}`);
    }
    if (sidebar.extra) {
      fm.push(yamlBlock('sidebarExtra', rewriteUrls(sidebar.extra, relDir)));
    }

    let body = content + '\n';

    if (content.includes('album-wrapper')) {
      const album = parseAlbum(rawContent, relDir);
      fm[0] = 'layout: layouts/gallery.njk';
      fm.push(`albumTitle: ${yamlString(album.albumTitle || title)}`);
      if (album.albumDescription) fm.push(`albumDescription: ${yamlString(album.albumDescription)}`);
      fm.push(`thumbSize: ${album.thumbSize}`);
      fm.push(albumFrontMatter(album));
      body = ''; // the gallery layout renders everything from the front matter
      report.push(`  gallery: ${rel} (${album.photos.length} photos)`);
    }

    const dest = destForPage(rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `---\n${fm.join('\n')}\n---\n\n${body}`, 'utf8');
    pages++;
  }

  console.log(`migrated ${pages} pages and ${assets} assets into src/outreach/`);
  if (report.length) console.log(report.join('\n'));
}

migrate();
