import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

async function run() {
  try {
    const scanPath = core.getInput('path') || '.';
    const failOnError = core.getInput('fail-on-error') === 'true';
    
    let risksFound = 0;
    const files = findYmlFiles(scanPath);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      try {
        const data = yaml.load(content) as any;
        const risks = scanForRisks(data, file);
        risksFound += risks.length;
        
        for (const risk of risks) {
          core.error(`Security Risk in ${file}: ${risk}`);
        }
      } catch (e) {
        core.warning(`Could not parse YAML in ${file}: ${e}`);
      }
    }

    core.setOutput('risks-found', risksFound);
    
    if (risksFound > 0 && failOnError) {
      core.setFailed(`Found ${risksFound} security risks.`);
    } else if (risksFound > 0) {
      core.warning(`Found ${risksFound} security risks.`);
    } else {
      core.info('No security risks found.');
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

function scanForRisks(data: any, fileName: string): string[] {
  const risks: string[] = [];
  
  // Pattern for unsanitized github context in run steps
  const injectionPattern = /\$\\{\\{\s*github\.event\..*?\\\}\s*\}/;

  // Simple recursive scan for 'run' keys
  function traverse(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    
    if (obj.run && typeof obj.run === 'string') {
      if (injectionPattern.test(obj.run)) {
        risks.push(`Potential script injection in 'run' step: ${obj.run.substring(0, 50)}...`);
      }
    }
    
    for (const key in obj) {
      traverse(obj[key]);
    }
  }

  traverse(data);
  return risks;
}

run();
