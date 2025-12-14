(function() {
  function init() {
    if (typeof window === 'undefined') return;
    if (!window.app) window.app = {};

    function parseSharedStrings(xmlText) {
      var result = [];
      if (!xmlText) return result;
      try {
        var parser = new DOMParser();
        var doc = parser.parseFromString(String(xmlText), 'application/xml');
        var sis = doc.getElementsByTagName('si');
        for (var i = 0; i < sis.length; i += 1) {
          var si = sis[i];
          if (!si) continue;
          var texts = si.getElementsByTagName('t');
          var parts = [];
          for (var j = 0; j < texts.length; j += 1) {
            parts.push(texts[j] && texts[j].textContent ? texts[j].textContent : '');
          }
          result.push(parts.join(''));
        }
      } catch (err) {
        return result;
      }
      return result;
    }

    function colLettersToIndex(letters) {
      var str = String(letters || '').toUpperCase();
      var idx = 0;
      for (var i = 0; i < str.length; i += 1) {
        var code = str.charCodeAt(i);
        if (code < 65 || code > 90) continue;
        idx = idx * 26 + (code - 64);
      }
      return idx - 1;
    }

    function parseSheetToRows(xmlText, sharedStrings) {
      var rows = [];
      if (!xmlText) return rows;
      try {
        var parser = new DOMParser();
        var doc = parser.parseFromString(String(xmlText), 'application/xml');
        var rowNodes = doc.getElementsByTagName('row');
        for (var i = 0; i < rowNodes.length; i += 1) {
          var row = rowNodes[i];
          if (!row) continue;
          var cells = row.getElementsByTagName('c');
          var maxCol = -1;
          var map = {};
          for (var j = 0; j < cells.length; j += 1) {
            var cell = cells[j];
            if (!cell) continue;
            var ref = cell.getAttribute('r') || '';
            var m = ref.match(/^([A-Z]+)\d+$/i);
            if (!m) continue;
            var colIdx = colLettersToIndex(m[1]);
            if (colIdx < 0) continue;
            if (colIdx > maxCol) maxCol = colIdx;
            var t = (cell.getAttribute('t') || '').toLowerCase();
            var value = '';
            if (t === 'inlinestr') {
              var ts = cell.getElementsByTagName('t');
              var parts = [];
              for (var k = 0; k < ts.length; k += 1) {
                parts.push(ts[k] && ts[k].textContent ? ts[k].textContent : '');
              }
              value = parts.join('');
            } else if (t === 's') {
              var vNode = cell.getElementsByTagName('v')[0];
              var idx2 = vNode && vNode.textContent ? Number(String(vNode.textContent).trim()) : NaN;
              if (!isNaN(idx2) && sharedStrings && sharedStrings.length && sharedStrings[idx2] !== undefined) {
                value = sharedStrings[idx2];
              } else {
                value = '';
              }
            } else {
              var v = cell.getElementsByTagName('v')[0];
              if (v && v.textContent !== undefined && v.textContent !== null) value = v.textContent;
              else {
                var t2 = cell.getElementsByTagName('t')[0];
                value = t2 && t2.textContent ? t2.textContent : '';
              }
            }
            map[String(colIdx)] = value;
          }
          if (maxCol < 0) continue;
          var rowArr = [];
          for (var c = 0; c <= maxCol; c += 1) {
            rowArr[c] = map[String(c)] !== undefined ? map[String(c)] : '';
          }
          rows.push(rowArr);
        }
      } catch (err) {
        return rows;
      }
      return rows;
    }

    function parseXlsxFileToRows(file) {
      var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
      if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法解析 Excel'));
      if (!file || typeof file.arrayBuffer !== 'function') return Promise.reject(new Error('Excel 文件不可用'));
      var zip = new JSZipCtor();
      return file.arrayBuffer().then(function(buf) {
        return zip.loadAsync(buf);
      }).then(function(z) {
        var shared = null;
        var sharedEntry = z.file('xl/sharedStrings.xml');
        var sharedPromise = sharedEntry
          ? sharedEntry
              .async('string')
              .then(function(txt) { shared = parseSharedStrings(txt); })
              .catch(function() { shared = []; })
          : Promise.resolve();

        return sharedPromise.then(function() {
          var sheetEntry = z.file('xl/worksheets/sheet1.xml');
          if (!sheetEntry) {
            var candidates = [];
            try {
              z.forEach(function(relPath) {
                if (!relPath) return;
                if (String(relPath).indexOf('xl/worksheets/') !== 0) return;
                if (String(relPath).slice(-4).toLowerCase() !== '.xml') return;
                candidates.push(String(relPath));
              });
            } catch (err) {
              candidates = [];
            }
            if (candidates.length) sheetEntry = z.file(candidates[0]);
          }
          if (!sheetEntry) throw new Error('Excel 解析失败：缺少工作表');
          return sheetEntry.async('string').then(function(sheetXml) {
            return parseSheetToRows(sheetXml, shared || []);
          });
        });
      });
    }

    window.app.xlsxCoreApi = {
      parseXlsxFileToRows: parseXlsxFileToRows,
    };
  }

  init();
})();

