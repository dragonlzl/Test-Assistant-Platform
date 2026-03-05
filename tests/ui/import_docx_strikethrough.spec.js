const { test, expect } = require('@playwright/test');

test('导入 DOCX 时忽略删除线内容', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });

  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  await page.evaluate(() => {
    if (!window.JSZip || typeof window.JSZip.loadAsync !== 'function') {
      throw new Error('JSZip 未加载');
    }
    const docXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p>',
      '<w:r><w:t>保留-普通1</w:t></w:r>',
      '<w:r><w:rPr><w:strike/></w:rPr><w:t>废弃-删除线1</w:t></w:r>',
      '<w:r><w:rPr><w:strike w:val="false"/></w:rPr><w:t>保留-关闭删除线</w:t></w:r>',
      '</w:p>',
      '<w:p>',
      '<w:r><w:rPr><w:dstrike/></w:rPr><w:t>废弃-双删除线</w:t></w:r>',
      '<w:r><w:t>保留-普通2</w:t></w:r>',
      '<w:r><w:delText>废弃-修订删除</w:delText></w:r>',
      '</w:p>',
      '</w:body>',
      '</w:document>',
    ].join('');

    window.JSZip.loadAsync = async function() {
      return {
        file: function(path) {
          if (path === 'word/document.xml') {
            return {
              async: async function(type) {
                if (type === 'string') return docXml;
                return '';
              },
            };
          }
          if (path === 'word/_rels/document.xml.rels') {
            return {
              async: async function() {
                return '';
              },
            };
          }
          return null;
        },
      };
    };
  });

  await page.setInputFiles('#fileInput', {
    name: 'requirement.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('mock-docx-binary'),
  });

  await expect(page.locator('#parseStatus')).toContainText('文件读取完成', { timeout: 10000 });

  const importedText = await page.inputValue('#rawText');
  expect(importedText).toContain('保留-普通1');
  expect(importedText).toContain('保留-关闭删除线');
  expect(importedText).toContain('保留-普通2');
  expect(importedText).not.toContain('废弃-删除线1');
  expect(importedText).not.toContain('废弃-双删除线');
  expect(importedText).not.toContain('废弃-修订删除');
});
