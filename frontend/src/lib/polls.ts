/**
 * The poll service: crypto, model and API in one place, so the UI deals only with plaintext documents, the key
 * string from the link or the device store, and tokens. Documents are encrypted before they leave the browser and
 * validated after they are decrypted.
 *
 * Errors: `ApiError` from api.ts (not found or expired, closed, network, …), `UnreadablePollError` when the key
 * doesn't open the poll, and `TypeError` for a document the UI should never have built.
 */

import { api, type CreatedResponse, type PollPatch, type UpdatedPoll, type UpdatedResponse } from './api';
import { DecryptionError, decryptJson, encryptJson, exportKey, generatePollKey, importKey, type Kind } from './crypto';
import { choiceProblem, parsePoll, parseResponse, type Poll, type PollResponse } from './model';

/** The server's metadata, which it stores in plaintext (CLAUDE.md → What the server can see). */
export type PollMeta = { id: string; createdAt: number; updatedAt: number; expiresAt: number; closedAt: number | null };

export type LoadedResponse = { id: string; createdAt: number; updatedAt: number; response: PollResponse };

export type LoadedPoll = {
	poll: Poll;
	/** Oldest first. */
	responses: LoadedResponse[];
	/** IDs of responses that couldn't be decrypted or aren't valid. They are left out; the admin can delete them. */
	skippedResponses: string[];
	meta: PollMeta;
};

/** The link is wrong or incomplete: the key is malformed or doesn't decrypt the poll, or the poll isn't valid. */
export class UnreadablePollError extends Error {
	constructor(message = 'The poll could not be decrypted with this key.') {
		super(message);
		this.name = 'UnreadablePollError';
	}
}

/** @returns the poll's ID, its key for the links (base64url) and the admin token, which the server can't show again */
export async function createPoll(
	poll: Poll,
	expiresAt: number,
): Promise<{ id: string; key: string; adminToken: string }> {
	const document = checkedPoll(poll);
	const cryptoKey = await generatePollKey();
	const created = await api.createPoll(await encryptJson(cryptoKey, 'poll', document), expiresAt);
	return { id: created.id, key: await exportKey(cryptoKey), adminToken: created.adminToken };
}

/** Responses that can't be read are skipped and listed in `skippedResponses`, so one bad response can't hide a poll. */
export async function loadPoll(id: string, key: string): Promise<LoadedPoll> {
	const cryptoKey = await openKey(key);
	const stored = await api.getPoll(id);
	const poll = parsePoll(await decryptOrNull(cryptoKey, 'poll', stored.ciphertext));
	if (poll === null) {
		throw new UnreadablePollError();
	}

	const decrypted = await Promise.all(
		stored.responses.map(async (entry) => ({
			entry,
			response: parseResponse(await decryptOrNull(cryptoKey, 'response', entry.ciphertext), poll),
		})),
	);
	const responses: LoadedResponse[] = [];
	const skippedResponses: string[] = [];
	for (const { entry, response } of decrypted) {
		if (response === null) {
			skippedResponses.push(entry.id);
		} else {
			responses.push({ id: entry.id, createdAt: entry.createdAt, updatedAt: entry.updatedAt, response });
		}
	}

	const { createdAt, updatedAt, expiresAt, closedAt } = stored;
	return { poll, responses, skippedResponses, meta: { id: stored.id, createdAt, updatedAt, expiresAt, closedAt } };
}

/**
 * Votes for options the poll doesn't have are dropped before encrypting. A response that breaks the poll's choice
 * limits is refused here, because the server can't check them: it never sees votes.
 *
 * @returns the response's ID and edit token, which the server can't show again
 */
export async function submitResponse(
	id: string,
	key: string,
	poll: Poll,
	response: PollResponse,
): Promise<CreatedResponse> {
	const document = checkedResponse(response, poll);
	return api.createResponse(id, await encryptJson(await openKey(key), 'response', document));
}

export async function editResponse(
	id: string,
	key: string,
	poll: Poll,
	responseId: string,
	editToken: string,
	response: PollResponse,
): Promise<UpdatedResponse> {
	const document = checkedResponse(response, poll);
	return api.updateResponse(id, responseId, editToken, await encryptJson(await openKey(key), 'response', document));
}

/** @param token the response's edit token, or the poll's admin token */
export function deleteResponse(id: string, responseId: string, token: string): Promise<void> {
	return api.deleteResponse(id, responseId, token);
}

/** Replaces the poll document, and the expiry if given. */
export async function updatePoll(
	id: string,
	key: string,
	adminToken: string,
	poll: Poll,
	expiresAt?: number,
): Promise<UpdatedPoll> {
	const document = checkedPoll(poll);
	const patch: PollPatch = { ciphertext: await encryptJson(await openKey(key), 'poll', document) };
	if (expiresAt !== undefined) {
		patch.expiresAt = expiresAt;
	}
	return api.updatePoll(id, adminToken, patch);
}

export function closePoll(id: string, adminToken: string): Promise<UpdatedPoll> {
	return api.updatePoll(id, adminToken, { closed: true });
}

export function reopenPoll(id: string, adminToken: string): Promise<UpdatedPoll> {
	return api.updatePoll(id, adminToken, { closed: false });
}

/** Deletes the poll and all its responses on the server, for good. */
export function deletePoll(id: string, adminToken: string): Promise<void> {
	return api.deletePoll(id, adminToken);
}

async function openKey(key: string): Promise<CryptoKey> {
	try {
		return await importKey(key);
	} catch {
		throw new UnreadablePollError('The poll key is malformed.');
	}
}

async function decryptOrNull(key: CryptoKey, kind: Kind, envelope: string): Promise<unknown> {
	try {
		return await decryptJson(key, kind, envelope);
	} catch (error) {
		if (error instanceof DecryptionError) {
			return null;
		}
		throw error;
	}
}

/** The documents go through the same validators as on loading, so nothing is stored that couldn't be read back. */
function checkedPoll(poll: Poll): Poll {
	const document = parsePoll(poll);
	if (document === null) {
		throw new TypeError('Invalid poll document.');
	}
	return document;
}

function checkedResponse(response: PollResponse, poll: Poll): PollResponse {
	const document = parseResponse(response, poll);
	if (document === null) {
		throw new TypeError('Invalid response document.');
	}
	if (choiceProblem(poll, document.votes) !== null) {
		throw new TypeError('The response breaks the choice limits of the poll.');
	}
	return document;
}
