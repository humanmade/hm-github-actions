#!/usr/bin/env node
/**
 * Generates markdown documentation for one or more WordPress blocks
 * by feeding block source files to `claude -p`.
 *
 * Usage:
 *   node scripts/document-blocks.mjs [block-name ...]
 *
 * With no block names, detects which blocks changed in the last git commit.
 *
 * Configuration: place a .document-blocks.json file in the project root.
 * See block-docs/.document-blocks.json.example for available options.
 *
 * Output: {docsDir}/{block-name}.md
 */

import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const ROOT = resolve( __dirname, '..' );

// Load project config, falling back to defaults.
const configPath = join( ROOT, '.document-blocks.json' );
const config = existsSync( configPath )
	? JSON.parse( readFileSync( configPath, 'utf-8' ) )
	: {};

const BLOCKS_DIR = join( ROOT, config.blocksDir ?? 'blocks' );
const UTILITIES_DIR = config.utilitiesDir ? join( ROOT, config.utilitiesDir ) : null;
const DOCS_DIR = join( ROOT, config.docsDir ?? 'docs/blocks' );
const CORE_BLOCK_PREFIX = config.coreBlockPrefix ?? 'core-';

// Style reference: explicit path in config, or first .md in DOCS_DIR, or none.
function resolveStyleRef() {
	if ( config.styleRef ) {
		const p = join( ROOT, config.styleRef );
		return existsSync( p ) ? readFileSync( p, 'utf-8' ) : '';
	}
	if ( existsSync( DOCS_DIR ) ) {
		const first = readdirSync( DOCS_DIR ).find( ( f ) => f.endsWith( '.md' ) );
		if ( first ) {
			return readFileSync( join( DOCS_DIR, first ), 'utf-8' );
		}
	}
	return '';
}

// Files to collect from a block folder, in order.
const CANDIDATE_FILES = [
	'block.json',
	'edit.js',
	'save.js',
	'index.js',
	'view.js',
	'render.php',
	'variations.js',
	'transforms.js',
	'deprecated.js',
	'style.scss',
];

/**
 * Returns the block names that changed in the most recent git commit.
 */
function detectChangedBlocks() {
	const diff = execSync( 'git diff HEAD~1 --name-only', {
		cwd: ROOT,
		encoding: 'utf-8',
	} );

	// Build a regex from the configured blocks directory path.
	const blocksRel = relative( ROOT, BLOCKS_DIR ).replace( /\\/g, '/' );
	const pattern = new RegExp( `^${ blocksRel }/([^/]+)/` );

	const names = new Set();
	for ( const line of diff.split( '\n' ) ) {
		const match = line.match( pattern );
		if ( match ) {
			names.add( match[ 1 ] );
		}
	}
	return [ ...names ];
}

/**
 * Returns true for blocks that are thin core-block overrides (no custom
 * edit.js or save.js, and whose folder name starts with the configured prefix).
 * These don't benefit from full AI-generated documentation.
 */
function isCoreOverride( blockDir, blockName ) {
	if ( ! CORE_BLOCK_PREFIX || ! blockName.startsWith( CORE_BLOCK_PREFIX ) ) {
		return false;
	}
	return (
		! existsSync( join( blockDir, 'edit.js' ) ) &&
		! existsSync( join( blockDir, 'save.js' ) )
	);
}

/**
 * Reads a file and returns a labelled section string, or empty string if absent.
 */
function section( label, filePath ) {
	if ( ! existsSync( filePath ) ) {
		return '';
	}
	const content = readFileSync( filePath, 'utf-8' ).trim();
	return `\n### ${ label }\n\`\`\`\n${ content }\n\`\`\`\n`;
}

/**
 * Builds the full prompt for a block by assembling its file contents.
 */
function buildPrompt( blockName, blockDir, styleRef ) {
	let files = '';

	for ( const filename of CANDIDATE_FILES ) {
		files += section( filename, join( blockDir, filename ) );
	}

	// Deprecations
	const deprecationsDir = join( blockDir, 'deprecations' );
	if ( existsSync( deprecationsDir ) ) {
		for ( const f of readdirSync( deprecationsDir ).sort() ) {
			if ( f.endsWith( '.js' ) ) {
				files += section(
					`deprecations/${ f }`,
					join( deprecationsDir, f )
				);
			}
		}
	}

	// Optional: matching frontend utility file (e.g. src/utilities/{block}.js)
	if ( UTILITIES_DIR ) {
		const utilityPath = join( UTILITIES_DIR, `${ blockName }.js` );
		const utilityLabel = join(
			relative( ROOT, UTILITIES_DIR ),
			`${ blockName }.js`
		).replace( /\\/g, '/' );
		files += section( utilityLabel, utilityPath );
	}

	const styleRefSection = styleRef
		? `## Style Reference\n\n${ styleRef }\n\n`
		: '';

	return `You are documenting a WordPress Gutenberg block.

Analyze the block files below and generate a markdown documentation file.

Follow these rules:
- ${ styleRef ? 'Use the style reference exactly: same heading structure, table format, and depth.' : 'Use clear markdown with headings, tables where appropriate, and concise prose.' }
- Cover: what the block does and when to use it, block structure and any parent/child relationships, all attributes with purpose and valid values, editor controls, frontend JS behaviour (if view.js or a utility file exists), CSS custom properties, and deprecation history.
- Your response must begin with the # heading of the document. Do not write any introductory sentence, explanation, or preamble before the first # heading.
- Output ONLY the markdown content. No preamble, no code fences wrapping the whole output.

${ styleRefSection }## Block Files: ${ blockName }

${ files }`;
}

/**
 * Strips any conversational preamble before the first markdown heading.
 */
function stripPreamble( text ) {
	const index = text.search( /^#/m );
	return index > 0 ? text.slice( index ) : text;
}

/**
 * Calls claude -p with the prompt piped to stdin. Returns a Promise<string>.
 */
function runClaude( prompt ) {
	return new Promise( ( resolve, reject ) => {
		const proc = spawn(
			'claude',
			[ '-p', '--output-format', 'text', '--tools', '' ],
			{ stdio: [ 'pipe', 'pipe', 'pipe' ] }
		);

		let stdout = '';
		let stderr = '';
		proc.stdout.on( 'data', ( chunk ) => ( stdout += chunk ) );
		proc.stderr.on( 'data', ( chunk ) => ( stderr += chunk ) );

		proc.stdin.write( prompt );
		proc.stdin.end();

		proc.on( 'error', reject );
		proc.on( 'close', ( code ) => {
			if ( code !== 0 ) {
				reject(
					new Error(
						`claude exited with status ${ code }:\n${ stderr }`
					)
				);
			} else {
				resolve( stdout.trim() );
			}
		} );
	} );
}

/**
 * Documents a single block. Returns true if a file was written.
 */
async function documentBlock( name, styleRef ) {
	const blockDir = join( BLOCKS_DIR, name );

	if ( ! existsSync( blockDir ) ) {
		console.warn( `  ⚠  Block folder not found: ${ blockDir }` );
		return false;
	}

	if ( isCoreOverride( blockDir, name ) ) {
		console.log( `  –  Skipping core override: ${ name }` );
		return false;
	}

	console.log( `  ·  Documenting ${ name }...` );
	const prompt = buildPrompt( name, blockDir, styleRef );
	const markdown = stripPreamble( await runClaude( prompt ) );
	const outPath = join( DOCS_DIR, `${ name }.md` );
	writeFileSync( outPath, markdown + '\n' );
	console.log( `  ✓  Written: ${ relative( ROOT, outPath ) }` );
	return true;
}

async function main() {
	const args = process.argv.slice( 2 );
	const autoCommit = args.includes( '--auto-commit' );
	const blockNames = args.filter( ( a ) => ! a.startsWith( '--' ) );
	const styleRef = resolveStyleRef();

	let namesToDocument = blockNames;
	if ( namesToDocument.length === 0 ) {
		console.log( 'No block names provided — detecting from last commit...' );
		namesToDocument = detectChangedBlocks();
		if ( namesToDocument.length === 0 ) {
			console.log( 'No block changes detected in last commit.' );
			process.exit( 0 );
		}
		console.log( `Detected blocks: ${ namesToDocument.join( ', ' ) }` );
	}

	// Process all blocks in parallel.
	const results = await Promise.allSettled(
		namesToDocument.map( ( name ) => documentBlock( name, styleRef ) )
	);

	const generated = results.filter(
		( r ) => r.status === 'fulfilled' && r.value === true
	).length;
	const failed = results.filter( ( r ) => r.status === 'rejected' );

	failed.forEach( ( r, i ) =>
		console.error(
			`  ✗  Failed to document ${ namesToDocument[ i ] }: ${ r.reason?.message }`
		)
	);
	console.log(
		`\nDone. ${ generated } generated, ${ results.length - generated } skipped/failed.`
	);

	if ( autoCommit && generated > 0 ) {
		const docsDir = relative( ROOT, DOCS_DIR );
		execSync( `git add ${ docsDir }`, { cwd: ROOT } );
		const hasChanges = execSync( 'git diff --cached --name-only', {
			cwd: ROOT,
			encoding: 'utf-8',
		} ).trim();
		if ( hasChanges ) {
			// [skip ci] prevents this commit from re-triggering CI workflows.
			execSync(
				'git commit -m "docs: update block documentation [skip ci]"',
				{ cwd: ROOT }
			);
			console.log( '→ Documentation committed.' );
		}
	}
}

main().catch( ( err ) => {
	console.error( err );
	process.exit( 1 );
} );
