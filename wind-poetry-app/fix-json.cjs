const fs = require('fs');
const raw = fs.readFileSync('../data/含风诗歌.json', 'utf8');

let content = raw.trim();
if (content.endsWith(']')) content = content.slice(0, -1).trim();

// Split by blank line pattern, where next line starts with "id"
const parts = content.split(/\r?\n\s*\r?\n\s*(?="id")/);

const results = [];
let errors = 0;
for (let i = 0; i < parts.length; i++) {
  let part = parts[i].trim();
  if (!part.startsWith('{')) part = '{' + part;
  if (!part.endsWith('}')) part = part + '}';
  try {
    results.push(JSON.parse(part));
  } catch (e) {
    errors++;
    if (errors <= 5) console.log('ERR part', i, ':', e.message, '\n  ', part.slice(0, 120));
  }
}

console.log('Total parts:', parts.length);
console.log('Parsed OK:', results.length);
console.log('Errors:', errors);
console.log('Sample:', JSON.stringify(results[0]).slice(0, 200));

fs.writeFileSync('public/data/full_poems.json', JSON.stringify(results), 'utf8');
console.log('Written fixed JSON with', results.length, 'entries');
