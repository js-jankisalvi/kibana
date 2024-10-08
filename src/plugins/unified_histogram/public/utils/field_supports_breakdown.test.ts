/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { fieldSupportsBreakdown } from './field_supports_breakdown';

describe('fieldSupportsBreakdown', () => {
  it('should return false if field is not aggregatable', () => {
    expect(
      fieldSupportsBreakdown({ aggregatable: false, scripted: false, type: 'string' } as any)
    ).toBe(false);
  });

  it('should return false if field is scripted', () => {
    expect(
      fieldSupportsBreakdown({ aggregatable: true, scripted: true, type: 'string' } as any)
    ).toBe(false);
  });

  it('should return false if field type is not supported', () => {
    expect(
      fieldSupportsBreakdown({ aggregatable: true, scripted: false, type: 'unsupported' } as any)
    ).toBe(false);
  });

  it('should return true if field is aggregatable and type is supported', () => {
    expect(
      fieldSupportsBreakdown({ aggregatable: true, scripted: false, type: 'string' } as any)
    ).toBe(true);

    expect(
      fieldSupportsBreakdown({ aggregatable: true, scripted: false, type: 'number' } as any)
    ).toBe(true);
  });

  it('should return false if field is aggregatable but it is a time series counter metric', () => {
    expect(
      fieldSupportsBreakdown({
        aggregatable: true,
        scripted: false,
        type: 'number',
        timeSeriesMetric: 'counter',
      } as any)
    ).toBe(false);
  });
});
