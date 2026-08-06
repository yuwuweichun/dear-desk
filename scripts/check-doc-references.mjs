import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const docsRoot = join(projectRoot, 'docs');
const failures = [];

const walk = (directory) => readdirSync(directory)
  .flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const isExternal = (target) => /^(?:[a-z]+:|#|\/\/)/i.test(target);

const checkTarget = (sourceFile, rawTarget) => {
  const target = rawTarget.split('#')[0].split('?')[0];
  if (!target || isExternal(rawTarget)) return;
  const decodedTarget = decodeURIComponent(target);
  const absoluteTarget = resolve(dirname(sourceFile), decodedTarget);
  if (!existsSync(absoluteTarget)) {
    failures.push(`${relative(projectRoot, sourceFile)} -> missing ${decodedTarget}`);
  }
};

const requiredChangeHeadings = [
  '## 文档信息',
  '## 1. 给阅读者的结论',
  '实施记录',
  '验证结果',
  '文档同步检查',
  '审阅记录',
];

for (const file of walk(docsRoot)) {
  const extension = extname(file);
  if (!['.md', '.html'].includes(extension)) continue;
  const content = readFileSync(file, 'utf8');

  if (extension === '.md') {
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      checkTarget(file, match[1]);
    }
  }

  if (extension === '.html') {
    for (const match of content.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      checkTarget(file, match[1]);
    }
  }

  const relativePath = relative(docsRoot, file);
  if (/^changes\/\d{4}-\d{2}-\d{2}-\d{3}-.+\.md$/.test(relativePath)) {
    for (const heading of requiredChangeHeadings) {
      if (!content.includes(heading)) {
        failures.push(`${relative(projectRoot, file)} -> missing section "${heading}"`);
      }
    }
  }
}

if (failures.length) {
  console.error('Documentation checks failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Documentation checks passed.');
}
