import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

describe('measured dashboard', () => {
  it('renders the bounded measured headline result', () => {
    render(<App />);
    expect(screen.getByText(/bounded-measured evidence/i)).toBeTruthy();
    expect(screen.getByText('not supported')).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy();
    expect(screen.getByText(/Timeout 90.0 min/)).toBeTruthy();
  });

  it('shows the headline lane comparison for both episodes', () => {
    render(<App />);
    expect(screen.getAllByText('Efficient + spec')).toHaveLength(2);
    expect(screen.getAllByText('Frontier + raw')).toHaveLength(2);
    expect(screen.getAllByText('Platform modernization').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Explainable audit feature').length).toBeGreaterThan(0);
  });

  it('reveals run-level evidence in engineering view and filters lanes', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Engineering'));
    expect(screen.getAllByText('Run-level evidence')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Lane'), { target: { value: 'efficient-spec' } });
    expect(screen.getAllByText('frontier-raw')).toHaveLength(1);
    expect(screen.getAllByText('efficient-spec').length).toBeGreaterThan(0);
  });
});
