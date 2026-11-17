import { parseScene } from './parser';
import runtime from './runtime';

export function runScene(text) {
	// Turn the scene text into a parse tree (see parser.js).
	const parsedScene = parseScene(text);

	// I'm sure there are better ways to approach this,
	// but for now let's preemptively clear the scene.
	runtime.clearScene();

	console.log('%cRunning scene! Parsed syntax tree:', 'color: green;', parsedScene);

	// Start the show!
	runtime.runScene(parsedScene);
}

export function clearScene() {
	runtime.clearScene();
}
