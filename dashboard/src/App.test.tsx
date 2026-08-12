import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders illustrative banner when dataKind is illustrative', () => {
    render(<App />);
    expect(screen.getByText('ILLUSTRATIVE DATA ONLY - NOT FOR MEASUREMENT')).toBeTruthy();
  });

  it('renders hypothesis claim status correctly', () => {
    render(<App />);
    expect(screen.getByText('Hypothesis: NOT-EVALUATED')).toBeTruthy();
    expect(screen.getByText('Dashboard sample data.')).toBeTruthy();
  });

  it('filters lanes when view mode changes or filters applied', () => {
    render(<App />);
    
    // Engineering view button should exist
    const engViewButton = screen.getByText('Engineering View');
    fireEvent.click(engViewButton);
    
    // Should show run details in engineering view
    expect(screen.getByText('Run Details')).toBeTruthy();
    
    // Test filter select
    const laneSelect = screen.getByLabelText('Lane');
    fireEvent.change(laneSelect, { target: { value: 'spec' } });
    
    // The "generate" lane shouldn't be visible anymore (case insensitive / partial match check depending on exact DOM)
    expect(screen.queryByText('GENERATE')).toBeNull();
  });
});
