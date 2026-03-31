import type { FrontendRoute } from './state';

export function getFrontendRouteCandidates(preferredRoute: FrontendRoute): FrontendRoute[] {
  return preferredRoute === '/logs'
    ? ['/logs', '/vuelogs']
    : ['/vuelogs', '/logs'];
}

function normalizeRepo(repo: string): string {
  return repo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

export function getUpstreamRepoUrl(repo: string): string {
  return `https://github.com/${normalizeRepo(repo)}`;
}

export function getUpstreamRepoLabel(repo: string): string {
  return `原项目 · ${normalizeRepo(repo)}`;
}
