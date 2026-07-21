async function clickSemantic(page, selector) {
  const clicked = await page.locator(selector).evaluate((element) => {
    if (!element || typeof element.click !== 'function') return false;
    element.click();
    return true;
  });
  if (!clicked) throw new Error('Semantic VTable target is unavailable: ' + selector);
}

async function clickSemanticLocator(locator) {
  const clicked = await locator.evaluate((element) => {
    if (!element || typeof element.click !== 'function') return false;
    element.click();
    return true;
  });
  if (!clicked) throw new Error('Semantic VTable target is unavailable');
}

async function setSemanticChecked(page, selector, checked) {
  const updated = await page.locator(selector).evaluate((element, nextChecked) => {
    if (!element || typeof element.click !== 'function') return false;
    if (Boolean(element.checked) !== nextChecked) element.click();
    return Boolean(element.checked) === nextChecked;
  }, checked === true);
  if (!updated) throw new Error('Semantic VTable checkbox is unavailable: ' + selector);
}

async function setSemanticValue(page, selector, value, options) {
  const opts = options || {};
  const updated = await page.locator(selector).evaluate((element, payload) => {
    if (!element || !('value' in element)) return false;
    if (typeof element.focus === 'function') element.focus();
    element.value = payload.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    if (payload.blur === true && typeof element.blur === 'function') element.blur();
    return element.value === payload.value;
  }, { value: String(value), blur: opts.blur === true });
  if (!updated) throw new Error('Semantic VTable editor is unavailable: ' + selector);
}

async function focusSemantic(page, selector) {
  const focused = await page.locator(selector).evaluate((element) => {
    if (!element || typeof element.focus !== 'function') return false;
    element.focus();
    return document.activeElement === element;
  });
  if (!focused) throw new Error('Semantic VTable focus target is unavailable: ' + selector);
}

async function readSemanticValues(page, selector) {
  return page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    return 'value' in element ? String(element.value || '') : String(element.textContent || '');
  }));
}

module.exports = {
  clickSemantic,
  clickSemanticLocator,
  setSemanticChecked,
  setSemanticValue,
  focusSemantic,
  readSemanticValues,
};
