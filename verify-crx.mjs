import { readFileSync } from 'fs';
const buf = readFileSync('release/md-viewer-v1.0.0.crx');
console.log('Magic:', buf.slice(0, 4).toString());
console.log('Version:', buf.readUInt32LE(4));
console.log('PubKeyLen:', buf.readUInt32LE(8));
console.log('SigLen:', buf.readUInt32LE(12));
console.log('Total size:', (buf.length / 1024).toFixed(2), 'KB');
