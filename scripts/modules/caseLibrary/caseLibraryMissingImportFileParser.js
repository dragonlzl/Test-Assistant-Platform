(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingImportFileParser = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var getCore = typeof opts.getCore === 'function' ? opts.getCore : function() { return null; };
    var buildFromXmindPaths = typeof opts.buildFromXmindPaths === 'function'
      ? opts.buildFromXmindPaths
      : function() { return { items: [], structuralErrors: [] }; };
    var parseXlsxRows = typeof opts.parseXlsxRows === 'function'
      ? opts.parseXlsxRows
      : function() { return Promise.resolve([]); };
    var buildFromXlsxRows = typeof opts.buildFromXlsxRows === 'function'
      ? opts.buildFromXlsxRows
      : function() { return []; };
    var validateHeaderRow = typeof opts.validateHeaderRow === 'function'
      ? opts.validateHeaderRow
      : function() { return { ok: true, missing: [] }; };

    function parse(file) {
      if (!file) return Promise.resolve({ items: [], structuralErrors: [], error: '文件不可用' });
      var name = file.name ? String(file.name) : '';
      var ext = (name.split('.').pop() || '').toLowerCase();
      if (ext !== 'xmind' && ext !== 'xlsx') {
        return Promise.resolve({ items: [], structuralErrors: [], error: '仅支持导入 .xmind 或 .xlsx 文件' });
      }
      if (ext === 'xmind') {
        var core = getCore();
        if (!core || typeof core.parseXmindFile !== 'function') {
          return Promise.resolve({ items: [], structuralErrors: [], error: '缺少 XMind 解析能力' });
        }
        return core.parseXmindFile(file).then(function(result) {
          var paths = result && Array.isArray(result.paths) ? result.paths : [];
          var rootTitle = result && result.rootTitle ? String(result.rootTitle) : '';
          var mapped = buildFromXmindPaths(paths, rootTitle);
          return {
            items: mapped && Array.isArray(mapped.items) ? mapped.items : [],
            structuralErrors: mapped && Array.isArray(mapped.structuralErrors) ? mapped.structuralErrors : [],
          };
        });
      }
      return parseXlsxRows(file).then(function(rows) {
        if (!rows || !rows.length) {
          return { items: [], structuralErrors: [], error: 'Excel 解析失败：未找到数据' };
        }
        if (!validateHeaderRow(rows[0]).ok) {
          return { items: [], structuralErrors: [], error: 'Excel 表头与漏测用例导出格式不一致' };
        }
        return { items: buildFromXlsxRows(rows || []) };
      });
    }

    return { parse: parse };
  }

  return { create: create };
});
