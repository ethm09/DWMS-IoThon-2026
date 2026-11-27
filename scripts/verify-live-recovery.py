#!/usr/bin/env python3
"""Exercise the real React error boundary against an isolated throwing component.

Run against local Vite: python3 scripts/verify-live-recovery.py --url http://127.0.0.1:5177
This does not authenticate, mock production identities, call Convex or operate devices.
Requires optional existing Python Playwright and Chromium, not application dependencies.
"""
import argparse
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True)
options = parser.parse_args()
parsed = urlparse(options.url)
if parsed.hostname not in ('127.0.0.1', 'localhost') or parsed.scheme != 'http':
    parser.error('Use only a local Vite origin; this is an isolated component fixture.')

html = '''<!doctype html><html><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
const {useState} = React;
const {createRoot} = ReactDOM;
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;
const {QueryErrorBoundary} = await import('/src/components/query-error-boundary.tsx');
let broken = true;
function QueryResult() {
  if (broken) throw new Error('SYNTHETIC_PRIVATE_ERROR_MUST_NOT_APPEAR');
  return React.createElement('p', {'data-testid':'restored'}, 'Live component restored');
}
function Fixture() {
  const [access, setAccess] = useState('account-a:operator');
  return React.createElement('div', {},
    React.createElement('button', {onClick:()=>{broken=false;}}, 'Restore test service'),
    React.createElement('button', {onClick:()=>{broken=false;setAccess('account-b:viewer');}}, 'Change test access'),
    React.createElement(QueryErrorBoundary, {resetKey:access, fallback:(retry)=>React.createElement('section', {role:'alert'},
      React.createElement('p', {}, 'Device values are hidden'),
      React.createElement('button', {onClick:retry}, 'Retry live view'))}, React.createElement(QueryResult)));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script></body></html>'''
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    fixture_url = options.url.rstrip('/') + '/__isolated_query_recovery_fixture'
    page.route(fixture_url, lambda route: route.fulfill(content_type='text/html', body=html))
    page.goto(fixture_url)
    expect(page.get_by_role('alert')).to_contain_text('Device values are hidden')
    assert 'SYNTHETIC_PRIVATE_ERROR_MUST_NOT_APPEAR' not in page.locator('body').inner_text()
    page.get_by_role('button', name='Restore test service').click()
    page.get_by_role('button', name='Retry live view').click()
    expect(page.get_by_test_id('restored')).to_be_visible()
    expect(page.get_by_role('alert')).to_have_count(0)
    page.reload()
    expect(page.get_by_role('alert')).to_be_visible()
    page.get_by_role('button', name='Change test access').click()
    expect(page.get_by_test_id('restored')).to_be_visible()
    expect(page.get_by_role('alert')).to_have_count(0)
    browser.close()
print('PASS local React recovery: thrown query hidden, raw error absent, retry works, access-key change resets boundary. No Auth0 or hardware result claimed.')
