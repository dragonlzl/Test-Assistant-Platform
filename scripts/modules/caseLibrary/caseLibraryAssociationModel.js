(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.associationModel = api;
  }
})(function() {
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function positiveInteger(value) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0 || Math.floor(number) !== number) return null;
    return number;
  }

  function requireId(value, message) {
    var id = positiveInteger(value);
    if (!id) throw new Error(message);
    return id;
  }

  function buildAssociationRowKey(record) {
    var source = record && typeof record === 'object' ? record : {};
    var mainCaseFileId = requireId(
      source.main_case_file_id !== undefined ? source.main_case_file_id : source.mainCaseFileId,
      'Association main case file id is required'
    );
    var associationId = requireId(source.id, 'Association id is required');
    return 'association:' + mainCaseFileId + ':' + associationId;
  }

  function buildCandidateRowKey(record, context) {
    var source = record && typeof record === 'object' ? record : {};
    var options = context && typeof context === 'object' ? context : {};
    var mainCaseFileId = requireId(options.mainCaseFileId, 'Association main case file id is required');
    var candidateId = requireId(source.id, 'Association candidate id is required');
    return 'association-candidate:' + mainCaseFileId + ':' + candidateId;
  }

  function buildItemRowKey(record, context) {
    var source = record && typeof record === 'object' ? record : {};
    var options = context && typeof context === 'object' ? context : {};
    var subCaseFileId = requireId(options.subCaseFileId, 'Association sub case file id is required');
    var itemId = requireId(source.id, 'Association item id is required');
    return 'association-item:' + subCaseFileId + ':' + itemId;
  }

  function normalizeSelectionIds(values) {
    var seen = Object.create(null);
    var result = [];
    (Array.isArray(values) ? values : []).forEach(function(value) {
      var id = positiveInteger(value);
      if (!id || seen[String(id)]) return;
      seen[String(id)] = true;
      result.push(id);
    });
    return result;
  }

  function ensureUniqueRows(rows, label) {
    var seen = Object.create(null);
    rows.forEach(function(row) {
      var key = row && row.rowKey ? String(row.rowKey) : '';
      if (seen[key]) throw new Error(label + ' row key is duplicate: ' + key);
      seen[key] = true;
    });
    return rows;
  }

  function normalizeAssociationRecord(record) {
    var source = record && typeof record === 'object' ? record : {};
    var mainCaseFileId = requireId(source.main_case_file_id, 'Association main case file id is required');
    var associationId = requireId(source.id, 'Association id is required');
    var subCaseFileId = requireId(source.sub_case_file_id, 'Association sub case file id is required');
    var selectedItemIds = normalizeSelectionIds(source.selected_case_item_ids);
    return {
      rowKey: buildAssociationRowKey(source),
      id: associationId,
      mainCaseFileId: mainCaseFileId,
      subCaseFileId: subCaseFileId,
      subCaseName: normalizeText(source.sub_case_file_name),
      selectedItemIds: selectedItemIds,
      selectedCount: selectedItemIds.length,
      createdAt: source.created_at,
      updatedAt: source.updated_at,
    };
  }

  function normalizeAssociationRecords(records) {
    var list = Array.isArray(records) ? records : [];
    var seen = Object.create(null);
    list.forEach(function(record) {
      var key = buildAssociationRowKey(record);
      if (seen[key]) throw new Error('Association row key is duplicate: ' + key);
      seen[key] = true;
    });
    return list.map(normalizeAssociationRecord);
  }

  function normalizeCandidateRecord(record, context) {
    var source = record && typeof record === 'object' ? record : {};
    var options = context && typeof context === 'object' ? context : {};
    var mainCaseFileId = requireId(options.mainCaseFileId, 'Association main case file id is required');
    var candidateId = requireId(source.id, 'Association candidate id is required');
    var selectedCandidateId = positiveInteger(options.selectedCandidateId);
    return {
      rowKey: buildCandidateRowKey(source, options),
      id: candidateId,
      mainCaseFileId: mainCaseFileId,
      projectId: positiveInteger(source.project_id),
      versionId: positiveInteger(source.version_id),
      fileNameClean: normalizeText(source.file_name_clean),
      itemCount: Number(source.item_count) || 0,
      associationCount: Number(source.association_count) || 0,
      forbidden: source.association_forbidden === true,
      forbiddenReason: normalizeText(source.forbidden_reason),
      selected: Boolean(selectedCandidateId && selectedCandidateId === candidateId),
    };
  }

  function normalizeCandidateRecords(records, context) {
    var normalized = (Array.isArray(records) ? records : []).map(function(record) {
      return normalizeCandidateRecord(record, context);
    });
    return ensureUniqueRows(normalized, 'Association candidate');
  }

  function normalizeItemRecord(record, context, index, selectedMap) {
    var source = record && typeof record === 'object' ? record : {};
    var options = context && typeof context === 'object' ? context : {};
    var subCaseFileId = requireId(options.subCaseFileId, 'Association sub case file id is required');
    var itemId = requireId(source.id, 'Association item id is required');
    return {
      rowKey: buildItemRowKey(source, options),
      id: itemId,
      subCaseFileId: subCaseFileId,
      caseFileId: positiveInteger(source.case_file_id),
      index: index + 1,
      module: normalizeText(source.module || source.module_name),
      title: normalizeText(source.title),
      priority: normalizeText(source.priority),
      precondition: normalizeText(source.precondition || source.preconditions),
      steps: normalizeText(source.steps),
      expected: normalizeText(source.expected),
      selected: selectedMap[String(itemId)] === true,
    };
  }

  function normalizeItemRecords(records, context) {
    var options = context && typeof context === 'object' ? context : {};
    var selectedMap = Object.create(null);
    normalizeSelectionIds(options.selectedItemIds).forEach(function(id) {
      selectedMap[String(id)] = true;
    });
    var normalized = (Array.isArray(records) ? records : []).map(function(record, index) {
      return normalizeItemRecord(record, options, index, selectedMap);
    });
    return ensureUniqueRows(normalized, 'Association item');
  }

  function filterCandidateRecords(records, searchText) {
    var list = Array.isArray(records) ? records : [];
    var query = normalizeText(searchText).toLowerCase();
    if (!query) return list.slice();
    return list.filter(function(record) {
      return normalizeText(record && record.fileNameClean).toLowerCase().indexOf(query) !== -1;
    });
  }

  function orderSelectionByItems(items, selectedIds) {
    var selectedMap = Object.create(null);
    normalizeSelectionIds(selectedIds).forEach(function(id) { selectedMap[String(id)] = true; });
    var emitted = Object.create(null);
    var ordered = [];
    (Array.isArray(items) ? items : []).forEach(function(item) {
      var id = positiveInteger(item && item.id);
      var key = id ? String(id) : '';
      if (!id || emitted[key] || selectedMap[key] !== true) return;
      emitted[key] = true;
      ordered.push(id);
    });
    return ordered;
  }

  function positivePageSize(value, fallback) {
    var size = positiveInteger(value);
    return size || fallback;
  }

  function paginate(records, pageIndex, pageSize) {
    var list = Array.isArray(records) ? records : [];
    var size = positivePageSize(pageSize, 20);
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / size));
    var index = Number(pageIndex);
    if (!isFinite(index)) index = 0;
    index = Math.max(0, Math.min(totalPages - 1, Math.floor(index)));
    var start = index * size;
    var end = Math.min(total, start + size);
    return {
      records: list.slice(start, end),
      pageIndex: index,
      pageSize: size,
      total: total,
      totalPages: totalPages,
      start: start,
      end: end,
    };
  }

  function applyCurrentPageSelection(allItems, selectedIds, currentPageItems, checked) {
    var selectedMap = Object.create(null);
    normalizeSelectionIds(selectedIds).forEach(function(id) { selectedMap[String(id)] = true; });
    normalizeSelectionIds((Array.isArray(currentPageItems) ? currentPageItems : []).map(function(item) {
      return item && item.id;
    })).forEach(function(id) {
      if (checked === true) selectedMap[String(id)] = true;
      else delete selectedMap[String(id)];
    });
    return orderSelectionByItems(allItems, Object.keys(selectedMap));
  }

  function getCurrentPageSelectionState(currentPageItems, selectedIds) {
    var pageIds = normalizeSelectionIds((Array.isArray(currentPageItems) ? currentPageItems : []).map(function(item) {
      return item && item.id;
    }));
    var selectedMap = Object.create(null);
    normalizeSelectionIds(selectedIds).forEach(function(id) { selectedMap[String(id)] = true; });
    var selected = pageIds.reduce(function(count, id) {
      return count + (selectedMap[String(id)] ? 1 : 0);
    }, 0);
    var total = pageIds.length;
    return {
      total: total,
      selected: selected,
      checked: total > 0 && selected === total,
      indeterminate: selected > 0 && selected < total,
      disabled: total === 0,
    };
  }

  return {
    normalizeText: normalizeText,
    normalizeSelectionIds: normalizeSelectionIds,
    buildAssociationRowKey: buildAssociationRowKey,
    buildCandidateRowKey: buildCandidateRowKey,
    buildItemRowKey: buildItemRowKey,
    normalizeAssociationRecords: normalizeAssociationRecords,
    normalizeCandidateRecords: normalizeCandidateRecords,
    normalizeItemRecords: normalizeItemRecords,
    filterCandidateRecords: filterCandidateRecords,
    orderSelectionByItems: orderSelectionByItems,
    paginate: paginate,
    applyCurrentPageSelection: applyCurrentPageSelection,
    getCurrentPageSelectionState: getCurrentPageSelectionState,
  };
});
