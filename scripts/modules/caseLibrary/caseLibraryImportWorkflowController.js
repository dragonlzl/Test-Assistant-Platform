(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.importWorkflowController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var review = opts.reviewController || null;
    if (!review) throw new Error('Case library import review controller is required');

    var parseFile = typeof opts.parseFile === 'function' ? opts.parseFile : function() { return Promise.resolve({ items: [] }); };
    var validateItems = typeof opts.validateItems === 'function' ? opts.validateItems : function() { return []; };
    var sanitizeItems = typeof opts.sanitizeItems === 'function' ? opts.sanitizeItems : function(items) { return items || []; };
    var cleanFileName = typeof opts.cleanFileName === 'function' ? opts.cleanFileName : function(value) { return String(value || ''); };
    var extFromFileName = typeof opts.extFromFileName === 'function' ? opts.extFromFileName : function() { return ''; };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var showToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var renderFileHint = typeof opts.renderFileHint === 'function' ? opts.renderFileHint : function() {};
    var syncConfirmEnabled = typeof opts.syncConfirmEnabled === 'function' ? opts.syncConfirmEnabled : function() {};

    function buildNameList(names, maxCount) {
      var list = Array.isArray(names) ? names.filter(Boolean) : [];
      var max = Number.isFinite(Number(maxCount)) ? Number(maxCount) : 8;
      if (!list.length) return '';
      var head = list.slice(0, max).join('、');
      return list.length > max ? (head + '...（共 ' + list.length + ' 份）') : head;
    }

    function addResult(list, name, reason) {
      list.push({ name: name || '用例', reason: reason || '已跳过' });
    }

    function buildFinalMessage(imported, overwritten, skipped, failed) {
      var lines = [];
      lines.push('导入完成：成功 ' + (imported.length + overwritten.length) + ' 份，跳过 ' + skipped.length + ' 份，失败 ' + failed.length + ' 份');
      if (imported.length) lines.push('入库成功：' + buildNameList(imported, 10));
      if (overwritten.length) lines.push('覆盖导入成功：' + buildNameList(overwritten, 10));
      skipped.slice(0, 6).forEach(function(item) {
        lines.push('跳过 - ' + (item.name || '用例') + '：' + (item.reason || '已跳过'));
      });
      if (skipped.length > 6) lines.push('跳过 - 还有 ' + (skipped.length - 6) + ' 份未展开');
      failed.slice(0, 6).forEach(function(item) {
        lines.push('失败 - ' + (item.name || '用例') + '：' + (item.reason || '失败'));
      });
      if (failed.length > 6) lines.push('失败 - 还有 ' + (failed.length - 6) + ' 份未展开');
      return lines.join('\n');
    }

    function createDiffTask(importState, file, items, error) {
      var payload = error && error.payload ? error.payload : null;
      var fileName = file && file.name ? file.name : '';
      var importedCleanName = cleanFileName(fileName);
      return {
        projectId: importState.projectId,
        versionId: importState.versionId,
        fileName: fileName,
        importItems: items,
        source: file && file.type ? file.type : extFromFileName(fileName),
        error: error,
        cleanName: payload && payload.existing_file_name_clean
          ? String(payload.existing_file_name_clean)
          : (importedCleanName || fileName || '用例'),
      };
    }

    function confirm() {
      var importState = state.importDrawer || {};
      if (!Array.isArray(importState.files) || !importState.files.length) {
        setStatus(dom.importStatus, '请先选择用例文件', 'warn');
        return Promise.resolve(false);
      }
      if (!importState.projectId) {
        setStatus(dom.importStatus, '请先选择项目', 'warn');
        return Promise.resolve(false);
      }
      if (!importState.versionId) {
        setStatus(dom.importStatus, '请先选择版本', 'warn');
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.importCaseFile !== 'function') {
        setStatus(dom.importStatus, '后端导入接口未就绪', 'err');
        return Promise.resolve(false);
      }

      importState.loading = true;
      syncConfirmEnabled();
      setStatus(dom.importStatus, '解析并导入中...', '');

      var importedNames = [];
      var overwrittenNames = [];
      var skippedItems = [];
      var failedItems = [];
      var diffQueue = [];
      var invalidOpened = false;
      var chain = Promise.resolve();

      importState.files.forEach(function(file) {
        chain = chain.then(function() {
          if (invalidOpened) return null;
          return parseFile(file).then(function(parsed) {
            if (invalidOpened) return null;
            var structural = parsed && Array.isArray(parsed.structuralErrors) ? parsed.structuralErrors : [];
            var items = parsed && Array.isArray(parsed.items) ? parsed.items : [];
            var cleanName = cleanFileName(file && file.name ? file.name : '');
            var displayName = cleanName || (file && file.name ? file.name : '用例');
            if (!items.length) {
              addResult(skippedItems, displayName, '未解析到有效用例');
              setStatus(dom.importStatus, '【' + (file && file.name ? file.name : '文件') + '】未解析到有效用例，已跳过', 'warn');
              return null;
            }
            var invalid = validateItems(items);
            if (structural.length || invalid.length) {
              invalidOpened = true;
              review.openInvalid({
                file: file,
                fileName: file.name,
                cleanName: cleanFileName(file.name),
                projectId: importState.projectId,
                versionId: importState.versionId,
                source: file.type || extFromFileName(file.name),
                items: items,
                structuralErrors: structural,
              });
              var hint = structural.length
                ? ('导入发现字段层级不足 ' + structural.length + ' 条（将跳过）；可继续入库其余 ' + items.length + ' 条，或回到 XMind 补齐后重导入')
                : '导入校验失败：请在“格式校验”抽屉补齐必填字段后再确认入库';
              setStatus(dom.importStatus, hint, 'warn');
              setStatus(dom.status, structural.length ? hint : '导入校验失败：请补齐必填字段后再确认入库', 'warn');
              return null;
            }

            function importItems(validItems) {
              return apiClient.importCaseFile({
                project_id: importState.projectId,
                version_id: importState.versionId,
                file_name: file.name,
                source: file.type || extFromFileName(file.name),
                items: sanitizeItems(validItems),
              }).then(function() {
                importedNames.push(displayName);
              }).catch(function(error) {
                var message = error && error.message ? error.message : '导入失败';
                if (message.indexOf('同名') !== -1) {
                  var task = createDiffTask(importState, file, validItems, error);
                  diffQueue.push(task);
                  setStatus(dom.importStatus, message + '：' + task.cleanName + '（已加入差异对比队列）', 'warn');
                  return;
                }
                addResult(failedItems, displayName, message);
                setStatus(dom.importStatus, message, 'err');
              });
            }

            var duplicate = review.buildDuplicateGroups(items);
            if (!duplicate.duplicateCount) return importItems(items);
            return review.confirmDuplicates({
              fileName: file.name,
              total: items.length,
              uniqueCount: duplicate.uniqueItems.length,
              duplicateCount: duplicate.duplicateCount,
              rows: duplicate.rows,
            }).then(function(confirmed) {
              if (!confirmed) {
                addResult(skippedItems, displayName, '已取消导入（包含重复条目）');
                setStatus(dom.importStatus, '已取消导入（包含重复条目）：' + (file && file.name ? file.name : '文件'), 'warn');
                return null;
              }
              return importItems(duplicate.uniqueItems);
            });
          }).catch(function(error) {
            if (invalidOpened) return;
            var message = error && error.message ? error.message : '解析失败';
            addResult(failedItems, cleanFileName(file && file.name ? file.name : '') || '用例', message);
            setStatus(dom.importStatus, message, 'err');
          });
        });
      });

      return chain.then(function() {
        if (invalidOpened || !diffQueue.length) return null;
        setStatus(dom.importStatus, '检测到同名用例冲突 ' + diffQueue.length + ' 份，请依次确认覆盖导入或关闭跳过', 'warn');
        review.startQueue(diffQueue.length);
        var diffChain = Promise.resolve();
        diffQueue.forEach(function(task, index) {
          diffChain = diffChain.then(function() {
            review.setQueueIndex(index);
            setStatus(dom.importStatus, '同名用例已存在，处理差异对比（' + (index + 1) + '/' + diffQueue.length + '）：' + (task.cleanName || '用例'), 'warn');
            return review.openDiffForQueueTask(task).then(function(result) {
              if (result && result.ok) {
                overwrittenNames.push(task.cleanName || cleanFileName(task.fileName));
              } else if (result && result.reason === 'closed') {
                addResult(skippedItems, task.cleanName || cleanFileName(task.fileName), '同名冲突已跳过');
              } else {
                addResult(failedItems, task.cleanName || cleanFileName(task.fileName), result && result.reason ? String(result.reason) : '同名冲突处理失败');
              }
            });
          });
        });
        return diffChain.finally(review.finishQueue);
      }).then(function() {
        if (invalidOpened) return false;
        var message = buildFinalMessage(importedNames, overwrittenNames, skippedItems, failedItems);
        var hasIssues = Boolean(skippedItems.length || failedItems.length);
        setStatus(dom.importStatus, message, hasIssues ? 'warn' : 'ok');
        setStatus(dom.status, message, hasIssues ? 'warn' : 'ok');
        showToast(message, hasIssues ? 'warn' : 'ok', 10000);
        return true;
      }).finally(function() {
        importState.loading = false;
        review.finishQueue();
        if (!invalidOpened && (importedNames.length || overwrittenNames.length) && !skippedItems.length && !failedItems.length) {
          importState.files = [];
          renderFileHint();
          if (dom.importInput) {
            try { dom.importInput.value = ''; } catch (err) {}
          }
        }
        syncConfirmEnabled();
      });
    }

    return {
      buildFinalMessage: buildFinalMessage,
      confirm: confirm,
    };
  }

  return { create: create };
});
