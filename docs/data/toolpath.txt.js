// Data loader for toolpaths 
const fs = require('fs');
const fileContents = fs.readFileSync('topCut.txt', 'utf-8');
const lines = fileContents.split('\n');


