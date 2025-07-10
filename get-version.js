#!/usr/bin/env node
const pkg = require('./frontend/package.json');
process.stdout.write(pkg.version); 