(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.exportController = api;
  }
})(function() {
  function mapMissingItemsToXmind(items, moduleName) {
    return (Array.isArray(items) ? items : []).map(function(item, index) {
      var current = item || {};
      return {
        module: moduleName,
        title: current.title ? String(current.title) : ('易漏用例' + (index + 1)),
        priority: current.priority ? String(current.priority) : '',
        precondition: current.precondition || '',
        steps: current.steps || '',
        expected: current.expected || '',
      };
    });
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var getSelectedModules = typeof opts.getSelectedModules === 'function' ? opts.getSelectedModules : function() { return []; };
    var getXmindBuilder = typeof opts.getXmindBuilder === 'function' ? opts.getXmindBuilder : function() { return null; };
    var getDownloadBlob = typeof opts.getDownloadBlob === 'function' ? opts.getDownloadBlob : function() { return null; };
    var getJsZip = typeof opts.getJsZip === 'function' ? opts.getJsZip : function() { return null; };
    var sanitizeDownloadName = typeof opts.sanitizeDownloadName === 'function'
      ? opts.sanitizeDownloadName
      : function(name, extension) { return String(name || '') + String(extension || ''); };
    var getMissingModuleName = typeof opts.getMissingModuleName === 'function'
      ? opts.getMissingModuleName
      : function(id) { return '模块#' + id; };
    var buildSimpleXlsxBlob = typeof opts.buildSimpleXlsxBlob === 'function'
      ? opts.buildSimpleXlsxBlob
      : function() { return Promise.reject(new Error('缺少 Excel 导出能力')); };
    var buildCaseExcelBlob = typeof opts.buildCaseExcelBlob === 'function'
      ? opts.buildCaseExcelBlob
      : function() { return Promise.reject(new Error('缺少 Excel 导出能力')); };
    var buildReuseTemplateBlob = typeof opts.buildReuseTemplateBlob === 'function'
      ? opts.buildReuseTemplateBlob
      : function() { return Promise.reject(new Error('缺少 Excel 导出能力')); };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var logOperation = typeof opts.logOperation === 'function' ? opts.logOperation : function() {};
    var logError = typeof opts.logError === 'function' ? opts.logError : function() {};

    function buildMissingExcelBlob(items, sheetName) {
      var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
      var rows = [header].concat((Array.isArray(items) ? items : []).map(function(item) {
        var current = item || {};
        return [
          current.module_name || getMissingModuleName(current.module_id),
          current.title || '',
          current.priority || '',
          current.precondition || '',
          current.steps || '',
          current.expected || '',
        ];
      }));
      return buildSimpleXlsxBlob({ sheets: [{ name: sheetName || '易漏用例', rows: rows }] });
    }

    function exportMissing(format) {
      if (state.missingDrawer && state.missingDrawer.loading) return Promise.resolve(false);
      var modules = getSelectedModules();
      if (!modules.length) {
        setStatus(dom.missingDrawerStatus, '请先勾选要导出的模块', 'warn');
        return Promise.resolve(false);
      }
      var isXmind = format === 'xmind';
      var builder = isXmind ? getXmindBuilder() : null;
      if (isXmind && !builder) {
        setStatus(dom.missingDrawerStatus, '缺少 XMind 导出依赖', 'err');
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') {
        setStatus(dom.missingDrawerStatus, '易漏条目接口未就绪', 'err');
        return Promise.resolve(false);
      }
      var downloadBlob = getDownloadBlob();
      var ZipCtor = getJsZip();
      var isBatch = modules.length > 1;
      var zip = isBatch && ZipCtor ? new ZipCtor() : null;
      var success = 0;
      var fail = 0;
      var label = isXmind ? 'XMind' : 'Excel';
      var extension = isXmind ? '.xmind' : '.xlsx';
      var button = isXmind ? dom.missingDrawerExportXmindBtn : dom.missingDrawerExportExcelBtn;
      if (button) button.disabled = true;
      setStatus(
        dom.missingDrawerStatus,
        isBatch ? ('批量导出 ' + label + '（' + modules.length + '个模块）...') : ('正在导出 ' + label + '...'),
        ''
      );

      var chain = Promise.resolve();
      modules.forEach(function(module) {
        chain = chain.then(function() {
          var moduleName = module && module.name
            ? String(module.name)
            : ('模块#' + (module && module.id ? module.id : ''));
          return apiClient.listMissingModuleItems(module.id).then(function(items) {
            if (isXmind) return builder(mapMissingItemsToXmind(items, moduleName), moduleName, '');
            return buildMissingExcelBlob(items || [], moduleName);
          }).then(function(result) {
            var blob = isXmind ? (result && result.blob) : result;
            if (!blob) throw new Error('无导出内容');
            var fileName = sanitizeDownloadName(moduleName, extension);
            if (zip) zip.file(fileName, blob);
            else downloadBlob(fileName, blob);
            success += 1;
          }).catch(function(error) {
            fail += 1;
            logError(error);
          });
        });
      });

      return chain.then(function() {
        if (!zip) return null;
        if (!success) throw new Error('全部导出失败');
        return zip.generateAsync({ type: 'blob' }).then(function(blob) {
          downloadBlob('易漏用例批量导出_' + format + '.zip', blob);
        });
      }).then(function() {
        setStatus(
          dom.missingDrawerStatus,
          '导出完成：成功 ' + success + ' 个模块，失败 ' + fail + ' 个模块',
          fail ? 'warn' : 'ok'
        );
        return { success: success, fail: fail };
      }).catch(function(error) {
        setStatus(dom.missingDrawerStatus, '导出失败：' + (error && error.message ? error.message : '未知错误'), 'err');
        return { success: success, fail: fail, error: error };
      }).finally(function() {
        if (button) button.disabled = false;
      });
    }

    function downloadImportExcelTemplate() {
      var downloadBlob = getDownloadBlob();
      if (!downloadBlob) return Promise.resolve(false);
      var templateType = dom.importExcelTemplateTypeSelect
        ? String(dom.importExcelTemplateTypeSelect.value || '')
        : 'normal';
      var isReuse = templateType === 'reuse';
      var baseName = isReuse ? '用例导入模板（复用）' : '用例导入模板';
      setStatus(dom.importStatus, '生成 ' + baseName + '中...', '');
      var promise = isReuse ? buildReuseTemplateBlob(baseName) : buildCaseExcelBlob([], baseName);
      return promise.then(function(blob) {
        if (!blob) throw new Error('无导出内容');
        downloadBlob(sanitizeDownloadName(baseName, '.xlsx'), blob);
        setStatus(dom.importStatus, '已导出 ' + baseName, 'ok');
        logOperation('export_case_template_excel', 'case_template', null, {
          format: 'xlsx',
          template_type: isReuse ? 'reuse' : 'normal',
          name: baseName,
        });
        return true;
      }).catch(function(error) {
        setStatus(dom.importStatus, '导出失败：' + (error && error.message ? error.message : '未知错误'), 'err');
        return false;
      });
    }

    function downloadImportXmindTemplate() {
      var builder = getXmindBuilder();
      if (!builder) {
        setStatus(dom.importStatus, '缺少 XMind 导出依赖', 'err');
        return Promise.resolve(false);
      }
      var downloadBlob = getDownloadBlob();
      if (!downloadBlob) return Promise.resolve(false);
      setStatus(dom.importStatus, '生成 XMind 导入模板中...', '');
      var sample = [{
        module: '模块',
        title: '用例标题',
        priority: 'P1',
        precondition: '前提条件（必填）',
        steps: '1. 操作步骤（必填）',
        expected: '预期结果',
        remark: '',
      }];
      return builder(sample, '用例导入模板', '').then(function(result) {
        if (!result || !result.blob) throw new Error('无导出内容');
        downloadBlob(sanitizeDownloadName('用例导入模板', '.xmind'), result.blob);
        setStatus(dom.importStatus, '已导出 XMind 导入模板', 'ok');
        logOperation('export_case_template_xmind', 'case_template', null, {
          format: 'xmind',
          name: '用例导入模板',
        });
        return true;
      }).catch(function(error) {
        setStatus(dom.importStatus, '导出失败：' + (error && error.message ? error.message : '未知错误'), 'err');
        return false;
      });
    }

    return {
      buildMissingExcelBlob: buildMissingExcelBlob,
      exportMissingToXmind: function() { return exportMissing('xmind'); },
      exportMissingToExcel: function() { return exportMissing('excel'); },
      downloadImportExcelTemplate: downloadImportExcelTemplate,
      downloadImportXmindTemplate: downloadImportXmindTemplate,
    };
  }

  return {
    create: create,
    mapMissingItemsToXmind: mapMissingItemsToXmind,
  };
});
