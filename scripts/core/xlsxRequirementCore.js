(function() {
  var relationshipNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var builtinFormats = {
    1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00',
    9: '0%', 10: '0.00%',
    11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
    14: 'yyyy-mm-dd', 15: 'yyyy-mm-dd', 16: 'mm-dd', 17: 'yyyy-mm',
    18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss',
    22: 'yyyy-mm-dd h:mm', 27: 'yyyy-mm-dd', 28: 'yyyy-mm-dd',
    29: 'yyyy-mm-dd', 30: 'mm-dd', 31: 'yyyy-mm-dd', 32: 'h:mm',
    33: 'h:mm:ss', 34: 'yyyy-mm', 35: 'mm-dd', 36: 'yyyy-mm-dd',
    37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)',
    39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)',
    45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0',
    48: '##0.0E+0', 49: '@',
    50: 'yyyy-mm-dd', 51: 'yyyy-mm-dd', 52: 'yyyy-mm',
    53: 'mm-dd', 54: 'yyyy-mm-dd', 55: 'h:mm', 56: 'h:mm:ss',
    57: 'yyyy-mm', 58: 'mm-dd',
  };
  var imageMimeTypes = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',
    webp: 'image/webp', emf: 'image/emf', wmf: 'image/wmf', ico: 'image/x-icon',
  };

  function children(node, name) {
    var result = [];
    var nodes = node ? node.childNodes : [];
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].nodeType === 1 && nodes[i].localName === name) result.push(nodes[i]);
    }
    return result;
  }

  function descendants(node, name) {
    return Array.prototype.slice.call(node.getElementsByTagNameNS('*', name));
  }

  function first(node, name) {
    return children(node, name)[0] || null;
  }

  function nodeText(node) {
    return node && node.textContent !== undefined ? String(node.textContent) : '';
  }

  function xmlText(value) {
    return String(value || '').replace(/_x([0-9a-f]{4})_/gi, function(match, code) {
      return String.fromCharCode(parseInt(code, 16));
    });
  }

  function richText(node) {
    var text = '';
    var nodes = node ? node.childNodes : [];
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].nodeType !== 1) continue;
      if (nodes[i].localName === 't') text += nodeText(nodes[i]);
      else if (nodes[i].localName === 'r') text += nodeText(first(nodes[i], 't'));
    }
    return xmlText(text);
  }

  function relationshipId(node, attribute) {
    return node.getAttributeNS(relationshipNamespace, attribute || 'id')
      || node.getAttributeNS('http://purl.oclc.org/ooxml/officeDocument/relationships', attribute || 'id')
      || node.getAttribute('r:' + (attribute || 'id')) || '';
  }

  function parseXml(text, path, rootName) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Excel XML 不支持文档实体：' + path);
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (!doc.documentElement || descendants(doc, 'parsererror').length) {
      throw new Error('Excel XML 已损坏：' + path);
    }
    if (rootName && doc.documentElement.localName !== rootName) {
      throw new Error('Excel XML 内容无效：' + path);
    }
    return doc;
  }

  async function readXml(zip, path, rootName, optional) {
    var entry = zip.file(path);
    if (!entry) {
      if (optional) return null;
      throw new Error('Excel 内容缺失：' + path);
    }
    var text = await entry.async('string');
    return parseXml(text, path, rootName);
  }

  // 关系路径仅在 ZIP 内解析，拒绝越出包根目录及 URI。
  function resolvePart(sourcePath, target) {
    var raw = String(target || '').replace(/\\/g, '/');
    if (!raw || /[\u0000-\u001f?#]/.test(raw) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) || raw.indexOf('//') === 0) {
      throw new Error('Excel 内部关系路径无效：' + raw);
    }
    try {
      raw = decodeURIComponent(raw);
    } catch (err) {
      throw new Error('Excel 内部关系路径编码无效：' + raw);
    }
    if (/[\u0000-\u001f?#:\\]/.test(raw) || raw.indexOf('//') === 0) {
      throw new Error('Excel 内部关系路径无效：' + raw);
    }
    var parts = raw.charAt(0) === '/' ? [] : sourcePath.split('/').slice(0, -1);
    raw.split('/').forEach(function(part) {
      if (!part || part === '.') return;
      if (part === '..') {
        if (!parts.length) throw new Error('Excel 内部关系路径越界：' + raw);
        parts.pop();
      } else parts.push(part);
    });
    if (!parts.length) throw new Error('Excel 内部关系路径为空');
    return parts.join('/');
  }

  function relationshipPath(partPath) {
    var split = partPath.lastIndexOf('/');
    return partPath.slice(0, split + 1) + '_rels/' + partPath.slice(split + 1) + '.rels';
  }

  async function readRelationships(zip, partPath, optional) {
    var doc = await readXml(zip, relationshipPath(partPath), 'Relationships', optional);
    var map = Object.create(null);
    if (!doc) return map;
    children(doc.documentElement, 'Relationship').forEach(function(node) {
      var id = node.getAttribute('Id');
      if (!id || map[id]) throw new Error('Excel 关系标识缺失或重复：' + partPath);
      var external = String(node.getAttribute('TargetMode') || '').toLowerCase() === 'external';
      map[id] = {
        type: node.getAttribute('Type') || '',
        external: external,
        path: external ? '' : resolvePart(partPath, node.getAttribute('Target')),
      };
    });
    return map;
  }

  function findRelationship(map, name) {
    var ids = Object.keys(map);
    for (var i = 0; i < ids.length; i += 1) {
      if (map[ids[i]].type.slice(-(name.length + 1)) === '/' + name) return map[ids[i]];
    }
    return null;
  }

  function requireRelationship(map, id, label, type) {
    var relationship = map[id];
    if (!relationship) throw new Error('Excel ' + label + '关系缺失：' + (id || '无标识'));
    if (type && relationship.type.slice(-(type.length + 1)) !== '/' + type) {
      throw new Error('Excel ' + label + '关系类型无效：' + id);
    }
    return relationship;
  }

  async function readSharedStrings(zip, relationship) {
    if (!relationship) return [];
    if (relationship.external) throw new Error('Excel 共享文本不能引用外部文件');
    var doc = await readXml(zip, relationship.path, 'sst');
    return children(doc.documentElement, 'si').map(richText);
  }

  async function readStyles(zip, relationship) {
    if (!relationship) return [];
    if (relationship.external) throw new Error('Excel 样式不能引用外部文件');
    var doc = await readXml(zip, relationship.path, 'styleSheet');
    var custom = Object.create(null);
    children(first(doc.documentElement, 'numFmts'), 'numFmt').forEach(function(node) {
      custom[node.getAttribute('numFmtId')] = node.getAttribute('formatCode') || '';
    });
    return children(first(doc.documentElement, 'cellXfs'), 'xf').map(function(node) {
      var id = node.getAttribute('numFmtId') || '0';
      return custom[id] !== undefined ? custom[id] : (builtinFormats[id] || (id === '0' ? '' : '内置格式 ' + id));
    });
  }

  function pad(value, width) {
    var text = String(value);
    while (text.length < width) text = '0' + text;
    return text;
  }

  function formatDate(number, format, date1904) {
    var cleaned = format.replace(/"[^"]*"|\\.|\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi, '').toLowerCase();
    var elapsed = /\[(h+|m+|s+)\]/.exec(cleaned);
    if (elapsed && number >= 0 && number <= 2958465) {
      var totalSeconds = Math.round(number * 86400);
      var remainingFormat = cleaned.replace(elapsed[0], '');
      if (elapsed[1].charAt(0) === 's') return String(totalSeconds) + ' 秒';
      if (elapsed[1].charAt(0) === 'm') {
        return String(Math.floor(totalSeconds / 60))
          + (/s/.test(remainingFormat) ? ':' + pad(totalSeconds % 60, 2) : ' 分钟');
      }
      var elapsedHours = String(Math.floor(totalSeconds / 3600));
      if (!/[ms]/.test(remainingFormat)) return elapsedHours + ' 小时';
      return elapsedHours + ':' + pad(Math.floor(totalSeconds / 60) % 60, 2)
        + (/s/.test(remainingFormat) ? ':' + pad(totalSeconds % 60, 2) : '');
    }
    var hasDate = /[yd]/.test(cleaned) || (!/[hs]/.test(cleaned) && /m/.test(cleaned));
    var hasTime = /[hs]/.test(cleaned);
    if ((!hasDate && !hasTime) || number < 0 || number > 2958465) return null;
    var wholeDays = Math.floor(number);
    var timeSeconds = Math.round((number - wholeDays) * 86400);
    if (timeSeconds >= 86400) {
      wholeDays += 1;
      timeSeconds = 0;
    }
    var dateText = '';
    if (hasDate) {
      if (!date1904 && wholeDays === 60) dateText = '1900-02-29';
      else {
        var offset = date1904 ? wholeDays : wholeDays - (wholeDays > 60 ? 1 : 0);
        var date = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) + offset * 86400000);
        dateText = pad(date.getUTCFullYear(), 4) + '-' + pad(date.getUTCMonth() + 1, 2) + '-' + pad(date.getUTCDate(), 2);
      }
    }
    if (!hasTime) return dateText;
    var hours = Math.floor(timeSeconds / 3600);
    if (/\[h+\]/.test(cleaned)) hours += wholeDays * 24;
    var timeText = pad(hours, 2) + ':' + pad(Math.floor(timeSeconds / 60) % 60, 2);
    if (/s/.test(cleaned)) timeText += ':' + pad(timeSeconds % 60, 2);
    return dateText ? dateText + ' ' + timeText : timeText;
  }

  function formatNumber(raw, format, date1904) {
    if (!format || !String(raw).trim()) return raw;
    var number = Number(raw);
    if (!isFinite(number)) return raw;
    var dateValue = formatDate(number, format, date1904);
    if (dateValue !== null) return dateValue;
    var note = raw + ' 【数字格式：' + format + '】';
    if (format === '@' || /^general$/i.test(format)) return raw;
    var sections = format.split(';');
    var selected = sections[number < 0 && sections.length > 1 ? 1 : (number === 0 && sections.length > 2 ? 2 : 0)];
    var cleaned = selected.replace(/\[(?:black|blue|cyan|green|magenta|red|white|yellow|color\d+)\]/gi, '').trim();
    var percent = /^([0#]+)(?:\.([0#]+))?(%+)$/.exec(cleaned);
    if (percent) {
      var percentValue = number * Math.pow(100, percent[3].length);
      if (!isFinite(percentValue)) return note;
      return percentValue.toFixed(Math.min((percent[2] || '').length, 10)) + percent[3];
    }
    // 仅转换常见数字格式；复杂会计/单位/科学计数格式保留原值及完整格式说明。
    var simple = /^([#0]+(?:,[#0]+)*)(?:\.([0#]+))?$/.exec(cleaned);
    if (!simple || String(raw).replace(/[^0-9]/g, '').length > 15 || Math.abs(number) >= 1e21) return note;
    var decimals = simple[2] || '';
    if (decimals.length > 10) return note;
    var minDecimals = (decimals.match(/0/g) || []).length;
    var minIntegers = (simple[1].match(/0/g) || []).length;
    var parts = Math.abs(number).toFixed(decimals.length).split('.');
    while (parts[0].length < minIntegers) parts[0] = '0' + parts[0];
    if (simple[1].indexOf(',') !== -1) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var fraction = parts[1] || '';
    while (fraction.length > minDecimals && fraction.charAt(fraction.length - 1) === '0') fraction = fraction.slice(0, -1);
    return (number < 0 ? '-' : '') + parts[0] + (fraction ? '.' + fraction : '');
  }

  function cellValue(cell, context) {
    var type = String(cell.getAttribute('t') || '').toLowerCase();
    var cached = first(cell, 'v');
    var formula = first(cell, 'f');
    var hasCachedValue = cached && (nodeText(cached) !== '' || type === 'str');
    var value = '';
    if (type === 'inlinestr') value = richText(first(cell, 'is'));
    else if (type === 's' && cached) {
      var index = nodeText(cached).trim() ? Number(nodeText(cached)) : NaN;
      if (!Number.isInteger(index) || index < 0 || context.shared[index] === undefined) {
        throw new Error('Excel 单元格共享文本索引无效：' + (cell.getAttribute('r') || '未知地址'));
      }
      value = context.shared[index];
    } else if (cached) {
      value = nodeText(cached);
      if (type === 'b') value = value === '1' ? 'TRUE' : (value === '0' ? 'FALSE' : value);
      else if (type === 'str') value = xmlText(value);
      else if (!type || type === 'n') value = formatNumber(value, context.styles[cell.getAttribute('s') || 0] || '', context.date1904);
    }
    if (formula) {
      var source = nodeText(formula);
      var formulaText = source ? '=' + source : '共享公式' + (formula.getAttribute('si') ? ' ' + formula.getAttribute('si') : '');
      return hasCachedValue
        ? value + ' 【公式缓存结果；' + formulaText + '】'
        : '【公式无缓存结果；' + formulaText + '；未执行计算】';
    }
    return value;
  }

  function columnName(column) {
    var text = '';
    while (column > 0) {
      text = String.fromCharCode(65 + ((column - 1) % 26)) + text;
      column = Math.floor((column - 1) / 26);
    }
    return text;
  }

  function cellAddress(ref) {
    var match = /^\$?([a-z]+)\$?([1-9]\d*)$/i.exec(String(ref || ''));
    if (!match) throw new Error('Excel 单元格地址无效：' + ref);
    var column = 0;
    for (var i = 0; i < match[1].length; i += 1) column = column * 26 + match[1].toUpperCase().charCodeAt(i) - 64;
    var row = Number(match[2]);
    if (column > 16384 || row > 1048576) throw new Error('Excel 单元格地址超出范围：' + ref);
    return { row: row, column: column, ref: columnName(column) + row };
  }

  function readCells(sheet, context) {
    var items = [];
    var nextRow = 1;
    children(first(sheet, 'sheetData'), 'row').forEach(function(row) {
      var rowNumber = Number(row.getAttribute('r') || nextRow);
      if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 1048576) throw new Error('Excel 行号无效');
      nextRow = rowNumber + 1;
      var nextColumn = 1;
      children(row, 'c').forEach(function(cell) {
        var address = cellAddress(cell.getAttribute('r') || columnName(nextColumn) + rowNumber);
        nextColumn = address.column + 1;
        var value = cellValue(cell, context);
        if (value === '') return;
        items.push({ kind: 'cell', row: address.row, column: address.column, ref: address.ref, value: value, order: items.length });
      });
    });
    return items;
  }

  function readMerges(sheet) {
    return children(first(sheet, 'mergeCells'), 'mergeCell').map(function(node) {
      var raw = node.getAttribute('ref') || '';
      var ends = raw.split(':');
      if (ends.length !== 2) throw new Error('Excel 合并范围无效：' + raw);
      var start = cellAddress(ends[0]);
      var end = cellAddress(ends[1]);
      if (end.row < start.row || end.column < start.column) throw new Error('Excel 合并范围无效：' + raw);
      return start.ref + ':' + end.ref;
    });
  }

  function hiddenLayoutNotes(sheet) {
    var hiddenRows = [];
    var hiddenColumns = [];
    children(first(sheet, 'sheetData'), 'row').forEach(function(row) {
      if (/^(1|true)$/i.test(row.getAttribute('hidden') || '') && row.getAttribute('r')) hiddenRows.push(row.getAttribute('r'));
    });
    children(first(sheet, 'cols'), 'col').forEach(function(column) {
      if (!/^(1|true)$/i.test(column.getAttribute('hidden') || '')) return;
      var min = Number(column.getAttribute('min'));
      var max = Number(column.getAttribute('max'));
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 16384) throw new Error('Excel 隐藏列范围无效');
      hiddenColumns.push(columnName(min) + (min === max ? '' : ':' + columnName(max)));
    });
    return (hiddenRows.length ? '隐藏行（内容已保留）：' + hiddenRows.join('、') + '\n' : '')
      + (hiddenColumns.length ? '隐藏列（内容已保留）：' + hiddenColumns.join('、') + '\n' : '');
  }

  async function readContentTypes(zip) {
    var doc = await readXml(zip, '[Content_Types].xml', 'Types');
    var types = { defaults: Object.create(null), overrides: Object.create(null) };
    children(doc.documentElement, 'Default').forEach(function(node) {
      types.defaults[String(node.getAttribute('Extension') || '').toLowerCase()] = node.getAttribute('ContentType') || '';
    });
    children(doc.documentElement, 'Override').forEach(function(node) {
      types.overrides[resolvePart('', node.getAttribute('PartName'))] = node.getAttribute('ContentType') || '';
    });
    return types;
  }

  async function imageBlob(zip, path, types) {
    var entry = zip.file(path);
    if (!entry) throw new Error('Excel 图片内容缺失：' + path);
    var extension = path.split('.').pop().toLowerCase();
    var mime = types.overrides[path] || types.defaults[extension] || imageMimeTypes[extension] || 'application/octet-stream';
    var bytes = await entry.async('uint8array');
    if (!bytes.length) throw new Error('Excel 图片内容为空：' + path);
    return new Blob([bytes], { type: mime });
  }

  function anchorAddress(anchor) {
    var from = first(anchor, 'from');
    if (!from && anchor.localName === 'absoluteAnchor') return { row: 1, column: 1, ref: 'A1', absolute: true };
    if (!from) throw new Error('Excel 浮动图片缺少锚点位置');
    var row = Number(nodeText(first(from, 'row')));
    var column = Number(nodeText(first(from, 'col')));
    if (!first(from, 'row') || !first(from, 'col') || !Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0) {
      throw new Error('Excel 浮动图片锚点无效');
    }
    var rowOffset = Number(nodeText(first(from, 'rowOff')) || 0);
    var columnOffset = Number(nodeText(first(from, 'colOff')) || 0);
    if (!Number.isFinite(rowOffset) || !Number.isFinite(columnOffset) || rowOffset < 0 || columnOffset < 0) {
      throw new Error('Excel 浮动图片锚点偏移无效');
    }
    var address = cellAddress(columnName(column + 1) + (row + 1));
    address.rowOffset = rowOffset;
    address.columnOffset = columnOffset;
    return address;
  }

  async function readDrawingItems(zip, sheet, sheetPath, types) {
    var items = [];
    var drawings = children(sheet, 'drawing');
    var backgrounds = children(sheet, 'picture');
    if (!drawings.length && !backgrounds.length) return { items: items, backgroundCount: 0 };
    var sheetRels = await readRelationships(zip, sheetPath);
    for (var d = 0; d < drawings.length; d += 1) {
      var drawingRel = requireRelationship(sheetRels, relationshipId(drawings[d]), '绘图', 'drawing');
      if (drawingRel.external) throw new Error('Excel 工作表绘图引用了外部文件，无法读取');
      var drawing = await readXml(zip, drawingRel.path, 'wsDr');
      var drawingRels = await readRelationships(zip, drawingRel.path, true);
      var anchors = Array.prototype.slice.call(drawing.documentElement.childNodes).filter(function(node) {
        return node.nodeType === 1 && /^(twoCellAnchor|oneCellAnchor|absoluteAnchor)$/.test(node.localName);
      });
      for (var a = 0; a < anchors.length; a += 1) {
        var pictures = descendants(anchors[a], 'pic');
        if (!pictures.length) continue;
        var address = anchorAddress(anchors[a]);
        for (var p = 0; p < pictures.length; p += 1) {
          var blips = descendants(pictures[p], 'blip');
          if (!blips.length) throw new Error('Excel 浮动图片缺少图像引用：' + drawingRel.path);
          var rid = relationshipId(blips[0], 'embed') || relationshipId(blips[0], 'link');
          var rel = requireRelationship(drawingRels, rid, '图片', 'image');
          items.push({
            kind: rel.external ? 'externalImage' : 'image',
            row: address.row, column: address.column, ref: address.ref, absolute: address.absolute,
            rowOffset: address.rowOffset || 0, columnOffset: address.columnOffset || 0,
            rid: rid, mediaPath: rel.path, blob: rel.external ? null : await imageBlob(zip, rel.path, types),
            order: items.length,
          });
        }
      }
    }
    for (var b = 0; b < backgrounds.length; b += 1) {
      requireRelationship(sheetRels, relationshipId(backgrounds[b]), '背景图片', 'image');
    }
    return { items: items, backgroundCount: backgrounds.length };
  }

  function appendText(segments, text) {
    var previous = segments[segments.length - 1];
    if (previous && previous.kind === 'text') previous.text += text;
    else segments.push({ kind: 'text', text: text });
  }

  // 单元格和图片共用行列排序，保证正文图片偏移与阅读顺序一致。
  async function parseXlsx(file, JSZipCtor) {
    if (!JSZipCtor || typeof JSZipCtor.loadAsync !== 'function') throw new Error('缺少 Excel 解析能力（JSZip）');
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Excel 文件不可用');
    if (typeof DOMParser === 'undefined') throw new Error('缺少 Excel XML 解析能力');
    var zip;
    try {
      zip = await JSZipCtor.loadAsync(await file.arrayBuffer());
    } catch (err) {
      throw new Error('Excel 文件无法解包，请确认是未加密的 .xlsx 文件');
    }
    var workbookPath = 'xl/workbook.xml';
    var workbook = await readXml(zip, workbookPath, 'workbook');
    var relationships = await readRelationships(zip, workbookPath);
    var types = await readContentTypes(zip);
    var properties = first(workbook.documentElement, 'workbookPr');
    var date1904 = properties && /^(1|true)$/i.test(properties.getAttribute('date1904') || '');
    var context = {
      shared: await readSharedStrings(zip, findRelationship(relationships, 'sharedStrings')),
      styles: await readStyles(zip, findRelationship(relationships, 'styles')),
      date1904: date1904,
    };
    var sheets = children(first(workbook.documentElement, 'sheets'), 'sheet');
    if (!sheets.length) throw new Error('Excel 未包含工作表');
    var segments = [];
    var imageCount = 0;
    var contentCount = 0;
    for (var s = 0; s < sheets.length; s += 1) {
      var sheetName = xmlText(sheets[s].getAttribute('name') || ('工作表 ' + (s + 1)));
      try {
        var relationship = requireRelationship(relationships, relationshipId(sheets[s]), '工作表', 'worksheet');
        if (relationship.external) throw new Error('工作表引用了外部文件');
        var sheetDoc = await readXml(zip, relationship.path, 'worksheet');
        var sheet = sheetDoc.documentElement;
        var cells = readCells(sheet, context);
        var merges = readMerges(sheet);
        var drawing = await readDrawingItems(zip, sheet, relationship.path, types);
        var state = sheets[s].getAttribute('state') || 'visible';
        var stateText = state === 'hidden' ? '隐藏，已保留内容' : (state === 'veryHidden' ? '深度隐藏，已保留内容' : state);
        appendText(segments, (s ? '\n' : '') + '【工作表 ' + (s + 1) + '：' + sheetName + (state !== 'visible' ? '；' + stateText : '') + '】\n');
        if (merges.length) appendText(segments, '合并单元格：' + merges.join('、') + '\n');
        var hiddenNotes = hiddenLayoutNotes(sheet);
        if (hiddenNotes) appendText(segments, hiddenNotes);
        if (drawing.backgroundCount) appendText(segments, '【工作表背景图 ' + drawing.backgroundCount + ' 张，不作为需求插图】\n');
        var items = cells.concat(drawing.items);
        items.sort(function(left, right) {
          return left.row - right.row || left.column - right.column
            || (left.rowOffset || 0) - (right.rowOffset || 0) || (left.columnOffset || 0) - (right.columnOffset || 0)
            || (left.kind === 'cell' ? 0 : 1) - (right.kind === 'cell' ? 0 : 1) || left.order - right.order;
        });
        for (var i = 0; i < items.length; i += 1) {
          var item = items[i];
          if (item.kind === 'cell') {
            appendText(segments, '[' + item.ref + '] ' + item.value + '\n');
            contentCount += 1;
          } else if (item.kind === 'externalImage') {
            appendText(segments, '【外部图片：' + sheetName + '!' + item.ref + '；未读取外部链接】\n');
          } else {
            imageCount += 1;
            contentCount += 1;
            var imageName = '需求插图 ' + imageCount + '：' + sheetName + '!' + item.ref;
            appendText(segments, '【' + imageName + (item.absolute ? '；绝对定位' : '') + '】\n');
            segments.push({ kind: 'image', source: 'xlsx', index: imageCount, name: imageName, rid: item.rid, mediaPath: item.mediaPath, blob: item.blob });
            appendText(segments, '\n');
          }
        }
        if (!items.length) appendText(segments, '【空工作表】\n');
      } catch (err) {
        throw new Error('Excel 工作表“' + sheetName + '”读取失败：' + (err && err.message ? err.message : '内容损坏'));
      }
    }
    if (!contentCount) throw new Error('Excel 未包含可读取的单元格内容或需求插图');
    return {
      text: segments.filter(function(segment) { return segment.kind === 'text'; }).map(function(segment) { return segment.text; }).join(''),
      segments: segments,
    };
  }

  window.app = window.app || {};
  window.app.xlsxRequirementCore = { parseXlsx: parseXlsx };
})();
