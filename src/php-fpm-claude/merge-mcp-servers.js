const fs = require('fs');

const defaultsPath = '/home/laravel/.claude-defaults/.claude.json';
const currentPath = '/home/laravel/.claude.json';

const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
const defServers = defaults?.projects?.['']?.mcpServers || {};

let current = {};
if (fs.existsSync(currentPath)) {
    current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
}

if (!current.projects) current.projects = {};
if (!current.projects['']) current.projects[''] = {};
if (!current.projects[''].mcpServers) current.projects[''].mcpServers = {};

Object.assign(current.projects[''].mcpServers, defServers);
fs.writeFileSync(currentPath, JSON.stringify(current, null, 2));
