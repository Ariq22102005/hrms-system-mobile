import { it, expect } from 'vitest';
import { buildPayslipHtml } from './payslip';
it('escapes user/server text and preserves payroll amounts and optional allowance', () => {
  const html = buildPayslipHtml({ id: 'EMP-1', name: '<script>alert("x")</script>', email: 'x', role: 'staff', division: 'ops' }, { id: 1, period: '<October>', basic_salary: 8500000, allowance: 500000, deductions: 625000, net_salary: 8375000, status: 'processed' }, 'en');
  expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('&lt;October&gt;'); expect(html).toContain('8.375.000'); expect(html).toContain('500.000');
});
