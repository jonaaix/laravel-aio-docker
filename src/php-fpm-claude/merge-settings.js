// Seed/merge ~/.claude/settings.json from the image defaults without clobbering
// user customizations (permission allowlists, hooks, model, statusline, ...).
//
// - No settings.json yet (fresh volume): copy the defaults verbatim.
// - settings.json exists: enforce only the keys the container needs to operate
//   (permissions.defaultMode, skipDangerousModePermissionPrompt); leave everything
//   else untouched.
// - settings.json is corrupt: back it up to settings.json.bak and reseed the defaults.

const fs = require('fs');

const defaultsPath = '/opt/claude-defaults/settings.json';
const targetPath = '/home/laravel/.claude/settings.json';
const backupPath = targetPath + '.bak';

const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));

function seedDefaults() {
    fs.writeFileSync(targetPath, JSON.stringify(defaults, null, 2) + '\n');
}

if (!fs.existsSync(targetPath)) {
    seedDefaults();
    console.log('Seeded Claude settings.json from image defaults');
    process.exit(0);
}

let current;
try {
    current = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
        throw new Error('settings.json root is not an object');
    }
} catch (e) {
    fs.copyFileSync(targetPath, backupPath);
    seedDefaults();
    console.log(`WARNING: settings.json was invalid (${e.message}) — backed up to ${backupPath} and reseeded defaults`);
    process.exit(0);
}

let changed = false;

const defaultMode = defaults?.permissions?.defaultMode;
if (defaultMode !== undefined) {
    if (current.permissions === null || typeof current.permissions !== 'object' || Array.isArray(current.permissions)) {
        current.permissions = {};
    }
    if (current.permissions.defaultMode !== defaultMode) {
        current.permissions.defaultMode = defaultMode;
        changed = true;
    }
}

if (defaults.skipDangerousModePermissionPrompt !== undefined
    && current.skipDangerousModePermissionPrompt !== defaults.skipDangerousModePermissionPrompt) {
    current.skipDangerousModePermissionPrompt = defaults.skipDangerousModePermissionPrompt;
    changed = true;
}

// Seed-if-missing (never enforced): remote control stays off by default, but a user
// who deliberately sets disableRemoteControl keeps their choice across boots.
if (defaults.disableRemoteControl !== undefined && current.disableRemoteControl === undefined) {
    current.disableRemoteControl = defaults.disableRemoteControl;
    changed = true;
}

if (changed) {
    fs.writeFileSync(targetPath, JSON.stringify(current, null, 2) + '\n');
    console.log('Enforced required keys in Claude settings.json (user settings preserved)');
}
