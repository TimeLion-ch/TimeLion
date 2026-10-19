/**
 * Poll links (CLAUDE.md → Encryption design). Everything secret goes into the fragment, which browsers don't send to
 * the server: `#k={key}` for participants, plus `&a={adminToken}` for the admin, or `&r={responseId}.{editToken}` to
 * edit one response. The fragment uses URLSearchParams syntax.
 */

import { KEY_PATTERN } from './crypto';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const EDIT = /^([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/;

export type Fragment = {
	key: string;
	adminToken?: string;
	edit?: { responseId: string; editToken: string };
};

/** @param origin e.g. `location.origin`, without a trailing slash */
export function participantLink(origin: string, id: string, key: string): string {
	return link(origin, id, { k: key });
}

export function adminLink(origin: string, id: string, key: string, adminToken: string): string {
	return link(origin, id, { k: key, a: adminToken });
}

/** The personal link for editing one response from another device. */
export function editLink(origin: string, id: string, key: string, responseId: string, editToken: string): string {
	return link(origin, id, { k: key, r: `${responseId}.${editToken}` });
}

function link(origin: string, id: string, params: Record<string, string>): string {
	return `${origin}/p/${id}#${new URLSearchParams(params).toString()}`;
}

/**
 * Reads `location.hash`. A malformed admin token or edit part is left out, so the link still opens the poll.
 *
 * @returns null if the fragment has no well-formed key
 */
export function parseFragment(hash: string): Fragment | null {
	const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
	const key = params.get('k');
	if (key === null || !KEY_PATTERN.test(key)) {
		return null;
	}

	const fragment: Fragment = { key };
	const adminToken = params.get('a');
	if (adminToken !== null && TOKEN.test(adminToken)) {
		fragment.adminToken = adminToken;
	}
	const [, responseId, editToken] = EDIT.exec(params.get('r') ?? '') ?? [];
	if (responseId !== undefined && editToken !== undefined) {
		fragment.edit = { responseId, editToken };
	}
	return fragment;
}
