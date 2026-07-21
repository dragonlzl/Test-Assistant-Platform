const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');
const bundles = [
  {
    packageName: '@visactor/vtable',
    source: 'dist/vtable.min.js',
    output: 'scripts/vendor/vtable.es2019.min.js',
    metadata: 'scripts/vendor/vtable.build.json',
  },
  {
    packageName: '@visactor/vtable-editors',
    source: 'dist/vtable-editors.min.js',
    output: 'scripts/vendor/vtable-editors.es2019.min.js',
    metadata: 'scripts/vendor/vtable-editors.build.json',
  },
];

async function buildBundle(bundle) {
  const packageEntry = require.resolve(bundle.packageName);
  const packageRoot = path.resolve(path.dirname(packageEntry), '..');
  const packageFile = path.join(packageRoot, 'package.json');
  const inputFile = path.join(packageRoot, bundle.source);
  const outputFile = path.join(projectRoot, bundle.output);
  const metadataFile = path.join(projectRoot, bundle.metadata);
  const source = fs.readFileSync(inputFile, 'utf8');
  const result = await esbuild.transform(source, {
    charset: 'utf8',
    legalComments: 'none',
    minify: true,
    sourcefile: path.basename(inputFile),
    target: 'es2019',
  });

  fs.writeFileSync(outputFile, result.code, 'utf8');
  fs.writeFileSync(metadataFile, JSON.stringify({
    package: bundle.packageName,
    version: require(packageFile).version,
    target: 'es2019',
    source: bundle.source,
  }, null, 2) + '\n', 'utf8');

  process.stdout.write('Built ' + path.relative(projectRoot, outputFile) + '\n');
}

async function build() {
  for (const bundle of bundles) {
    await buildBundle(bundle);
  }
}

build().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
