/*
	A minimal require hook that transpiles the project's ES
	modules on the fly, so the test suite can run in plain
	Node without a build step. node_modules are passed
	through untouched.
*/
const fs = require('fs');
const babel = require('@babel/core');

const originalJs = require.extensions['.js'];

require.extensions['.js'] = function (module, filename) {
	if (filename.indexOf('node_modules') !== -1) {
		return originalJs(module, filename);
	}
	const source = fs.readFileSync(filename, 'utf8');
	const { code } = babel.transformSync(source, {
		filename,
		presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }]],
		babelrc: false,
		configFile: false,
	});
	module._compile(code, filename);
};
