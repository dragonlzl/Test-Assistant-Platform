const assert = require('assert');
const fileParserOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenFileParser.js');

function testPureParsing() {
  assert.strictEqual(
    fileParserOwner.decodeXmlEntities('&lt;tag&gt; &amp; &quot;text&quot; &apos;x&apos;'),
    '<tag> & "text" \'x\''
  );
  const xml = [
    '<w:document>',
    '<w:p><w:r><w:t>第一段 &amp; 内容</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>第二</w:t></w:r><w:r><w:t>段</w:t></w:r></w:p>',
    '</w:document>',
  ].join('');
  assert.strictEqual(fileParserOwner.extractDocxText(xml), '第一段 & 内容\n\n第二段');
  assert.strictEqual(fileParserOwner.extractDocxText('<root> fallback   text </root>'), 'fallback text');
  assert.strictEqual(fileParserOwner.getExtension({ name: 'Requirement.DOCX' }), 'docx');
}

async function testFileReads() {
  let loadedBuffer = null;
  const JSZipCtor = {
    loadAsync: function(buffer) {
      loadedBuffer = buffer;
      return Promise.resolve({
        file: function(path) {
          if (path !== 'word/document.xml') return null;
          return {
            async: function(type) {
              assert.strictEqual(type, 'string');
              return Promise.resolve('<w:p><w:r><w:t>DOCX 内容</w:t></w:r></w:p>');
            },
          };
        },
      });
    },
  };
  const parser = fileParserOwner.create({ getJSZip: function() { return JSZipCtor; } });
  const buffer = { byteLength: 8 };
  const docxText = await parser.read({
    name: 'requirement.docx',
    arrayBuffer: function() { return Promise.resolve(buffer); },
  });
  assert.strictEqual(loadedBuffer, buffer);
  assert.strictEqual(docxText, 'DOCX 内容');

  const plainText = await parser.read({
    name: 'requirement.txt',
    text: function() { return Promise.resolve('普通文本'); },
  });
  assert.strictEqual(plainText, '普通文本');

  const fallbackParser = fileParserOwner.create({ getJSZip: function() { return null; } });
  const fallbackText = await fallbackParser.read({
    name: 'requirement.docx',
    text: function() { return Promise.resolve('fallback'); },
  });
  assert.strictEqual(fallbackText, 'fallback');
}

testPureParsing();
testFileReads()
  .then(function() { console.log('case library AI generation file parser tests passed'); })
  .catch(function(error) {
    console.error(error);
    process.exitCode = 1;
  });
