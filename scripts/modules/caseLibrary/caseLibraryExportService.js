(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.exportService = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var escapeXmlText = typeof opts.escapeXmlText === 'function'
      ? opts.escapeXmlText
      : function(value) { return String(value || ''); };
    var escapeXmlTextPreserve = typeof opts.escapeXmlTextPreserve === 'function'
      ? opts.escapeXmlTextPreserve
      : escapeXmlText;
    var getDocument = typeof opts.getDocument === 'function'
      ? opts.getDocument
      : function() { return typeof document !== 'undefined' ? document : null; };
    var scheduleDelay = typeof opts.scheduleDelay === 'function'
      ? opts.scheduleDelay
      : function(callback, delay) { return setTimeout(callback, delay); };
    var loading = { jszip: null, xmindCore: null };

    function getJsZipCtor() {
      if (typeof opts.getJsZip === 'function') return opts.getJsZip();
      if (typeof JSZip !== 'undefined') return JSZip;
      if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
      return null;
    }

    function getXmindApi() {
      if (typeof opts.getXmindApi === 'function') return opts.getXmindApi();
      if (typeof window === 'undefined' || !window.app) return null;
      return window.app.xmindCoreApi || window.app.xmindCore || null;
    }

    function hasJsZip() {
      return Boolean(getJsZipCtor());
    }

    function hasXmindBuilder() {
      var api = getXmindApi();
      return Boolean(api && typeof api.buildXmindPackageFromCases === 'function');
    }

    function loadScriptWithRetry(key, baseSrc, isReady, maxAttempts) {
      var attempts = Number(maxAttempts);
      if (!isFinite(attempts) || attempts <= 0) attempts = 2;
      if (typeof isReady === 'function' && isReady()) return Promise.resolve(true);
      if (loading[key]) return loading[key];

      function appendOnce() {
        return new Promise(function(resolve) {
          var doc = getDocument();
          if (!doc || !doc.createElement) return resolve(false);
          var script = doc.createElement('script');
          var sep = String(baseSrc).indexOf('?') === -1 ? '?' : '&';
          script.src = String(baseSrc) + sep + 'ts=' + Date.now();
          script.async = true;
          script.setAttribute('data-case-lib-dyn', key);
          script.onload = function() { resolve(true); };
          script.onerror = function() { resolve(false); };
          (doc.head || doc.documentElement || doc.body).appendChild(script);
        });
      }

      function attempt(index) {
        return appendOnce().then(function() {
          if (typeof isReady === 'function' && isReady()) return true;
          if (index >= attempts) return false;
          return new Promise(function(resolve) {
            scheduleDelay(resolve, 220 + index * 260);
          }).then(function() {
            return attempt(index + 1);
          });
        });
      }

      loading[key] = attempt(0).finally(function() {
        if (typeof isReady === 'function' && !isReady()) loading[key] = null;
      });
      return loading[key];
    }

    function ensureReady() {
      var chain = Promise.resolve(true);
      if (!hasJsZip()) {
        chain = chain.then(function() {
          return loadScriptWithRetry('jszip', './scripts/vendor/jszip.min.js', hasJsZip, 2);
        });
      }
      if (!hasXmindBuilder()) {
        chain = chain.then(function() {
          return loadScriptWithRetry('xmindCore', './scripts/core/xmindCore.js', hasXmindBuilder, 2);
        });
      }
      return chain;
    }

    function getXmindBuilder() {
      var api = getXmindApi();
      return api && typeof api.buildXmindPackageFromCases === 'function'
        ? api.buildXmindPackageFromCases
        : null;
    }

    function buildSimpleXlsxBlob(options) {
      var JSZipCtor = getJsZipCtor();
      if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法导出 Excel'));
      var sheets = options && Array.isArray(options.sheets) ? options.sheets.filter(Boolean) : [];
      if (!sheets.length) return Promise.reject(new Error('无导出内容'));

      var colCount = 0;
      sheets.forEach(function(sheet) {
        (sheet && Array.isArray(sheet.rows) ? sheet.rows : []).forEach(function(row) {
          if (Array.isArray(row) && row.length > colCount) colCount = row.length;
        });
      });
      if (!colCount) colCount = 1;
      var letters = [];
      for (var i = 0; i < colCount; i += 1) letters.push(String.fromCharCode(65 + i));

      function buildSheetXml(rows) {
        var sheetRowsXml = (Array.isArray(rows) ? rows : []).map(function(row, rowIndex) {
          var rowNumber = rowIndex + 1;
          var cells = letters.map(function(column, columnIndex) {
            var ref = column + rowNumber;
            var value = row && row.length > columnIndex ? row[columnIndex] : '';
            return (
              '<c r="' + ref + '" t="inlineStr">' +
                '<is><t xml:space="preserve">' + escapeXmlTextPreserve(value) + '</t></is>' +
              '</c>'
            );
          }).join('');
          return '<row r="' + rowNumber + '">' + cells + '</row>';
        }).join('');
        return (
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheetData>' + sheetRowsXml + '</sheetData>' +
          '</worksheet>'
        );
      }

      var entries = sheets.map(function(sheet, index) {
        return {
          name: sheet && sheet.name ? String(sheet.name) : ('Sheet' + (index + 1)),
          rows: sheet && Array.isArray(sheet.rows) ? sheet.rows : [[]],
          index: index + 1,
        };
      });
      var workbookSheetsXml = entries.map(function(entry) {
        return '<sheet name="' + escapeXmlText(entry.name) + '" sheetId="' + entry.index + '" r:id="rId' + entry.index + '"/>';
      }).join('');
      var workbookXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets>' + workbookSheetsXml + '</sheets>' +
        '</workbook>';
      var contentTypeOverrides = entries.map(function(entry) {
        return '<Override PartName="/xl/worksheets/sheet' + entry.index + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('');
      var contentTypesXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          contentTypeOverrides +
        '</Types>';
      var relsXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>';
      var workbookRelsXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          entries.map(function(entry) {
            return '<Relationship Id="rId' + entry.index + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + entry.index + '.xml"/>';
          }).join('') +
        '</Relationships>';

      var zip = new JSZipCtor();
      zip.file('[Content_Types].xml', contentTypesXml);
      zip.folder('_rels').file('.rels', relsXml);
      var xl = zip.folder('xl');
      xl.file('workbook.xml', workbookXml);
      xl.folder('_rels').file('workbook.xml.rels', workbookRelsXml);
      var worksheets = xl.folder('worksheets');
      entries.forEach(function(entry) {
        worksheets.file('sheet' + entry.index + '.xml', buildSheetXml(entry.rows));
      });
      return zip.generateAsync({ type: 'blob', compression: 'STORE' });
    }

    function buildCaseExcelBlob(items, sheetName) {
      var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
      var rows = [header].concat((Array.isArray(items) ? items : []).map(function(item) {
        var current = item || {};
        return [
          current.module || '',
          current.title || '',
          current.priority || '',
          current.precondition || '',
          current.steps || '',
          current.expected || '',
        ];
      }));
      return buildSimpleXlsxBlob({ sheets: [{ name: sheetName || '用例', rows: rows }] });
    }

    function buildReuseTemplateBlob(sheetName) {
      var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
      var headerWithResult = header.concat(['实际结果', '备注', '缺陷链接']);
      var exampleRows = [
        headerWithResult,
        ['登录', '账号密码登录（复用）', 'P1', '已注册账号', '1. 输入账号与密码\n2. 点击登录', '复用场景主行（下一行起为复用子项行）', '失败', '主行备注：实际结果需与子项汇总一致', 'https://example.com/bug/123'],
        ['', '', '', '', '', '子项1：登录成功并进入首页', '通过', '子项1备注：成功路径', ''],
        ['', '', '', '', '', '子项2：账号或密码错误时提示弹窗', '失败', '子项2备注：错误提示文案正确', ''],
        ['支付', '下单支付（复用）', 'P0', '已登录且有余额', '1. 选择商品\n2. 点击支付\n3. 完成支付', '复用场景主行（下一行起为复用子项行）', '通过', '主行备注：全部子项通过则主行为“通过”', ''],
        ['', '', '', '', '', '子项1：余额支付成功并扣减余额', '通过', '子项1备注：余额扣减正确', ''],
        ['', '', '', '', '', '子项2：重复点击支付按钮不重复下单', '通过', '子项2备注：幂等校验通过', ''],
      ];
      return buildSimpleXlsxBlob({
        sheets: [
          { name: sheetName || '用例导入模板（复用）', rows: [header] },
          { name: '示例（执行页带结果，不参与导入）', rows: exampleRows },
        ],
      });
    }

    return {
      hasJsZip: hasJsZip,
      hasXmindBuilder: hasXmindBuilder,
      loadScriptWithRetry: loadScriptWithRetry,
      ensureReady: ensureReady,
      getXmindBuilder: getXmindBuilder,
      buildSimpleXlsxBlob: buildSimpleXlsxBlob,
      buildCaseExcelBlob: buildCaseExcelBlob,
      buildReuseTemplateBlob: buildReuseTemplateBlob,
    };
  }

  return { create: create };
});
