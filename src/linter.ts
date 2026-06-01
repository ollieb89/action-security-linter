import * as yaml from 'js-yaml';

export interface LintResult {
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  file?: string;
}

export function lintAction(content: string, fileName: string = 'action.yml'): LintResult[] {
  const results: LintResult[] = [];
  let action: any;

  try {
    action = yaml.load(content);
  } catch (e: any) {
    results.push({ severity: 'error', message: `Failed to parse YAML: ${e.message}`, file: fileName });
    return results;
  }

  if (!action) {
    results.push({ severity: 'error', message: 'Action file is empty', file: fileName });
    return results;
  }

  // Metadata checks
  if (!action.name) results.push({ severity: 'warning', message: 'Missing action name', file: fileName });
  if (!action.description) results.push({ severity: 'warning', message: 'Missing action description', file: fileName });

  const runs = action.runs;
  if (!runs) {
    // might not be an action file, maybe a workflow?
    // let's check if it looks like a workflow
    if (action.jobs || action.on) {
       return lintWorkflow(action, fileName);
    }
    results.push({ severity: 'info', message: 'Not a standard action.yml (missing "runs")', file: fileName });
    return results;
  }

  // Runtime checks
  if (runs.using) {
    if (runs.using === 'node12' || runs.using === 'node16') {
      results.push({ severity: 'error', message: `Deprecated runtime: ${runs.using}. Use node20 instead.`, file: fileName });
    } else if (runs.using.startsWith('node') && runs.using !== 'node20') {
      results.push({ severity: 'warning', message: `Recommended runtime is node20. Found: ${runs.using}`, file: fileName });
    }
  }

  // Shell injection patterns
  const injectionPattern = /\$\{\{\s*(github\.event|inputs)\.[^}]+\s*\}\}/g;

  // Composite action security (shell injection)
  if (runs.using === 'composite' && Array.isArray(runs.steps)) {
    for (let i = 0; i < runs.steps.length; i++) {
      const step = runs.steps[i];
      if (step.run && typeof step.run === 'string') {
        const matches = step.run.match(injectionPattern);
        if (matches) {
          results.push({
            severity: 'error',
            message: `Potential shell injection in step ${i + 1}: Direct use of "${matches.join(', ')}" in "run" script. Use "env" instead.`,
            path: `runs.steps[${i}].run`,
            file: fileName
          });
        }
      }
    }
  }

  return results;
}

function lintWorkflow(workflow: any, fileName: string): LintResult[] {
  const results: LintResult[] = [];
  const injectionPattern = /\$\{\{\s*(github\.event|inputs)\.[^}]+\s*\}\}/g;

  if (workflow.jobs) {
    for (const jobId in workflow.jobs) {
      const job = workflow.jobs[jobId];
      if (Array.isArray(job.steps)) {
        for (let i = 0; i < job.steps.length; i++) {
          const step = job.steps[i];
          if (step.run && typeof step.run === 'string') {
            const matches = step.run.match(injectionPattern);
            if (matches) {
              results.push({
                severity: 'error',
                message: `Potential shell injection in job "${jobId}" step ${i + 1}: Direct use of "${matches.join(', ')}" in "run" script. Use "env" instead.`,
                path: `jobs.${jobId}.steps[${i}].run`,
                file: fileName
              });
            }
          }
        }
      }
    }
  }

  return results;
}
