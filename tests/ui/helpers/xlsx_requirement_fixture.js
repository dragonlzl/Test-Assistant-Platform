const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// 关系、ZIP 顺序和 XML 节点顺序刻意不同，避免测试仅验证文件枚举顺序。
async function buildXlsxRequirementBuffer(page, options) {
  const opts = options || {};
  const entries = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="png" ContentType="image/png"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet7.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
      + '<Override PartName="/xl/drawings/drawing4.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
      + '</Types>'],
    ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rWorkbook" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'],
    ['xl/worksheets/sheet2.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
      + '<row r="1"><c r="A1" t="inlineStr"><is><t>次表验收开始</t></is></c></row>'
      + '<row r="2"><c r="A2" t="inlineStr"><is><t>次表验收结束</t></is></c></row>'
      + '</sheetData></worksheet>'],
    ['xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="首张需求" sheetId="7" r:id="rFirst"/><sheet name="次张验收" sheetId="2" r:id="rSecond"/></sheets>'
      + '</workbook>'],
    ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rSecond" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
      + '<Relationship Id="rStrings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
      + '<Relationship Id="rFirst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet7.xml"/>'
      + '</Relationships>'],
    ['xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">'
      + '<si><r><t>器灵</t></r><r><t>迭代总览</t></r></si>'
      + '<si><t>获取方式标签</t></si></sst>'],
    ['xl/worksheets/sheet7.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheetData>'
      + '<row r="3"><c r="C3"><f>1+1</f><v>2</v></c><c r="B3" t="b"><v>0</v></c><c r="A3" t="b"><v>1</v></c></row>'
      + '<row r="1"><c r="A1" t="s"><v>0</v></c></row>'
      + '<row r="2"><c r="C2"><v>0</v></c><c r="B2" t="inlineStr"><is><t xml:space="preserve">前置 &amp; 条件\n进入器灵界面</t></is></c><c r="A2" t="s"><v>1</v></c></row>'
      + '</sheetData><mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells><drawing r:id="rDrawing"/>'
      + '</worksheet>'],
    ['xl/worksheets/_rels/sheet7.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing4.xml"/>'
      + '</Relationships>'],
    ['xl/drawings/drawing4.xml', '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<xdr:twoCellAnchor><xdr:from><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
      + '<xdr:to><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>'
      + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="器灵界面示意"/><xdr:cNvPicPr/></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:embed="rPicture"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
      + '<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>'
      + '</xdr:wsDr>'],
    ['xl/drawings/_rels/drawing4.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rPicture" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image6.png"/>'
      + '</Relationships>'],
  ];
  const bytes = await page.evaluate(async (payload) => {
    var zip = new window.JSZip();
    payload.entries.forEach(function(entry) { zip.file(entry[0], entry[1]); });
    zip.file('xl/media/image6.png', payload.pngBase64, { base64: true });
    return Array.from(await zip.generateAsync({ type: 'uint8array' }));
  }, {
    entries: entries,
    pngBase64: typeof opts.imageBase64 === 'string'
      ? opts.imageBase64
      : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bB9sAAAAASUVORK5CYII=',
  });
  return Buffer.from(bytes);
}

module.exports = { XLSX_MIME_TYPE, buildXlsxRequirementBuffer };
