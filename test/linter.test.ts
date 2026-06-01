import { describe, it, expect } from "vitest";
import { lintAction } from '../src/linter';

describe('lintAction', () => {
  it('should detect deprecated runtimes', () => {
    const content = `
name: Test Action
runs:
  using: node12
  main: index.js
`;
    const results = lintAction(content);
    expect(results).toContainEqual(expect.objectContaining({
      severity: 'error',
      message: 'Deprecated runtime: node12. Use node20 instead.'
    }));
  });

  it('should detect shell injection in composite actions', () => {
    const content = `
name: Composite Action
runs:
  using: composite
  steps:
    - run: echo \${{ inputs.user_input }}
      shell: bash
`;
    const results = lintAction(content);
    expect(results).toContainEqual(expect.objectContaining({
      severity: 'error',
      message: expect.stringContaining('Potential shell injection')
    }));
  });

  it('should detect shell injection in workflows', () => {
    const content = `
name: Workflow
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ github.event.issue.title }}
`;
    const results = lintAction(content);
    expect(results).toContainEqual(expect.objectContaining({
      severity: 'error',
      message: expect.stringContaining('Potential shell injection')
    }));
  });

  it('should pass valid actions', () => {
    const content = `
name: Valid Action
description: OK
runs:
  using: node20
  main: index.js
`;
    const results = lintAction(content);
    expect(results.filter(r => r.severity === 'error').length).toBe(0);
  });
});
