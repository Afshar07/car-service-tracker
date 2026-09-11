import type { TMileageValidationCode } from "~/types/car";

const messages: Record<TMileageValidationCode, string> = {
  required: "Enter a mileage reading.",
  "not-integer": "Mileage must be a whole number.",
  negative: "Mileage cannot be negative.",
  "too-large": "This mileage is outside the supported range.",
  "lower-than-previous": "Mileage cannot be lower than your latest reading.",
  duplicate: "This is the same as your latest reading.",
  "large-increase": "This is over 10,000 km above your latest reading. Check it before saving.",
};

export function getMileageValidationMessage(code: TMileageValidationCode): string {
  return messages[code];
}
