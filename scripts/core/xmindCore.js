(function() {
  function init(deps) {
    var formatCompactTimestamp = deps && deps.formatCompactTimestamp ? deps.formatCompactTimestamp : function() { return Date.now().toString(); };
    var normalizeRequirementName = deps && deps.normalizeRequirementName ? deps.normalizeRequirementName : function(text) { return text || ''; };
    var getRequirementLabel = deps && deps.getRequirementLabel ? deps.getRequirementLabel : function() { return ''; };
    var getCaseExecutionDisplay = deps && deps.getCaseExecutionDisplay ? deps.getCaseExecutionDisplay : function() { return { label: '' }; };
    var JSZipCtor = (deps && deps.JSZip) || (typeof JSZip !== 'undefined' ? JSZip : null);
    var deriveCaseListFromText = deps && deps.deriveCaseListFromText ? deps.deriveCaseListFromText : function() { return []; };

    function stringifyCaseField(value) {
      if (Array.isArray(value)) {
        var textArr = value
          .map(function(v) {
            var base = v === undefined || v === null ? '' : v;
            return base.toString().trim();
          })
          .filter(Boolean);
        return textArr.join(' / ');
      }
      if (value && typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          return '';
        }
      }
      if (value === undefined || value === null) return '';
      return value.toString().trim();
    }

    function formatXmindNodeValue(value) {
      var text = stringifyCaseField(value);
      if (!text) return '-';
      return text.replace(/\s*\n+\s*/g, ' / ').trim() || '-';
    }

    function buildCaseFieldsForXmind(item, fallbackModule) {
      var moduleName = formatXmindNodeValue(item.module || item.module_name || item['模块'] || fallbackModule || '模块');
      var title = formatXmindNodeValue(item.title || item.case_title || item['用例标题'] || moduleName);
      var priority = formatXmindNodeValue(item.priority || item.level || item['优先级'] || 'P1');
      var preconditions = formatXmindNodeValue(item.preconditions || item.precondition || item['前提条件']);
      var steps = formatXmindNodeValue(item.steps || item.actions || item['操作步骤']);
      var expected = formatXmindNodeValue(item.expected || item.result || item['预期结果']);
      return [moduleName, title, priority, preconditions, steps, expected];
    }

    function generateXmindId() {
      var cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
      if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID().replace(/-/g, '');
      }
      return 'id-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10);
    }

    function createXmindNode(title) {
      return {
        id: generateXmindId(),
        class: 'topic',
        title: title || '-',
        _childIndex: Object.create(null),
      };
    }

    function getOrCreateChildNode(parent, title) {
      var key = title || '-';
      if (!parent._childIndex) parent._childIndex = Object.create(null);
      var child = parent._childIndex[key];
      if (!child) {
        child = createXmindNode(key);
        if (!parent.children) parent.children = { attached: [] };
        parent.children.attached.push(child);
        parent._childIndex[key] = child;
      }
      return child;
    }

    function finalizeXmindNode(node) {
      if (node.children && node.children.attached && node.children.attached.length) {
        node.children.attached.forEach(finalizeXmindNode);
      } else {
        delete node.children;
      }
      delete node._childIndex;
      return node;
    }

    function buildXmindPackageFromCases(cases, moduleTitle, requirementLabel) {
      return new Promise(function(resolve, reject) {
        if (!JSZipCtor) {
          reject(new Error('缺少 JSZip 依赖，无法导出 XMind'));
          return;
        }
        var sanitized = Array.isArray(cases) ? cases.slice() : [];
        if (!sanitized.length) {
          reject(new Error('未找到可转换的用例'));
          return;
        }
        var firstEntry = sanitized[0] || {};
        var baseModuleName = formatXmindNodeValue(
          firstEntry.module || firstEntry.module_name || firstEntry['模块'] || moduleTitle || '模块'
        );
        var compactTs = formatCompactTimestamp();
        var requirement = normalizeRequirementName(requirementLabel) || getRequirementLabel(true);
        var rootTitle = requirement || (baseModuleName + '_' + compactTs);
        var paths = sanitized.map(function(item) { return buildCaseFieldsForXmind(item, baseModuleName); });
        if (!paths.length) {
          reject(new Error('未找到可转换的字段'));
          return;
        }
        var rootTopic = createXmindNode(rootTitle);
        paths.forEach(function(path) {
          var cursor = rootTopic;
          path.forEach(function(segment) {
            cursor = getOrCreateChildNode(cursor, segment);
          });
        });
        finalizeXmindNode(rootTopic);
        var sheetId = generateXmindId();
        var content = [{
          id: sheetId,
          class: 'sheet',
          title: rootTitle,
          rootTopic: rootTopic,
        }];
        var metadata = {
          dataStructureVersion: '2',
          creator: { name: '用例助手', version: '1.0' },
          activeSheetId: sheetId,
          layoutEngineVersion: '3',
        };
        var manifest = { 'file-entries': { 'content.json': {}, 'metadata.json': {} } };
        var zip = new JSZipCtor();
        zip.file('content.json', JSON.stringify(content, null, 2));
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.generateAsync({ type: 'blob' }).then(function(blob) {
          var safeRoot = (requirement || baseModuleName || 'module').replace(/[\\/:*?"<>|]/g, '_');
          resolve({
            blob: blob,
            fileName: safeRoot + '_' + compactTs + '.xmind',
            count: sanitized.length,
            baseModuleName: baseModuleName,
          });
        }).catch(reject);
      });
    }

    function normalizeTempExecNodeText(text) {
      if (text === undefined || text === null) return '';
      var str = text.toString().trim();
      if (!str) return '';
      return str;
    }

    function getXmindTitle(topic) {
      if (!topic) return '';
      if (typeof topic.title === 'string') return topic.title;
      if (typeof topic.plainTitle === 'string') return topic.plainTitle;
      if (Array.isArray(topic.attributedTitle)) {
        return topic.attributedTitle.map(function(part) { return (part && part.text) || ''; }).join('');
      }
      if (topic && topic.data && typeof topic.data.text === 'string') return topic.data.text;
      return '';
    }

    function getXmindChildren(topic) {
      var res = [];
      var children = topic && topic.children ? topic.children : null;
      if (!children) return res;
      ['attached', 'detached', 'summary', 'callout', 'topic'].forEach(function(key) {
        var group = children[key];
        if (Array.isArray(group)) {
          res.push.apply(res, group);
        } else if (group && typeof group === 'object') {
          res.push.apply(res, Object.values(group));
        }
      });
      return res;
    }

    function normalizeXmindPath(path) {
      if (!Array.isArray(path)) return null;
      var cleanPath = path.filter(Boolean);
      if (cleanPath.length < 6) return null;
      var trimmed = cleanPath.slice(-6);
      if (trimmed.length < 6) return null;
      return {
        module: trimmed[0] || '',
        title: trimmed[1] || '',
        priority: trimmed[2] || '',
        preconditions: trimmed[3] || '',
        steps: trimmed[4] || '',
        expected: trimmed[5] || '',
      };
    }

    function buildCaseListFromXmindJson(json) {
      var sheets = [];
      if (Array.isArray(json)) sheets.push.apply(sheets, json);
      if (json && Array.isArray(json.sheets)) sheets.push.apply(sheets, json.sheets);
      if (json && json.sheet) sheets.push(json.sheet);
      if (json && json.rootTopic) sheets.push(json);
      var paths = [];
      var walk = function(topic, path) {
        var currentPath = path || [];
        if (!topic) return;
        var title = getXmindTitle(topic);
        var nextPath = title ? currentPath.concat(title) : currentPath;
        var children = getXmindChildren(topic);
        if (!children.length) {
          paths.push(nextPath);
          return;
        }
        children.forEach(function(child) { walk(child, nextPath); });
      };
      sheets.forEach(function(sheet) {
        if (sheet && sheet.rootTopic) walk(sheet.rootTopic, []);
      });
      return paths.map(normalizeXmindPath).filter(Boolean);
    }

    function extractXmindTopicsFromXml(xmlText) {
      try {
        var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        var titles = Array.prototype.slice.call(doc.getElementsByTagName('title'));
        return titles.map(function(t) { return '- ' + (t.textContent || '').trim(); }).join('\n');
      } catch (err) {
        console.warn('XMind XML 解析失败', err);
        return xmlText;
      }
    }

    async function parseXmindFile(file) {
      if (!JSZipCtor) throw new Error('缺少 JSZip 依赖，无法解析 XMind');
      var buffer = await file.arrayBuffer();
      var zip = await JSZipCtor.loadAsync(buffer);
      var jsonEntry = zip.file(/content.*\.json$/i)[0];
      if (jsonEntry) {
        try {
          var json = JSON.parse(await jsonEntry.async('string'));
          var cases = buildCaseListFromXmindJson(json);
          if (cases.length) {
            return { text: JSON.stringify(cases, null, 2), list: cases };
          }
          var outline = buildXmindOutlineFromJson(json);
          return { text: outline, list: deriveCaseListFromText(outline) };
        } catch (err) {
          console.warn('XMind JSON 解析失败', err);
        }
      }
      var xmlEntry = zip.file(/content.*\.xml$/i)[0];
      if (xmlEntry) {
        var xml = await xmlEntry.async('string');
        var outlineXml = extractXmindTopicsFromXml(xml);
        return { text: outlineXml, list: deriveCaseListFromText(outlineXml) };
      }
      var fallback = await file.text();
      return { text: fallback, list: deriveCaseListFromText(fallback) };
    }

    function buildXmindOutlineFromJson(json) {
      var sheets = [];
      if (Array.isArray(json)) sheets.push.apply(sheets, json);
      if (json && Array.isArray(json.sheets)) sheets.push.apply(sheets, json.sheets);
      if (json && json.sheet) sheets.push(json.sheet);
      if (json && json.rootTopic) sheets.push(json);
      var lines = [];
      var walk = function(topic, depth) {
        var currentDepth = depth || 0;
        if (!topic) return;
        var title = getXmindTitle(topic);
        if (title) lines.push(Array(currentDepth + 1).join('  ') + '- ' + title);
        getXmindChildren(topic).forEach(function(child) { walk(child, currentDepth + 1); });
      };
      sheets.forEach(function(sheet) {
        if (sheet && sheet.rootTopic) walk(sheet.rootTopic, 0);
      });
      return lines.join('\n');
    }

    function buildTempExecXmindPackage(file, requirementLabel) {
      return new Promise(function(resolve, reject) {
        if (!JSZipCtor) {
          reject(new Error('缺少 JSZip 依赖，无法导出 XMind'));
          return;
        }
        if (!file || !Array.isArray(file.cases) || !file.cases.length) {
          reject(new Error('未找到可导出的执行用例'));
          return;
        }
        var requirement = normalizeRequirementName(requirementLabel || file.requirement || getRequirementLabel(true)) || '';
        var rootTitle = requirement || (file.name || '用例执行');
        var rootTopic = createXmindNode(rootTitle);
        var compactTs = formatCompactTimestamp();
        var safeReq = (requirement || 'temp_exec').replace(/[\\/:*?"<>|]/g, '_');
        var safeName = (file.name || 'usecase').replace(/[\\/:*?"<>|]/g, '_');
        var ensurePath = function(segments) {
          if (!segments || !segments.length) return;
          var cursor = rootTopic;
          segments.forEach(function(seg) {
            cursor = getOrCreateChildNode(cursor, seg);
          });
        };
        file.cases.forEach(function(item, idx) {
          var basePath = buildCaseFieldsForXmind(item, (item && item.module) || ('模块' + (idx + 1)));
          ensurePath(basePath);
          var expectedPath = basePath;
          var reuseEnabled = Boolean(file.reuseEnabled);
          var remarkText = normalizeTempExecNodeText(item && item.remark);
          var defectList = Array.isArray(item && item.defectLinks) ? item.defectLinks : [];
          if (reuseEnabled) {
            var details = Array.isArray(item && item.reuseDetails) ? item.reuseDetails : [];
            if (details.length) {
              details.forEach(function(detail, detailIdx) {
                var contentLabelBase = normalizeTempExecNodeText(detail && detail.text);
                var contentLabel = formatXmindNodeValue(contentLabelBase || ('执行子项' + (detailIdx + 1)));
                var contentPath = expectedPath.concat(contentLabel);
                ensurePath(contentPath);
                var statusLabel = formatXmindNodeValue(detail && detail.status ? detail.status : '未执行');
                var statusPath = contentPath.concat(statusLabel);
                ensurePath(statusPath);
                var noteText = normalizeTempExecNodeText(detail && detail.note);
                if (noteText) {
                  ensurePath(statusPath.concat(formatXmindNodeValue(noteText)));
                }
              });
            } else {
              var aggregated = getCaseExecutionDisplay(file, item).label || '未执行';
              var actualPath = expectedPath.concat(formatXmindNodeValue(aggregated));
              ensurePath(actualPath);
              if (remarkText) {
                ensurePath(actualPath.concat(formatXmindNodeValue(remarkText)));
              }
              defectList.forEach(function(link, linkIdx) {
                var urlText = normalizeTempExecNodeText(link && link.url);
                if (!urlText) return;
                var labelPrefix = defectList.length > 1 ? ('缺陷链接' + (linkIdx + 1)) : '缺陷链接';
                ensurePath(actualPath.concat(labelPrefix + '：' + formatXmindNodeValue(urlText)));
              });
            }
            if (remarkText) {
              ensurePath(expectedPath.concat(formatXmindNodeValue(remarkText)));
            }
            defectList.forEach(function(link, linkIdx) {
              var urlText = normalizeTempExecNodeText(link && link.url);
              if (!urlText) return;
              var labelPrefix = defectList.length > 1 ? ('缺陷链接' + (linkIdx + 1)) : '缺陷链接';
              ensurePath(expectedPath.concat(labelPrefix + '：' + formatXmindNodeValue(urlText)));
            });
          } else {
            var statusLabel = item && item.actual ? item.actual : '未执行';
            var actualPath2 = expectedPath.concat(formatXmindNodeValue(statusLabel));
            ensurePath(actualPath2);
            if (remarkText) {
              ensurePath(actualPath2.concat(formatXmindNodeValue(remarkText)));
            }
            defectList.forEach(function(link, linkIdx) {
              var urlText = normalizeTempExecNodeText(link && link.url);
              if (!urlText) return;
              var labelPrefix = defectList.length > 1 ? ('缺陷链接' + (linkIdx + 1)) : '缺陷链接';
              ensurePath(actualPath2.concat(labelPrefix + '：' + formatXmindNodeValue(urlText)));
            });
          }
        });
        finalizeXmindNode(rootTopic);
        var sheetId = generateXmindId();
        var content = [{
          id: sheetId,
          class: 'sheet',
          title: rootTitle,
          rootTopic: rootTopic,
        }];
        var metadata = {
          dataStructureVersion: '2',
          creator: { name: '用例助手', version: '1.0' },
          activeSheetId: sheetId,
          layoutEngineVersion: '3',
        };
        var manifest = { 'file-entries': { 'content.json': {}, 'metadata.json': {} } };
        var zip = new JSZipCtor();
        zip.file('content.json', JSON.stringify(content, null, 2));
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.generateAsync({ type: 'blob' }).then(function(blob) {
          resolve({
            blob: blob,
            fileName: 'tempexec_' + safeReq + '_' + safeName + '_' + compactTs + '.xmind',
            count: file.cases.length,
          });
        }).catch(reject);
      });
    }

    return {
      formatXmindNodeValue: formatXmindNodeValue,
      buildCaseFieldsForXmind: buildCaseFieldsForXmind,
      generateXmindId: generateXmindId,
      createXmindNode: createXmindNode,
      getOrCreateChildNode: getOrCreateChildNode,
      finalizeXmindNode: finalizeXmindNode,
      buildXmindPackageFromCases: buildXmindPackageFromCases,
      buildTempExecXmindPackage: buildTempExecXmindPackage,
      parseXmindFile: parseXmindFile,
      buildXmindOutlineFromJson: buildXmindOutlineFromJson,
      buildCaseListFromXmindJson: buildCaseListFromXmindJson,
    };
  }

  window.app = window.app || {};
  window.app.xmindCore = { init: init };
})();
