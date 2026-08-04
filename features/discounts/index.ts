export {
  computeTuition,
  resolveReduction,
  DISCOUNT_UNITS,
} from "./calc";
export type {
  DiscountApplication,
  DiscountUnit,
  ResolvedDiscount,
  TuitionComputation,
} from "./calc";
export {
  createDiscountType,
  listDiscountTypes,
  resolveDiscountApplications,
  updateDiscountType,
} from "./api";
export type {
  AppliedDiscountInput,
  DiscountTypeRow,
  ResolvedApplication,
} from "./api";
export {
  discountTypeIdParamSchema,
  discountTypeInputSchema,
} from "./schemas";
export type { DiscountTypeInput } from "./schemas";
export { strings } from "./strings";
export { DiscountsView } from "./components/DiscountsView";
