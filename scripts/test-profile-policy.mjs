import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
    entryPoints: ['utils/profilePolicy.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: false,
    logLevel: 'silent',
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const {
    chooseAccountSnapshot,
    isActiveAccount,
    parseActiveProfile,
    serializeActiveProfile,
} = await import(moduleUrl);

const snapshot = (name, points, lastModifiedAt) => ({
    name,
    lastModifiedAt,
    points,
    settings: {},
    progress: { [`${name}-level`]: { levelId: 1, difficulty: name, status: 'completed', timeElapsed: 1 } },
    purchasedBackgrounds: [name],
    selectedBackground: name,
    purchasedNumberColors: [name],
    selectedNumberColor: name,
    purchasedSkills: [name],
    enabledSkills: [name],
    purchasedSoundPacks: [name],
    selectedSoundPack: name,
});

const guest = snapshot('guest', 100, 300);
const accountCache = snapshot('cache', 200, 200);
const cloud = snapshot('cloud', 300, 100);

assert.deepEqual(parseActiveProfile('guest'), { kind: 'guest' });
assert.deepEqual(parseActiveProfile('account:user-1'), { kind: 'account', uid: 'user-1' });
assert.equal(parseActiveProfile('account:'), null);
assert.equal(serializeActiveProfile({ kind: 'account', uid: 'user-1' }), 'account:user-1');
assert.equal(isActiveAccount({ kind: 'account', uid: 'user-1' }, 'user-1'), true);
assert.equal(isActiveAccount({ kind: 'guest' }, 'user-1'), false);

const existingAccountSignIn = chooseAccountSnapshot({
    accountIsAlreadyActive: false,
    accountCache: guest,
    cloudSnapshot: cloud,
    guestSnapshot: guest,
});
assert.equal(existingAccountSignIn.source, 'cloud');
assert.deepEqual(existingAccountSignIn.snapshot, cloud);
assert.equal(existingAccountSignIn.snapshot.progress['guest-level'], undefined);

const newAccountSignIn = chooseAccountSnapshot({
    accountIsAlreadyActive: false,
    accountCache: guest,
    cloudSnapshot: null,
    guestSnapshot: guest,
});
assert.equal(newAccountSignIn.source, 'guest-conversion');
assert.deepEqual(newAccountSignIn.snapshot, guest);

const newerAccountCache = chooseAccountSnapshot({
    accountIsAlreadyActive: true,
    accountCache: accountCache,
    cloudSnapshot: cloud,
    guestSnapshot: guest,
});
assert.equal(newerAccountCache.source, 'account-cache');
assert.deepEqual(newerAccountCache.snapshot, accountCache);
assert.equal(newerAccountCache.snapshot.progress['cloud-level'], undefined);

const equalTimestampAccountCache = chooseAccountSnapshot({
    accountIsAlreadyActive: true,
    accountCache: snapshot('equal-cache', 400, 500),
    cloudSnapshot: snapshot('equal-cloud', 500, 500),
    guestSnapshot: guest,
});
assert.equal(equalTimestampAccountCache.source, 'account-cache');
assert.equal(equalTimestampAccountCache.snapshot.name, 'equal-cache');
assert.equal(equalTimestampAccountCache.snapshot.progress['equal-cloud-level'], undefined);

const newerCloud = chooseAccountSnapshot({
    accountIsAlreadyActive: true,
    accountCache: snapshot('old-cache', 10, 50),
    cloudSnapshot: cloud,
    guestSnapshot: guest,
});
assert.equal(newerCloud.source, 'cloud');
assert.deepEqual(newerCloud.snapshot, cloud);

console.log('Profile policy checks passed.');
