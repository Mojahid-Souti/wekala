#!/usr/bin/env node
/**
 * scripts/keygen.js — Wekala secret generator
 *
 * Generates cryptographically random secrets and Supabase JWT keys, then
 * writes them directly into .env. Only placeholder values are replaced;
 * any field that already holds a real value is left alone (idempotent).
 *
 * Node.js 24+ · Zero external dependencies (built-in crypto + fs only).
 * Usage:  node scripts/keygen.js   OR   make keygen
 *
 * Complexity: O(n) where n = lines in .env (~125). All crypto ops are O(1).
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

// ---------------------------------------------------------------------------
// Placeholder detection
//
// A value is a placeholder when it starts with one of these prefixes.
// Fields that already hold a real value (anything else) are never overwritten.
// ---------------------------------------------------------------------------

const PLACEHOLDER_PREFIXES = ["CHANGE_ME", "dev_jwt_secret_change_me"];

const isPlaceholder = (v) => PLACEHOLDER_PREFIXES.some((p) => v.startsWith(p));

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

/** n random bytes as lowercase hex string */
const hex = (n) => crypto.randomBytes(n).toString("hex");

/**
 * Encode a Buffer (or string) as base64url — no padding, URL-safe alphabet.
 * Required by the JWT spec (RFC 7515 §2).
 */
const b64url = (input) => {
	const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
	return buf
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
};

/**
 * Sign a JWT using HS256 (HMAC-SHA256) with Node's built-in crypto.
 * No jsonwebtoken package needed — HS256 is just three base64url segments.
 *
 * @param {object} payload - JWT claims
 * @param {string} secret  - Signing secret (the SUPABASE_JWT_SECRET value)
 * @returns {string} Signed JWT string
 */
function signJWT(payload, secret) {
	const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const body = b64url(JSON.stringify(payload));
	const message = `${header}.${body}`;
	const sig = b64url(
		crypto.createHmac("sha256", secret).update(message).digest(),
	);
	return `${message}.${sig}`;
}

// ---------------------------------------------------------------------------
// .env read / parse / write
// ---------------------------------------------------------------------------

function readEnv() {
	if (!fs.existsSync(ENV_PATH)) {
		console.error("\n  ✗  .env not found — run `make setup` first.\n");
		process.exit(1);
	}
	return fs.readFileSync(ENV_PATH, "utf8");
}

/**
 * Parse KEY=VALUE lines from .env content into a plain object.
 * Comment lines and blank lines are ignored.
 * O(n) over lines.
 */
function parseEnv(content) {
	const env = {};
	for (const line of content.split("\n")) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (m) env[m[1]] = m[2];
	}
	return env;
}

/**
 * Replace the value of a KEY=<old> line in the file content string.
 *
 * The regex is anchored with ^ and the multiline flag so that a key name
 * that appears as a suffix of another (e.g. SUPABASE_SERVICE_ROLE_KEY inside
 * WEKALA_SUPABASE_SERVICE_KEY) never accidentally matches.
 */
const replaceLine = (content, key, value) =>
	content.replace(new RegExp(`^(${key}=)(.*)$`, "m"), `$1${value}`);

// ---------------------------------------------------------------------------
// Secret generation
// ---------------------------------------------------------------------------

/**
 * Generate all required secrets, derive Supabase JWTs, and resolve
 * cross-reference aliases. Returns the updated file content string plus
 * arrays of generated and skipped key names for display.
 *
 * Ordering is intentional: SUPABASE_JWT_SECRET must be resolved before the
 * JWT keys that are signed with it.
 */
function generateSecrets(envContent) {
	const env = parseEnv(envContent);
	let content = envContent;
	const generated = [];
	const skipped = [];

	/**
	 * Attempt to write `value` for `key`:
	 *   - If the current value is a placeholder → replace and record as generated.
	 *   - If the current value is already real   → warn and keep it.
	 *   - If the key is missing from .env        → no-op (future phase adds it).
	 * Returns the resolved value (new or pre-existing) for use by later callers.
	 */
	function set(key, value) {
		if (!(key in env)) return value; // key not present — skip silently

		const current = env[key];
		if (!isPlaceholder(current)) {
			skipped.push(key);
			return current; // preserve real value
		}

		content = replaceLine(content, key, value);
		env[key] = value; // update in-memory map so cross-references see the new value
		generated.push(key);
		return value;
	}

	// 1. Supabase JWT secret — must come first; anon + service keys are derived from it
	set("SUPABASE_JWT_SECRET", hex(40));
	const jwtSecret = env.SUPABASE_JWT_SECRET; // resolved: new or pre-existing

	// 2. Supabase JWT keys — 10-year expiry is standard for self-hosted dev setups
	const now = Math.floor(Date.now() / 1000);
	const expiry = now + Math.floor(10 * 365.25 * 24 * 3600);

	set(
		"SUPABASE_ANON_KEY",
		signJWT(
			{ iss: "supabase", role: "anon", iat: now, exp: expiry },
			jwtSecret,
		),
	);
	set(
		"SUPABASE_SERVICE_ROLE_KEY",
		signJWT(
			{ iss: "supabase", role: "service_role", iat: now, exp: expiry },
			jwtSecret,
		),
	);

	// 3. Independent secrets — each is 32 random bytes (256 bits), hex-encoded
	set("DIFY_SECRET_KEY", hex(32));
	set("DIFY_SANDBOX_API_KEY", hex(32));
	set("WEKALA_SECRET_KEY", hex(32));
	set("MEILI_MASTER_KEY", hex(32));
	set("N8N_ENCRYPTION_KEY", hex(32));
	set("N8N_USER_MANAGEMENT_JWT_SECRET", hex(32));
	set("LANGFUSE_SECRET_KEY", hex(32));
	set("LANGFUSE_NEXTAUTH_SECRET", hex(32));

	// 4. Cross-reference aliases — copy from the now-resolved source keys
	//    Works correctly whether the source was just generated or was pre-existing.
	set("WEKALA_SUPABASE_SERVICE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);
	set("NEXT_PUBLIC_SUPABASE_ANON_KEY", env.SUPABASE_ANON_KEY);

	return { content, generated, skipped };
}

// ---------------------------------------------------------------------------
// Terminal helpers
// ---------------------------------------------------------------------------

const G = "\x1b[32m"; // green
const Y = "\x1b[33m"; // yellow
const C = "\x1b[36m"; // cyan
const B = "\x1b[1m"; // bold
const R = "\x1b[0m"; // reset

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
	const original = readEnv();
	const { content, generated, skipped } = generateSecrets(original);

	if (generated.length === 0) {
		console.log(
			`\n${Y}  All managed keys already have real values — nothing to generate.${R}`,
		);
		console.log(`  Run ${C}make up${R} when ready.\n`);
		return;
	}

	fs.writeFileSync(ENV_PATH, content, "utf8");

	console.log(`\n${B}  Generated:${R}`);
	for (const key of generated) console.log(`  ${G}✓${R}  ${key}`);

	if (skipped.length > 0) {
		console.log(`\n${B}  Kept (already set):${R}`);
		for (const key of skipped) console.log(`  ${Y}–${R}  ${key}`);
	}

	// LANGFUSE_PUBLIC_KEY requires a manual step after first login — remind the user.
	const env = parseEnv(content);
	if (env.LANGFUSE_PUBLIC_KEY?.includes("CHANGE_ME")) {
		console.log(
			`\n  ${C}ℹ${R}  ${B}LANGFUSE_PUBLIC_KEY${R} needs one manual step after the stack is up:`,
		);
		console.log(`     1. ${C}make up${R}`);
		console.log(
			`     2. Open ${C}http://localhost:3001${R} → create an org + project`,
		);
		console.log(`     3. Copy the public API key into ${C}.env${R}`);
	}

	console.log(`\n  ${G}✓${R}  .env updated — ready for ${C}make up${R}\n`);
}

main();
