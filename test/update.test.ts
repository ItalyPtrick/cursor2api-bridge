import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getReleaseAssetNames,
  getStagedReleaseDir,
  isRemoteVersionNewer,
  isUpdateFeedConfigured,
  pickReleaseAsset,
  sanitizeVersionForPath
} from '../src/shared/update';

test('sanitizeVersionForPath strips leading v and unsafe characters', () => {
  assert.equal(sanitizeVersionForPath('v1.2.3-beta+meta'), '1.2.3-beta-meta');
});

test('getStagedReleaseDir keeps updates in a new sibling folder', () => {
  assert.equal(
    getStagedReleaseDir('C:\\apps\\updates', 'v1.2.3'),
    'C:\\apps\\updates\\cursor2api-bridge-1.2.3'
  );
});

test('pickReleaseAsset finds the exact requested asset name', () => {
  const asset = pickReleaseAsset(
    [
      { name: 'notes.txt', browser_download_url: 'https://example.com/notes.txt' },
      { name: 'cursor2api-bridge-portable-win-x64.zip', browser_download_url: 'https://example.com/build.zip' }
    ],
    'cursor2api-bridge-portable-win-x64.zip'
  );

  assert.equal(asset?.browser_download_url, 'https://example.com/build.zip');
});

test('isRemoteVersionNewer compares semver safely', () => {
  assert.equal(isRemoteVersionNewer('0.1.0', '0.2.0'), true);
  assert.equal(isRemoteVersionNewer('0.2.0', '0.1.0'), false);
});

test('isUpdateFeedConfigured requires both owner and repo', () => {
  assert.equal(isUpdateFeedConfigured({ owner: '', repo: 'repo' }), false);
  assert.equal(isUpdateFeedConfigured({ owner: 'owner', repo: '' }), false);
  assert.equal(isUpdateFeedConfigured({ owner: 'owner', repo: 'repo' }), true);
});

test('manifest release asset names stay aligned with the update feed contract', () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'app.manifest.json'), 'utf8')
  ) as {
    updateFeed: {
      assetName: string;
      checksumName: string;
    };
  };

  const assetNames = getReleaseAssetNames(manifest.updateFeed);

  assert.equal(assetNames.archiveName, 'cursor2api-bridge-portable-win-x64.zip');
  assert.equal(assetNames.checksumName, 'cursor2api-bridge-portable-win-x64.zip.sha256');
  assert.equal(assetNames.checksumName, `${assetNames.archiveName}.sha256`);
});
