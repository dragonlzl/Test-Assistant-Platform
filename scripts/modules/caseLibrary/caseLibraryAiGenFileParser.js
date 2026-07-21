(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenFileParser = api;
  }
})(function() {
  function decodeXmlEntities(text) {
    if (!text) return '';
    return String(text)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  function extractDocxText(xmlText) {
    var xml = xmlText === null || xmlText === undefined ? '' : String(xmlText);
    var paragraphs = [];
    xml.replace(/<w:p[\s\S]*?<\/w:p>/g, function(paragraph) {
      var pieces = [];
      paragraph.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, function(_, text) {
        pieces.push(text);
        return '';
      });
      var normalized = decodeXmlEntities(pieces.join('')).replace(/\s+/g, ' ').trim();
      if (normalized) paragraphs.push(normalized);
      return '';
    });
    if (!paragraphs.length) {
      var fallback = decodeXmlEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      if (fallback) paragraphs.push(fallback);
    }
    return paragraphs.join('\n\n');
  }

  function getExtension(file) {
    var name = file && file.name ? String(file.name) : '';
    return name && name.split ? (name.split('.').pop() || '').toLowerCase() : '';
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var getJSZip = typeof opts.getJSZip === 'function' ? opts.getJSZip : function() { return null; };

    function readDocx(file, JSZipCtor) {
      if (!file) return Promise.reject(new Error('未选择文件'));
      return Promise.resolve(file.arrayBuffer())
        .then(function(buffer) { return JSZipCtor.loadAsync(buffer); })
        .then(function(zip) {
          var docFile = zip.file('word/document.xml') || zip.file('word/document2.xml');
          if (!docFile) throw new Error('docx 内容缺失，未找到 word/document.xml');
          return docFile.async('string');
        })
        .then(extractDocxText);
    }

    function read(file) {
      if (!file) return Promise.reject(new Error('未选择文件'));
      var JSZipCtor = getJSZip();
      if (getExtension(file) === 'docx' && JSZipCtor && typeof JSZipCtor.loadAsync === 'function') {
        return readDocx(file, JSZipCtor);
      }
      if (typeof file.text !== 'function') return Promise.reject(new Error('文件内容不可读取'));
      return Promise.resolve(file.text()).then(function(text) { return String(text || ''); });
    }

    return {
      read: read,
      readDocx: readDocx,
    };
  }

  return {
    create: create,
    decodeXmlEntities: decodeXmlEntities,
    extractDocxText: extractDocxText,
    getExtension: getExtension,
  };
});
