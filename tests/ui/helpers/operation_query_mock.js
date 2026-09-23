// Exercise real server query/summary formatting against each UI fixture, without a live DB.
const { execFileSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
function operationResponse(logs, route) {
  return JSON.parse(execFileSync(path.join(root, '.venv/bin/python'), [path.join(root, 'tests/python/operation_ui_fixture.py')], {
    cwd: root,
    input: JSON.stringify({ logs, endpoint: new URL(route.request().url()).pathname, payload: route.request().postDataJSON() }),
    encoding: 'utf8',
  }));
}
module.exports = { operationResponse };
