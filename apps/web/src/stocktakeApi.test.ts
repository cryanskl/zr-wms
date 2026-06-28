import { describe, expect, it } from 'vitest';
import {
  buildAddStocktakeLineRequest,
  buildApplyStocktakeLineRequest,
  buildCreateStocktakeRequest,
} from './stocktakeApi';

describe('stocktakeApi helpers', () => {
  it('builds stocktake create, line, and apply requests', () => {
    expect(buildCreateStocktakeRequest({ warehouse_id: 'W1' })).toEqual({
      url: '/api/v1/stocktakes',
      init: {
        method: 'POST',
        body: JSON.stringify({ warehouse_id: 'W1' }),
      },
    });

    expect(
      buildAddStocktakeLineRequest(12, {
        product_id: 'RM-001',
        slot_id: 5,
        counted_qty: 33,
        batch_id: null,
      }),
    ).toEqual({
      url: '/api/v1/stocktakes/12/lines',
      init: {
        method: 'POST',
        body: JSON.stringify({
          product_id: 'RM-001',
          slot_id: 5,
          counted_qty: 33,
          batch_id: null,
        }),
      },
    });

    expect(buildApplyStocktakeLineRequest(34)).toEqual({
      url: '/api/v1/stocktake-lines/34/apply',
      init: {
        method: 'POST',
      },
    });
  });
});
