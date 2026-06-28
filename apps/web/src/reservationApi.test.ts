import { describe, expect, it } from 'vitest';
import {
  buildCreateReservationRequest,
  buildFulfillReservationRequest,
  buildOrderReservationsUrl,
  buildReleaseReservationRequest,
} from './reservationApi';

describe('reservationApi helpers', () => {
  it('builds reservation URLs', () => {
    expect(buildOrderReservationsUrl(7)).toBe('/api/v1/orders/7/reservations');
  });

  it('builds create, fulfill, and release requests', () => {
    expect(
      buildCreateReservationRequest({
        order_id: 7,
        product_id: 'FG-1',
        slot_id: 3,
        qty: 2,
        batch_id: null,
      }),
    ).toEqual({
      url: '/api/v1/reservations',
      init: {
        method: 'POST',
        body: JSON.stringify({
          order_id: 7,
          product_id: 'FG-1',
          slot_id: 3,
          qty: 2,
          batch_id: null,
        }),
      },
    });

    expect(buildFulfillReservationRequest(12)).toEqual({
      url: '/api/v1/reservations/12/fulfill',
      init: { method: 'POST' },
    });
    expect(buildReleaseReservationRequest(12)).toEqual({
      url: '/api/v1/reservations/12/release',
      init: { method: 'POST' },
    });
  });
});
