const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

const SOURCE_DIR = path.join(__dirname, 'ORG.posts');
const DEST_DIR = path.join(__dirname, 'src/news/posts');

function parseDate(dateText) {
  if (!dateText) return null;
  const parsed = new Date(dateText.trim());
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

async function migrate() {
  await fs.ensureDir(DEST_DIR);
  const files = await fs.readdir(SOURCE_DIR);

  for (const file of files) {
    if (!file.endsWith('.html')) continue;

    const filePath = path.join(SOURCE_DIR, file);
    const html = await fs.readFile(filePath, 'utf8');
    const $ = cheerio.load(html);

    const entryTitle = $('.blog-entry-title').text().trim();
    const fallbackTitle = $('title').text().split('|')[0].trim();
    const title = entryTitle || fallbackTitle || 'Untitled Post';

    const rawDateText = $('.blog-entry-date').text().trim();
    let dateStr = parseDate(rawDateText);

    if (!dateStr) {
      const stat = await fs.stat(filePath);
      dateStr = stat.mtime.toISOString().split('T')[0];
    }

    // Rewrite image paths so relative links point correctly to /news/files/
    $('.blog-entry-body img').each((i, img) => {
      let src = $(img).attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('/')) {
        // Resolve relative paths like ../files/image.png to /news/files/image.png
        const filename = path.basename(src);
        $(img).attr('src', `/news/files/${filename}`);
      }
    });

    let bodyHtml = $('.blog-entry-body').html() || $('#content').html() || '';

    // Convert HTML formatting to Markdown/Clean HTML
    let cleanBody = bodyHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '### $1\n')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim();

    const slug = file.replace('.html', '');
    const markdownContent = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${dateStr}
---

${cleanBody}
`;

    const outputPath = path.join(DEST_DIR, `${dateStr}-${slug}.md`);
    await fs.writeFile(outputPath, markdownContent);
    console.log(`Converted with images: ${file} -> ${dateStr}-${slug}.md`);
  }
}

migrate().catch(console.error);
