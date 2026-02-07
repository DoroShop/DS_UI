/**
 * J&T Oriental Mindoro — Unified Shipping Rate Calculator
 *
 * Pure, deterministic shipping calculator.
 * Frontend copy — used for instant estimates in the checkout UI.
 * The backend is ALWAYS the source of truth.
 *
 * This file mirrors DS-Backend/utils/shipping/jntMindoroRate.js
 *
 * Pricing tiers (per shipment, by billable weight):
 *   ≤ 3 kg  → SMALL bag  → ₱70
 *   ≤ 5 kg  → MEDIUM bag → ₱120
 *   ≤ 8 kg  → BIG bag    → ₱160
 *   9–50 kg → Rate table  (per-kg lookup)
 */

// ─── Bag Pricing (≤ 8 kg) ───────────────────────────────────────────────────

export interface BagTier {
  key: string
  maxKg: number
  fee: number
}

export const BAG_TIERS: BagTier[] = [
  { key: 'SMALL_LE_3KG',  maxKg: 3,  fee: 70  },
  { key: 'MEDIUM_LE_5KG', maxKg: 5,  fee: 120 },
  { key: 'BIG_LE_8KG',    maxKg: 8,  fee: 160 },
]

export const BAG_MAX_KG = 8

// ─── Rate Table (9–50 kg) ───────────────────────────────────────────────────

export const JNT_ORIENTAL_MINDORO_RATE_UP_TO_50KG: Record<number, number> = {
  1: 155,   2: 180,   3: 180,   4: 200,   5: 220,
  6: 275,   7: 335,   8: 395,   9: 455,  10: 515,
  11: 575,  12: 635,  13: 695,  14: 755,  15: 815,
  16: 875,  17: 935,  18: 995,  19: 1055, 20: 1115,
  21: 1175, 22: 1235, 23: 1295, 24: 1355, 25: 1415,
  26: 1475, 27: 1535, 28: 1595, 29: 1655, 30: 1715,
  31: 1775, 32: 1835, 33: 1895, 34: 1955, 35: 2015,
  36: 2075, 37: 2135, 38: 2195, 39: 2255, 40: 2315,
  41: 2375, 42: 2435, 43: 2495, 44: 2555, 45: 2615,
  46: 2675, 47: 2735, 48: 2795, 49: 2855, 50: 2915,
}

export const VOLUMETRIC_DIVISOR = 5000
export const MAX_BILLABLE_KG = 50
export const MIN_BILLABLE_KG = 1

export interface JntMindoroShippingResult {
  method: 'JNT_MINDORO'
  actualKg: number
  volumetricKg: number
  chargeableKg: number
  billKg: number
  fee: number
  tier: 'BAG' | 'RATE_TABLE'
  bagSpec: string | null
  display: string
}

export class ShippingCalcError extends Error {
  code: string
  details: Record<string, any>

  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message)
    this.name = 'ShippingCalcError'
    this.code = code
    this.details = details
  }
}

function isPositiveNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0
}

function round4(n: number): number {
  return parseFloat(n.toFixed(4))
}

export function formatFee(fee: number, billKg: number): string {
  return `₱${fee.toLocaleString()} (${billKg} kg)`
}

// ─── Fee Resolution ─────────────────────────────────────────────────────────

/**
 * Select the appropriate bag tier for weights ≤ 8 kg.
 */
export function selectBagTier(billKg: number): BagTier | null {
  for (const bag of BAG_TIERS) {
    if (billKg <= bag.maxKg) return bag
  }
  return null
}

/**
 * Resolve fee for a given billable weight.
 * ≤ 8 kg → bag pricing, 9–50 kg → rate table.
 */
export function resolveFee(billKg: number): { fee: number; tier: 'BAG' | 'RATE_TABLE'; bagSpec: string | null } | null {
  if (billKg <= BAG_MAX_KG) {
    const bag = selectBagTier(billKg)
    if (bag) {
      return { fee: bag.fee, tier: 'BAG', bagSpec: bag.key }
    }
  }

  const tableFee = JNT_ORIENTAL_MINDORO_RATE_UP_TO_50KG[billKg]
  if (tableFee != null) {
    return { fee: tableFee, tier: 'RATE_TABLE', bagSpec: null }
  }

  return null
}

// ─── Core Calculator ────────────────────────────────────────────────────────

/**
 * Calculate J&T Oriental Mindoro shipping fee for a single weight entry.
 */
export function calcJntMindoroShipping(opts: {
  actualKg: number
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
}): JntMindoroShippingResult {
  const { actualKg, lengthCm, widthCm, heightCm } = opts

  if (!isPositiveNumber(actualKg)) {
    throw new ShippingCalcError('actualKg must be a positive number.', 'VALIDATION_ERROR', {
      field: 'actualKg',
      value: actualKg,
    })
  }

  const dims = [lengthCm, widthCm, heightCm]
  const provided = dims.filter((d) => d != null)
  if (provided.length > 0 && provided.length < 3) {
    throw new ShippingCalcError(
      'If any dimension is provided, all three are required.',
      'VALIDATION_ERROR',
      { fields: ['lengthCm', 'widthCm', 'heightCm'] }
    )
  }

  for (const [name, val] of [
    ['lengthCm', lengthCm],
    ['widthCm', widthCm],
    ['heightCm', heightCm],
  ] as const) {
    if (val != null && !isPositiveNumber(val)) {
      throw new ShippingCalcError(`${name} must be a positive number.`, 'VALIDATION_ERROR', {
        field: name,
        value: val,
      })
    }
  }

  let volumetricKg = 0
  if (lengthCm != null && widthCm != null && heightCm != null) {
    volumetricKg = (lengthCm * widthCm * heightCm) / VOLUMETRIC_DIVISOR
  }

  const chargeableKg = Math.max(actualKg, volumetricKg)
  let billKg = Math.ceil(chargeableKg)
  billKg = Math.max(billKg, MIN_BILLABLE_KG)

  if (billKg > MAX_BILLABLE_KG) {
    throw new ShippingCalcError(
      'Shipment exceeds 50kg. Manual quote required.',
      'MANUAL_QUOTE_REQUIRED',
      { billKg, maxKg: MAX_BILLABLE_KG }
    )
  }

  const resolved = resolveFee(billKg)!

  return {
    method: 'JNT_MINDORO',
    actualKg: round4(actualKg),
    volumetricKg: round4(volumetricKg),
    chargeableKg: round4(chargeableKg),
    billKg,
    fee: resolved.fee,
    tier: resolved.tier,
    bagSpec: resolved.bagSpec,
    display: formatFee(resolved.fee, billKg),
  }
}

/**
 * Calculate shipment fee from an array of items with shipping profiles.
 */
export function calcShipmentFromItems(
  items: Array<{
    weightKg: number
    lengthCm?: number | null
    widthCm?: number | null
    heightCm?: number | null
    quantity: number
  }>
): JntMindoroShippingResult {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ShippingCalcError('items must be a non-empty array.', 'VALIDATION_ERROR')
  }

  let actualKgTotal = 0
  let volumetricKgTotal = 0

  for (const item of items) {
    const qty = item.quantity || 1
    if (!isPositiveNumber(item.weightKg)) {
      throw new ShippingCalcError('Each item must have a positive weightKg.', 'VALIDATION_ERROR')
    }
    actualKgTotal += item.weightKg * qty
    if (item.lengthCm != null && item.widthCm != null && item.heightCm != null) {
      volumetricKgTotal += ((item.lengthCm * item.widthCm * item.heightCm) / VOLUMETRIC_DIVISOR) * qty
    }
  }

  const chargeableKg = Math.max(actualKgTotal, volumetricKgTotal)
  let billKg = Math.ceil(chargeableKg)
  billKg = Math.max(billKg, MIN_BILLABLE_KG)

  if (billKg > MAX_BILLABLE_KG) {
    throw new ShippingCalcError(
      'Shipment exceeds 50kg. Manual quote required.',
      'MANUAL_QUOTE_REQUIRED',
      { billKg, maxKg: MAX_BILLABLE_KG }
    )
  }

  const resolved = resolveFee(billKg)!

  return {
    method: 'JNT_MINDORO',
    actualKg: round4(actualKgTotal),
    volumetricKg: round4(volumetricKgTotal),
    chargeableKg: round4(chargeableKg),
    billKg,
    fee: resolved.fee,
    tier: resolved.tier,
    bagSpec: resolved.bagSpec,
    display: formatFee(resolved.fee, billKg),
  }
}
