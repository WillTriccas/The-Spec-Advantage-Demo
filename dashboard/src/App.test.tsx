import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders illustrative banner when dataKind is illustrative', () => {
    render(<App />);
    expect(screen.getByText('ILLUSTRATIVE DATA ONLY - NOT FOR MEASUREMENT')).toBeTruthy();
  });

  it('renders overall claim status correctly', () => {
    render(<App />);
    expect(screen.getByText('Overall Roll-up: INCONCLUSIVE')).toBeTruthy();
    expect(screen.getByText('Overall results are inconclusive due to a weaker episode.')).toBeTruthy();
  });

  it('renders episode claims correctly', () => {
    render(<App />);
    expect(screen.getByText('Modernization Claim: SUPPORTED')).toBeTruthy();
    expect(screen.getByText('Audit Feature Claim: INCONCLUSIVE')).toBeTruthy();
  });

  it('filters lanes when view mode changes or filters applied', () => {
    render(<App />);
    
    // Engineering view button should exist
    const engViewButton = screen.getByText('Engineering View');
    fireEvent.click(engViewButton);
    
    // Should show run details in engineering view
    expect(screen.getAllByText('Run Details').length).toBeGreaterThan(0);
    
    // Test filter select
    const laneSelect = screen.getByLabelText('Lane');
    fireEvent.change(laneSelect, { target: { value: 'spec' } });
    
    // The "generate" lane shouldn't be visible anymore
    expect(screen.queryByText('GENERATE')).toBeNull();
  });
});
