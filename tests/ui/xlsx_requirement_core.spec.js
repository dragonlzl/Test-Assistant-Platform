const path = require('path');
const { test, expect } = require('@playwright/test');

const RELATIONSHIP_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bB9sAAAAASUVORK5CYII=';

function relationships(items) {
  return '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + items.map(function(item) {
      return '<Relationship Id="' + item[0] + '" Type="' + RELATIONSHIP_NS + '/' + item[1]
        + '" Target="' + item[2] + '"' + (item[3] ? ' TargetMode="External"' : '') + '/>';
    }).join('') + '</Relationships>';
}

function workbookEntries(sheetXml, options) {
  const opts = options || {};
  return {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="png" ContentType="image/png"/></Types>',
    'xl/workbook.xml': '<workbook xmlns="' + SHEET_NS + '" xmlns:r="' + RELATIONSHIP_NS + '">'
      + (opts.date1904 ? '<workbookPr date1904="1"/>' : '')
      + '<sheets><sheet name="边界需求" sheetId="7" r:id="sheet"' + (opts.hidden ? ' state="hidden"' : '')
      + '/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': relationships([
      ['sheet', 'worksheet', 'worksheets/unusual.xml'],
    ].concat(opts.styles ? [['styles', 'styles', 'formats/styles.xml']] : [])),
    'xl/worksheets/unusual.xml': sheetXml,
  };
}

function worksheet(body) {
  return '<worksheet xmlns="' + SHEET_NS + '" xmlns:r="' + RELATIONSHIP_NS + '">' + body + '</worksheet>';
}

function anchor(id, options) {
  const opts = options || {};
  const type = opts.type || 'oneCellAnchor';
  const position = type === 'absoluteAnchor' ? '<xdr:pos x="0" y="0"/>'
    : '<xdr:from><xdr:col>' + (opts.column === undefined ? 1 : opts.column) + '</xdr:col><xdr:colOff>'
      + (opts.columnOffset || 0) + '</xdr:colOff><xdr:row>' + (opts.row === undefined ? 1 : opts.row)
      + '</xdr:row><xdr:rowOff>' + (opts.rowOffset || 0) + '</xdr:rowOff></xdr:from>';
  return '<xdr:' + type + '>' + position + '<xdr:pic><xdr:blipFill><a:blip r:'
    + (opts.external ? 'link' : 'embed') + '="' + id + '"/></xdr:blipFill></xdr:pic></xdr:' + type + '>';
}

function drawingXml(anchors) {
  return '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"'
    + ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + RELATIONSHIP_NS + '">'
    + anchors.join('') + '</xdr:wsDr>';
}

function imageEntries(anchors, imageRelationships) {
  const entries = workbookEntries(worksheet('<sheetData/><drawing r:id="drawing"/>'));
  entries['xl/worksheets/_rels/unusual.xml.rels'] = relationships([['drawing', 'drawing', '../drawings/mixed.xml']]);
  entries['xl/drawings/mixed.xml'] = drawingXml(anchors);
  entries['xl/drawings/_rels/mixed.xml.rels'] = relationships(imageRelationships);
  return entries;
}

async function parseFixture(page, entries, imagePaths) {
  return page.evaluate(async function(payload) {
    var zip = new window.JSZip();
    Object.keys(payload.entries).forEach(function(name) { zip.file(name, payload.entries[name]); });
    payload.imagePaths.forEach(function(name) { zip.file(name, payload.png, { base64: true }); });
    var file = new File([await zip.generateAsync({ type: 'uint8array' })], 'mock.xlsx');
    try {
      var result = await window.app.xlsxRequirementCore.parseXlsx(file, window.JSZip);
      return {
        text: result.text,
        images: result.segments.filter(function(segment) { return segment.kind === 'image'; }).map(function(segment) {
          return { index: segment.index, name: segment.name, source: segment.source, path: segment.mediaPath, mime: segment.blob.type, size: segment.blob.size };
        }),
      };
    } catch (err) {
      return { error: err && err.message ? err.message : String(err) };
    }
  }, { entries: entries, imagePaths: imagePaths || [], png: PNG });
}

test.beforeEach(async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({ path: path.resolve(__dirname, '../../scripts/vendor/jszip.min.js') });
  await page.addScriptTag({ path: path.resolve(__dirname, '../../scripts/core/xlsxRequirementCore.js') });
});

test('Excel 数字格式保留日期、百分比、前导零、单位、累计时长和公式缓存语义', async ({ page }) => {
  const formats = ['yyyy-mm-dd', '0.00%', '0000', '#,##0&quot;金币&quot;', '#,##0.00', '[m]', '[s]', '[h]:mm:ss'];
  const values = [45292, 0.125, 5, 1234, 1234.5, 1.5, 0.25, 1.5];
  const cells = values.map(function(value, index) {
    return '<c r="' + String.fromCharCode(65 + index) + '1" s="' + index + '"><v>' + value + '</v></c>';
  }).join('');
  const entries = workbookEntries(worksheet('<sheetData><row r="1">' + cells
    + '<c r="I1" s="8"><f>1+1</f><v>2</v></c><c r="J1" s="8"><f>NOW()</f></c>'
    + '<c r="K1" s="8"><f>SUM(A1)</f><v/></c></row></sheetData>'), { styles: true });
  entries['xl/formats/styles.xml'] = '<styleSheet xmlns="' + SHEET_NS + '"><numFmts>'
    + formats.map(function(format, index) { return '<numFmt numFmtId="' + (164 + index) + '" formatCode="' + format + '"/>'; }).join('')
    + '</numFmts><cellXfs>' + formats.map(function(format, index) { return '<xf numFmtId="' + (164 + index) + '"/>'; }).join('')
    + '<xf numFmtId="0"/></cellXfs></styleSheet>';
  const result = await parseFixture(page, entries);
  expect(result.error).toBeUndefined();
  ['[A1] 2024-01-01', '[B1] 12.50%', '[C1] 0005', '[D1] 1234', '#,##0"金币"', '[E1] 1,234.50',
    '[F1] 2160 分钟', '[G1] 21600 秒', '[H1] 36:00:00', '[I1] 2', '公式缓存结果', '=1+1',
    '[J1]', '公式无缓存结果', '=NOW()', '[K1]', '=SUM(A1)', '未执行计算'].forEach(function(expected) {
    expect(result.text).toContain(expected);
  });
  const date1904 = Object.assign({}, entries, {
    'xl/workbook.xml': entries['xl/workbook.xml'].replace('<sheets>', '<workbookPr date1904="1"/><sheets>'),
    'xl/worksheets/unusual.xml': worksheet('<sheetData><row r="1"><c r="A1" s="0"><v>0</v></c></row></sheetData>'),
  });
  expect((await parseFixture(page, date1904)).text).toContain('[A1] 1904-01-01');
});

test('Excel 多种锚点按坐标和偏移排序，保留隐藏内容且背景与外链不混入需求图', async ({ page }) => {
  const requests = [];
  page.on('request', function(request) { requests.push(request.url()); });
  const entries = imageEntries([
    anchor('late', { type: 'twoCellAnchor', rowOffset: 20 }),
    anchor('columnLater', { columnOffset: 20, rowOffset: 10 }),
    anchor('tieFirst', { rowOffset: 10 }),
    anchor('tieSecond', { type: 'twoCellAnchor', rowOffset: 10 }),
    anchor('absolute', { type: 'absoluteAnchor' }),
    anchor('external', { row: 0, column: 10, external: true }),
  ], [
    ['external', 'image', 'https://example.invalid/private-image.png', true],
    ['late', 'image', '../media/late.png'], ['columnLater', 'image', '../media/columnLater.png'],
    ['tieFirst', 'image', '../media/a%20b.png'], ['tieSecond', 'image', '../media/tieSecond.png'],
    ['absolute', 'image', '../media/absolute.png'],
  ]);
  entries['xl/workbook.xml'] = entries['xl/workbook.xml'].replace('sheetId="7"', 'sheetId="7" state="hidden"');
  entries['xl/worksheets/unusual.xml'] = worksheet('<cols><col min="2" max="3" hidden="1"/></cols>'
    + '<sheetData><row r="3" hidden="1"><c r="B3" t="inlineStr"><is><t>隐藏验收要求</t></is></c></row></sheetData>'
    + '<drawing r:id="drawing"/><picture r:id="background"/>');
  entries['xl/worksheets/_rels/unusual.xml.rels'] = relationships([
    ['drawing', 'drawing', '../drawings/mixed.xml'], ['background', 'image', '../media/background.png'],
  ]);
  const result = await parseFixture(page, entries, ['xl/media/late.png', 'xl/media/columnLater.png', 'xl/media/a b.png', 'xl/media/tieSecond.png', 'xl/media/absolute.png']);
  expect(result.error).toBeUndefined();
  expect(result.images.map(function(image) { return image.path; })).toEqual([
    'xl/media/absolute.png', 'xl/media/a b.png', 'xl/media/tieSecond.png', 'xl/media/columnLater.png', 'xl/media/late.png',
  ]);
  result.images.forEach(function(image, index) {
    expect(image.index).toBe(index + 1);
    expect(image.source).toBe('xlsx');
    expect(image.mime).toBe('image/png');
    expect(image.size).toBeGreaterThan(0);
    expect(result.text).toContain(image.name);
    expect(image.name).toContain('边界需求!' + (index === 0 ? 'A1' : 'B2'));
  });
  ['隐藏，已保留内容', '隐藏验收要求', '隐藏行', '隐藏列', 'B:C', '工作表背景图', '不作为需求插图', '外部图片', '未读取外部链接'].forEach(function(expected) {
    expect(result.text).toContain(expected);
  });
  expect(requests).toEqual([]);
});

test('Excel 空表、仅背景或仅外链均不能作为有效需求导入', async ({ page }) => {
  const empty = workbookEntries(worksheet('<dimension ref="A1:XFD1048576"/><sheetData/>'));
  const background = workbookEntries(worksheet('<sheetData/><picture r:id="background"/>'));
  background['xl/worksheets/_rels/unusual.xml.rels'] = relationships([['background', 'image', '../media/background.png']]);
  const external = imageEntries([anchor('external', { external: true })], [['external', 'image', 'https://example.invalid/image.png', true]]);
  const requests = [];
  page.on('request', function(request) { requests.push(request.url()); });
  for (const entries of [empty, background, external]) {
    const result = await parseFixture(page, entries);
    expect(result.error).toContain('未包含可读取的单元格内容或需求插图');
  }
  expect(requests).toEqual([]);
});

test('Excel 损坏 XML、缺失表图关系和越界路径均明确拒绝，不静默漏内容', async ({ page }) => {
  const nonempty = worksheet('<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>有效需求</t></is></c></row></sheetData>');
  const badXml = workbookEntries('<worksheet>');
  const missingSheet = workbookEntries(nonempty);
  delete missingSheet['xl/worksheets/unusual.xml'];
  const missingSheetRelation = workbookEntries(nonempty);
  missingSheetRelation['xl/_rels/workbook.xml.rels'] = relationships([]);
  const missingImageRelation = imageEntries([anchor('image')], []);
  const missingImage = imageEntries([anchor('image')], [['image', 'image', '../media/missing.png']]);
  const traversal = workbookEntries(nonempty);
  traversal['xl/_rels/workbook.xml.rels'] = relationships([['sheet', 'worksheet', '../../outside.xml']]);
  for (const scenario of [
    [badXml, 'XML 已损坏'], [missingSheet, '内容缺失'], [missingSheetRelation, '工作表关系缺失'],
    [missingImageRelation, '图片关系缺失'], [missingImage, '图片内容缺失'], [traversal, '路径越界'],
  ]) {
    const result = await parseFixture(page, scenario[0]);
    expect(result.error).toContain(scenario[1]);
  }
});
