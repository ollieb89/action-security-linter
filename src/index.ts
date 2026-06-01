import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { lintAction, LintResult } from './linter';

async function run() {
  try {
    const scanPath = core.getInput('path') || 'action.yml';
    const failOnError = core.getInput('fail-on-error') === 'true';
    
    let allResults: LintResult[] = [];

    if (fs.existsSync(scanPath)) {
      const stats = fs.statSync(scanPath);
      if (stats.isDirectory()) {
        const files = findYmlFiles(scanPath);
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf8');
          allResults = allResults.concat(lintAction(content, file));
        }
      } else {
        const content = fs.readFileSync(scanPath, 'utf8');
        allResults = allResults.concat(lintAction(content, scanPath));
      }
    } else {
      core.warning(`Path not found: ${scanPath}`);
    }

    let errors = 0;
    let warnings = 0;

    for (const res of allResults) {
      const msg = `[${res.severity.toUpperCase()}] ${res.file}${res.path ? ' @ ' + res.path : ''}: ${res.message}`;
      if (res.severity === 'error') {
        core.error(msg);
        errors++;
      } else if (res.severity === 'warning') {
        core.warning(msg);
        warnings++;
      } else {
        core.info(msg);
      }
    }

    core.setOutput('errors', errors);
    core.setOutput('warnings', warnings);
    core.setOutput('results', JSON.stringify(allResults));

    if (errors > 0 && failOnError) {
      core.setFailed(`Found ${errors} security errors.`);
    } else {
      core.info(`Scan complete. Errors: ${errors}, Warnings: ${warnings}`);
    }

  } catch (error: any) {
    core.setFailed(error.message);
  }
}

function findYmlFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (file !== 'node_modules' && !file.startsWith('.')) {
        findYmlFiles(name, fileList);
      }
    } else if (name.endsWith('.yml') || name.endsWith('.yaml')) {
      fileList.push(name);
    }
  }
  return fileList;
}

run();
