import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile,mkdir} from 'node:fs/promises';
async function check(page:Page,name:string){const results=await new AxeBuilder({page}).analyze();await mkdir('../docs/progress/logs',{recursive:true});await writeFile(`../docs/progress/logs/axe-${name}.json`,JSON.stringify({url:results.url,timestamp:results.timestamp,testEngine:results.testEngine,violations:results.violations,passes:results.passes.map(p=>p.id)},null,2));expect(results.violations.filter(v=>['critical','serious'].includes(v.impact??''))).toEqual([]);}
test.beforeEach(async({page})=>{await page.goto('/?demo=1');await expect(page.locator('.flow-node').first()).toBeVisible();});
test('graph, search, modes, inspector keyboard and export modal',async({page})=>{
 await check(page,'canvas');
 await page.getByRole('textbox',{name:'Tìm node'}).fill('login');await page.getByRole('button',{name:'Xóa tìm kiếm'}).click();
 await page.locator('.flow-node').first().click();await expect(page.getByRole('complementary',{name:'Chi tiết node'})).toBeVisible();await check(page,'inspector');await page.keyboard.press('Escape');await expect(page.getByRole('complementary',{name:'Chi tiết node'})).toHaveCount(0);
 await page.getByRole('button',{name:'Kiểm thử',exact:true}).click();await expect(page.getByRole('region',{name:'Độ phủ nhánh'})).toBeVisible();await check(page,'tester');
 await page.getByRole('button',{name:'Export',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await check(page,'export');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.keyboard.press('Alt+4');await expect(page.getByRole('button',{name:'Low-Code',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('snapshot download and import retain graph',async({page})=>{
 await page.getByRole('button',{name:'Export',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Tải file'}).click();const downloaded=await pending;expect(downloaded.suggestedFilename()).toBe('flow.flow.json');
 await page.locator('input[type=file]').setInputFiles((await downloaded.path())!);await expect(page.getByRole('status')).toContainText('Snapshot');await expect(page.locator('.flow-node').first()).toBeVisible();
});
test('invalid snapshot reports recovery action',async({page})=>{await page.locator('input[type=file]').setInputFiles({name:'bad.flow.json',mimeType:'application/json',buffer:Buffer.from('{"graph":null}')});await expect(page.getByRole('alert')).toContainText('Snapshot không hợp lệ');});
