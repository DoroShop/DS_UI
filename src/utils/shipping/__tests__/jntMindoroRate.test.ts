/**
 * Unit tests for J&T Oriental Mindoro unified rate calculator (frontend).
 * Covers bag pricing (≤8kg) and rate table (9–50kg).
 *
 * Run: npm run test -- src/utils/shipping/__tests__/jntMindoroRate.test.ts
 */

import { describe, expect, test } from 'vitest'
import {
  BAG_TIERS,
  BAG_MAX_KG,
  JNT_ORIENTAL_MINDORO_RATE_UP_TO_50KG,
  calcJntMindoroShipping,
  calcShipmentFromItems,
  ShippingCalcError,
  formatFee,
  resolveFee,
  selectBagTier,
  MAX_BILLABLE_KG,
} from '../jntMindoroRate'

// ─── Bag Tiers ───────────────────────────────────────────────────────────────

describe('bag tiers', () => {
  test('BAG_TIERS has 3 entries', () => {
    expect(BAG_TIERS).toHaveLength(3)
  })

  test('BAG_MAX_KG is 8', () => {
    expect(BAG_MAX_KG).toBe(8)
  })

  test.each([
    [1, 'SMALL_LE_3KG', 70],
    [3, 'SMALL_LE_3KG', 70],
    [4, 'MEDIUM_LE_5KG', 120],
    [5, 'MEDIUM_LE_5KG', 120],
    [6, 'BIG_LE_8KG', 160],
    [8, 'BIG_LE_8KG', 160],
  ] as const)('%ikg → %s (₱%i)', (kg, key, fee) => {
    const bag = selectBagTier(kg)
    expect(bag).not.toBeNull()
    expect(bag!.key).toBe(key)
    expect(bag!.fee).toBe(fee)
  })

  test('9kg returns null', () => {
    expect(selectBagTier(9)).toBeNull()
  })
})

describe('resolveFee', () => {
  test.each([
    [1, 70, 'BAG', 'SMALL_LE_3KG'],
    [8, 160, 'BAG', 'BIG_LE_8KG'],
    [9, 455, 'RATE_TABLE', null],
    [50, 2915, 'RATE_TABLE', null],
  ] as const)('%ikg → ₱%i (%s)', (kg, fee, tier, bagSpec) => {
    const r = resolveFee(kg)
    expect(r).not.toBeNull()
    expect(r!.fee).toBe(fee)
    expect(r!.tier).toBe(tier)
    expect(r!.bagSpec).toBe(bagSpec)
  })
})

// ─── Rate Map ────────────────────────────────────────────────────────────────

describe('rate map spot checks', () => {
  const cases: [number, number][] = [
    [9, 455], [10, 515], [11, 575],
    [25, 1415], [50, 2915],
  ]

  test.each(cases)('%ikg → ₱%i', (kg, expected) => {
    expect(JNT_ORIENTAL_MINDORO_RATE_UP_TO_50KG[kg]).toBe(expected)
  })
})

// ─── Core calculator ─────────────────────────────────────────────────────────

describe('calcJntMindoroShipping', () => {
  test('1 kg → ₱70 (BAG SMALL)', () => {
    const r = calcJntMindoroShipping({ actualKg: 1 })
    expect(r.fee).toBe(70)
    expect(r.billKg).toBe(1)
    expect(r.method).toBe('JNT_MINDORO')
    expect(r.tier).toBe('BAG')
    expect(r.bagSpec).toBe('SMALL_LE_3KG')
  })

  test('0.3 kg → billKg=1 → ₱70 (BAG SMALL)', () => {
    const r = calcJntMindoroShipping({ actualKg: 0.3 })
    expect(r.fee).toBe(70)
    expect(r.tier).toBe('BAG')
  })

  test('5 kg → ₱120 (BAG MEDIUM)', () => {
    const r = calcJntMindoroShipping({ actualKg: 5 })
    expect(r.fee).toBe(120)
    expect(r.tier).toBe('BAG')
    expect(r.bagSpec).toBe('MEDIUM_LE_5KG')
  })

  test('8 kg → ₱160 (BAG BIG)', () => {
    const r = calcJntMindoroShipping({ actualKg: 8 })
    expect(r.fee).toBe(160)
    expect(r.tier).toBe('BAG')
    expect(r.bagSpec).toBe('BIG_LE_8KG')
  })

  test('9 kg → ₱455 (RATE_TABLE)', () => {
    const r = calcJntMindoroShipping({ actualKg: 9 })
    expect(r.fee).toBe(455)
    expect(r.tier).toBe('RATE_TABLE')
    expect(r.bagSpec).toBeNull()
  })

  test('volumetric > actual → volumetric wins', () => {
    const r = calcJntMindoroShipping({
      actualKg: 1,
      lengthCm: 50,
      widthCm: 40,
      heightCm: 30,
    })
    expect(r.volumetricKg).toBe(12)
    expect(r.billKg).toBe(12)
    expect(r.fee).toBe(635)
    expect(r.tier).toBe('RATE_TABLE')
  })

  test('>50 kg throws MANUAL_QUOTE_REQUIRED', () => {
    try {
      calcJntMindoroShipping({ actualKg: 51 })
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(ShippingCalcError)
      expect((e as ShippingCalcError).code).toBe('MANUAL_QUOTE_REQUIRED')
    }
  })

  test('invalid actualKg throws VALIDATION_ERROR', () => {
    try {
      calcJntMindoroShipping({ actualKg: 0 })
      expect(true).toBe(false)
    } catch (e) {
      expect((e as ShippingCalcError).code).toBe('VALIDATION_ERROR')
    }
  })

  test('partial dims throw VALIDATION_ERROR', () => {
    try {
      calcJntMindoroShipping({ actualKg: 1, lengthCm: 10, widthCm: 10 })
      expect(true).toBe(false)
    } catch (e) {
      expect((e as ShippingCalcError).code).toBe('VALIDATION_ERROR')
    }
  })
})

// ─── Multi-item shipment ─────────────────────────────────────────────────────

describe('calcShipmentFromItems', () => {
  test('single item 3kg → ₱70 (BAG SMALL)', () => {
    const r = calcShipmentFromItems([{ weightKg: 3, quantity: 1 }])
    expect(r.fee).toBe(70)
    expect(r.tier).toBe('BAG')
  })

  test('multi-item sums weights → 5kg → ₱120 (BAG MEDIUM)', () => {
    const r = calcShipmentFromItems([
      { weightKg: 2, quantity: 2 },
      { weightKg: 1, quantity: 1 },
    ])
    expect(r.actualKg).toBe(5)
    expect(r.fee).toBe(120)
    expect(r.tier).toBe('BAG')
  })

  test('items totalling 9kg → ₱455 (RATE_TABLE)', () => {
    const r = calcShipmentFromItems([
      { weightKg: 5, quantity: 1 },
      { weightKg: 4, quantity: 1 },
    ])
    expect(r.fee).toBe(455)
    expect(r.tier).toBe('RATE_TABLE')
  })

  test('volumetric math across items', () => {
    const r = calcShipmentFromItems([
      { weightKg: 0.5, lengthCm: 50, widthCm: 40, heightCm: 30, quantity: 1 },
      { weightKg: 0.5, quantity: 1 },
    ])
    expect(r.volumetricKg).toBe(12)
    expect(r.billKg).toBe(12)
    expect(r.tier).toBe('RATE_TABLE')
  })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

describe('formatFee', () => {
  test('formats peso sign + weight', () => {
    expect(formatFee(515, 10)).toBe('₱515 (10 kg)')
  })

  test('larger fee gets comma', () => {
    expect(formatFee(2915, 50)).toMatch(/2.*915/)
  })
})
