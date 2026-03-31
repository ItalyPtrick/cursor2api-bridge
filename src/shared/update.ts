import semver from 'semver';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface UpdateFeedConfig {
  owner: string;
  repo: string;
  assetName: string;
  checksumName: string;
}

export function sanitizeVersionForPath(version: string): string {
  return version.replace(/^v/i, '').replace(/[^0-9A-Za-z.-]/g, '-');
}

export function getStagedReleaseDir(updatesDir: string, version: string): string {
  return `${updatesDir}\\cursor2api-bridge-${sanitizeVersionForPath(version)}`;
}

export function pickReleaseAsset(assets: ReleaseAsset[], fileName: string): ReleaseAsset | undefined {
  return assets.find((asset) => asset.name === fileName);
}

export function isUpdateFeedConfigured(feed: Pick<UpdateFeedConfig, 'owner' | 'repo'>): boolean {
  return Boolean(feed.owner?.trim() && feed.repo?.trim());
}

export function getReleaseAssetNames(feed: Pick<UpdateFeedConfig, 'assetName' | 'checksumName'>): {
  archiveName: string;
  checksumName: string;
} {
  return {
    archiveName: feed.assetName,
    checksumName: feed.checksumName
  };
}

export function isRemoteVersionNewer(currentVersion: string, remoteVersion: string): boolean {
  const current = semver.coerce(currentVersion);
  const remote = semver.coerce(remoteVersion);

  if (!current || !remote) {
    return false;
  }

  return semver.gt(remote, current);
}
