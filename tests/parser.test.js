/*
	PARSE TREE TESTS
	Covers the grammar + toAST evaluation chain for note
	ranges: ascending, descending, single-note, sharp/flat
	spelling, empty numeric intervals, invalid endpoints,
	and the untouched function-call syntax.
*/
const assert = require('assert');
const { parseLine, parseScene } = require('../parser');

// Helper: parse a play line and return the `arguments`
// of the list produced by its (notes ...) pattern.
function notesOf(line) {
	const ast = parseLine(line);
	assert.strictEqual(ast.type, 'play');
	const notesPattern = ast.patterns.find(p => p.function === 'notes');
	assert.ok(notesPattern, 'expected a (notes ...) pattern');
	const list = notesPattern.arguments[0];
	assert.strictEqual(list.type, 'list');
	return list.arguments;
}

const cases = [];
function test(name, fn) { cases.push([name, fn]); }

// --- ascending range (the case that already worked) ---
test('[E3..C4] ascends chromatically with sharp spelling', () => {
	assert.deepStrictEqual(
		notesOf('> @synth (notes [E3..C4])'),
		['E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3', 'C4']
	);
});

// --- descending range ---
test('[C4..E3] descends chromatically', () => {
	assert.deepStrictEqual(
		notesOf('> @synth (notes [C4..E3])'),
		['C4', 'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3']
	);
});

// --- single-note range ---
test('[E3..E3] is a single note, not an empty list', () => {
	assert.deepStrictEqual(notesOf('> @synth (notes [E3..E3])'), ['E3']);
});

// --- sharp spelling survives a range ---
test('[F#3..A#3] keeps sharp spelling (no Gb respelling)', () => {
	assert.deepStrictEqual(
		notesOf('> @synth (notes [F#3..A#3])'),
		['F#3', 'G3', 'G#3', 'A3', 'A#3']
	);
});

// --- flat input is accepted and normalized to sharps ---
test('[Gb3..Bb3] accepts flats and normalizes to sharps', () => {
	assert.deepStrictEqual(
		notesOf('> @synth (notes [Gb3..Bb3])'),
		['F#3', 'G3', 'G#3', 'A3', 'A#3']
	);
});

// --- lowercase notes still work ---
test('[c3..e3] lowercase endpoints normalize to uppercase', () => {
	assert.deepStrictEqual(
		notesOf('> @synth (notes [c3..e3])'),
		['C3', 'C#3', 'D3', 'D#3', 'E3']
	);
});

// --- cross-octave ranges ---
test('[B3..D4] crosses the octave boundary', () => {
	assert.deepStrictEqual(
		notesOf('> @synth (notes [B3..D4])'),
		['B3', 'C4', 'C#4', 'D4']
	);
});

// --- full MIDI range endpoints (negative octave) ---
test('[C-1..C0] supports negative octaves at the MIDI boundary', () => {
	assert.deepStrictEqual(
		notesOf('> @synth (notes [C-1..C0])'),
		['C-1', 'C#-1', 'D-1', 'D#-1', 'E-1', 'F-1', 'F#-1', 'G-1', 'G#-1', 'A-1', 'A#-1', 'B-1', 'C0']
	);
});

// --- empty interval: numeric range with equal endpoints ---
test('[3..3] is the empty interval: an empty list', () => {
	assert.deepStrictEqual(notesOf('> @synth (notes [3..3])'), []);
});

test('[5..2] numeric range counts down (half-open)', () => {
	assert.deepStrictEqual(notesOf('> @synth (notes [5..2])'), [5, 4, 3]);
});

test('[2..5] numeric range stays half-open', () => {
	assert.deepStrictEqual(notesOf('> @synth (notes [2..5])'), [2, 3, 4]);
});

// --- invalid note endpoints fail at parse time ---
test('[E3..foo] throws a helpful parse-time error', () => {
	assert.throws(
		() => notesOf('> @synth (notes [E3..foo])'),
		/Invalid note range \[E3\.\.foo\].*not a valid note name/
	);
});

// --- original function-call syntax is preserved ---
test('(transpose -2 [E3..C4]) parses as a nested function call', () => {
	const ast = parseLine('> @synth (notes (transpose -2 [E3..C4]))');
	const notesPattern = ast.patterns.find(p => p.function === 'notes');
	const call = notesPattern.arguments[0];
	assert.strictEqual(call.type, 'function');
	assert.strictEqual(call.function, 'transpose');
	assert.strictEqual(call.arguments[0], -2);
	assert.deepStrictEqual(call.arguments[1], {
		type: 'list',
		arguments: ['E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3', 'C4'],
	});
});

test('graph lines with blocks and pipes are unchanged', () => {
	const ast = parseLine('@synth (osc tri) ~ (filter lp 100) ~ (gain 0.5)');
	assert.strictEqual(ast.type, 'graph');
	assert.strictEqual(ast.sound.name, '@synth');
	assert.deepStrictEqual(ast.pipe.map(b => b.function), ['osc', 'filter', 'gain']);
});

test('bare words (osc, sine, lydian) still parse as note words', () => {
	const ast = parseLine('@synth (adsr (osc sine) 64n 8n 0.5 8n)');
	const adsr = ast.pipe[0];
	assert.strictEqual(adsr.function, 'adsr');
	assert.strictEqual(adsr.arguments[0].function, 'osc');
	assert.strictEqual(adsr.arguments[0].arguments[0], 'sine');
});

// --- multi-line scene parsing with tabs and comments ---
test('parseScene joins tabbed lines and skips comments', () => {
	const scene = parseScene([
		'# a comment',
		'@synth (osc sine)',
		'play @synth',
		'\t(rhythm [8n])',
		'\t(notes [E3..G3])',
	].join('\n'));
	assert.strictEqual(scene.length, 2);
	assert.strictEqual(scene[0].type, 'graph');
	assert.strictEqual(scene[1].type, 'play');
	assert.deepStrictEqual(scene[1].patterns[1].arguments[0].arguments, ['E3', 'F3', 'F#3', 'G3']);
});

module.exports = { cases };
