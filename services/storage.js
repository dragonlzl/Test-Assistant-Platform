(function() {
  window.app = window.app || {};
  window.app.services = window.app.services || {};

  function safeParse(text, fallback) {
    if (!text) return fallback;
    try {
      return JSON.parse(text);
    } catch (err) {
      return fallback;
    }
  }

  function getJson(key, fallback) {
    try {
      return safeParse(localStorage.getItem(key), fallback);
    } catch (err) {
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  window.app.services.storage = {
    getJson: getJson,
    setJson: setJson,
    remove: remove,
    safeParse: safeParse,
  };
})();
