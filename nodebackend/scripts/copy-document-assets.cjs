const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../documents/Employment Agreement.docx');
const destination = path.resolve(__dirname, '../dist/documents');
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(source, path.join(destination, 'Employment Agreement.docx'));
console.log('Employment agreement template included in dist/documents.');
