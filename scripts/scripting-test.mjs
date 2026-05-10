import { build } from 'esbuild';

const source = `
import assert from 'node:assert/strict';
import { defaultEditorSettings, defaultVectorOptions } from './src/defaults.ts';
import { runScript, splitScriptLineComment } from './src/lib/scripting.ts';

const run = (script) => runScript(script, structuredClone(defaultVectorOptions), structuredClone(defaultEditorSettings));

{
  const out = run('preset lineart-clean');
  assert.equal(out.options.mode, 'binary');
  assert.equal(out.options.binary.threshold, 185);
}

{
  const out = run([
    'set vector.maxSide = 2200',
    'set bg.tolerance: 12',
    'set color.colors 36',
    'set live = yes',
    'set bg.showMask = no',
    'set output.background = on',
    'set output.openInEditor = off',
    'set line.fill = #222222'
  ].join('\\n'));
  assert.equal(out.options.maxSide, 2200);
  assert.equal(out.options.background.tolerance, 12);
  assert.equal(out.options.color.colors, 36);
  assert.equal(out.options.livePreview, true);
  assert.equal(out.options.background.showMask, false);
  assert.equal(out.options.output.addBackground, true);
  assert.equal(out.options.output.openInEditor, false);
  assert.equal(out.options.binary.fill, '#222222');
}

{
  const out = run('set trace.simplify = 0.42');
  assert.equal(out.options.trace.simplify, 0.42);
  assert.equal(out.options.color.trace.simplify, 0.42);
  assert.equal(out.options.binary.trace.simplify, 0.42);
}

{
  const out = run('set editor.hue = 20\\nset editor.protectBlack = true');
  assert.equal(out.editor.hue, 20);
  assert.equal(out.editor.protectBlack, true);
}

{
  const out = run('run vectorize\\nrun open-editor\\nrun export-svg\\nrun export-png');
  assert.deepEqual(out.actions, ['vectorize', 'send-to-editor', 'export-svg', 'export-png']);
}

assert.throws(() => run('preset missing-preset'), /Unknown preset on line 1/);
assert.throws(() => run('run missing-action'), /Unknown action on line 1/);
assert.equal(splitScriptLineComment('set line.fill = #111111 # ink').code.trim(), 'set line.fill = #111111');
assert.equal(splitScriptLineComment('#111111 is still a comment').code.trim(), '');

console.log('scripting parser assertions passed');
`;

const result = await build({
  stdin: {
    contents: source,
    loader: 'ts',
    resolveDir: process.cwd(),
    sourcefile: 'scripting-test-entry.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent'
});

const bundled = Buffer.from(result.outputFiles[0].contents).toString('base64');
await import(`data:text/javascript;base64,${bundled}`);
