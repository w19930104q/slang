/*
	Test runner: loads the babel require hook so the project's
	ES modules can be required, then runs every suite.
*/
require('./babel-require-hook');

const suites = [
	['parse tree', require('./parser.test')],
	['event sequence', require('./events.test')],
	['fixed scene', require('./scene.test')],
];

let passed = 0;
let failed = 0;

for (const [suiteName, suite] of suites) {
	console.log(`\n${suiteName}`);
	for (const [name, fn] of suite.cases) {
		try {
			fn();
			passed++;
			console.log(`  ✓ ${name}`);
		} catch (error) {
			failed++;
			console.error(`  ✗ ${name}`);
			console.error(`    ${error.message.split('\n').join('\n    ')}`);
		}
	}
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
