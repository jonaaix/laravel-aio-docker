const fs = require('fs');
const path = require('path');

const defaultsDir = '/home/laravel/.claude-defaults/plugins';
const targetDir = '/home/laravel/.claude/plugins';

function readJson(filePath) {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Merge known_marketplaces.json
const defaultMarketplaces = readJson(path.join(defaultsDir, 'known_marketplaces.json')) || {};
const currentMarketplaces = readJson(path.join(targetDir, 'known_marketplaces.json')) || {};

for (const [key, value] of Object.entries(defaultMarketplaces)) {
    if (!currentMarketplaces[key]) {
        currentMarketplaces[key] = value;
    }
}

writeJson(path.join(targetDir, 'known_marketplaces.json'), currentMarketplaces);

// Merge installed_plugins.json
const defaultPlugins = readJson(path.join(defaultsDir, 'installed_plugins.json')) || { version: 2, plugins: {} };
const currentPlugins = readJson(path.join(targetDir, 'installed_plugins.json')) || { version: 2, plugins: {} };

for (const [key, value] of Object.entries(defaultPlugins.plugins)) {
    if (!currentPlugins.plugins[key]) {
        currentPlugins.plugins[key] = value;
    }
}

writeJson(path.join(targetDir, 'installed_plugins.json'), currentPlugins);

// Copy cache files if not present
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

copyDirRecursive(path.join(defaultsDir, 'cache'), path.join(targetDir, 'cache'));

// Copy marketplace repos if not present
copyDirRecursive(path.join(defaultsDir, 'marketplaces'), path.join(targetDir, 'marketplaces'));
