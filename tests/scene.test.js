/*
	FIXED SCENE STABILITY TEST
	Runs a fixed scene through the full parse + evaluation
	chain and proves that the output event times and pitch
	lists are stable: identical across repeated runs in this
	process, and identical to the committed golden fixture
	(tests/fixtures/fixed-scene.events.json).

	The scene exercises every semantic defined for note
	ranges: ascending, descending, single-note, sharp
	spelling, cross-octave negative transpose, boundary
	clamping, and the empty interval.
*/
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseScene } = require('../parser');
const { buildEventSequence } = require('../helpers/patternClock');

const GOLDEN_PATH = path.join(__dirname, 'fixtures', 'fixed-scene.events.json');

const FIXED_SCENE = [
	'# Fixed scene: ranges, transposition, empty interval.',
	'@synth (osc tri) ~ (gain 0.5)',
	'',
	'play @synth',
	'\t(rhythm [8n])',
	'\t(notes [E3..C4])',
	'',
	'play @synth',
	'\t(rhythm [4n])',
	'\t(notes (transpose -12 [C4..E3]))',
	'',
	'play @synth',
	'\t(rhythm [8n r8n])',
	'\t(notes [F#3..A#3])',
	'',
	'play @synth',
	'\t(rhythm [8n])',
	'\t(notes (transpose -60 [E3..E3]))',
	'',
	'play @synth',
	'\t(rhythm [8n])',
	'\t(notes [3..3])',
].join('\n');

// The runtime starts sounds at context.currentTime + 0.01;
// use the same offset over a fixed two-second window.
const START_TIME = 0.01;
const DURATION = 2.0;

function runFixedScene() {
	const scene = parseScene(FIXED_SCENE);
	const playLines = scene.filter(op => op.type === 'play');
	return playLines.map((op, i) => ({
		line: i,
		sound: op.sound.name,
		events: buildEventSequence(op.patterns, START_TIME, START_TIME + DURATION),
	}));
}

const cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('fixed scene: output times and pitch lists are stable across runs', () => {
	const first = runFixedScene();
	const second = runFixedScene();
	assert.deepStrictEqual(second, first);
});

test('fixed scene: output matches the committed golden fixture', () => {
	const actual = runFixedScene();

	if (!fs.existsSync(GOLDEN_PATH)) {
		fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
		fs.writeFileSync(GOLDEN_PATH, JSON.stringify(actual, null, 2) + '\n');
		console.log(`  (wrote golden fixture to ${path.relative(process.cwd(), GOLDEN_PATH)})`);
		return;
	}

	const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
	assert.deepStrictEqual(
		actual,
		golden,
		'fixed scene output drifted from the golden fixture — ' +
		'delete tests/fixtures/fixed-scene.events.json to regenerate it intentionally'
	);
});

test('fixed scene: summary of event times and pitches', () => {
	const result = runFixedScene();
	result.forEach(({ line, events }) => {
		const times = events.map(e => e.start.toFixed(3)).join(' ');
		const pitches = events.map(e => e.note).join(' ');
		console.log(`  play line ${line}: ${events.length} events`);
		console.log(`    times:   ${times || '(none)'}`);
		console.log(`    pitches: ${pitches || '(none)'}`);
	});
});

module.exports = { cases, FIXED_SCENE };
