import { createHash } from "crypto";
import type { ValidatorType } from "@/lib/db/models";

export function hashSolution(answer: string): string {
  return createHash("sha256").update(answer, "utf8").digest("hex");
}

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Hash the stored answer the same way validation will hash user input. */
export function hashPlainForValidator(
  validatorType: ValidatorType,
  plain: string,
  validatorConfig: Record<string, unknown>,
): string {
  void validatorConfig;
  switch (validatorType) {
    case "normalized":
      return hashSolution(normalizeAnswer(plain));
    case "numeric": {
      const n = Number(String(plain).trim().replace(/,/g, ""));
      return hashSolution(String(Number.isNaN(n) ? plain : n));
    }
    case "ordered_tokens": {
      const parts = String(plain)
        .split(/[,|]/g)
        .map((p) => normalizeAnswer(p))
        .filter(Boolean);
      return hashSolution(parts.join("|"));
    }
    case "regex":
      return hashSolution(String(plain).trim());
    default:
      return hashSolution(plain);
  }
}

export function checkAnswer(
  validatorType: ValidatorType,
  validatorConfig: Record<string, unknown>,
  userInput: string,
  solutionHash: string,
): boolean {
  const candidates: string[] = [];
  switch (validatorType) {
    case "exact":
      candidates.push(hashSolution(userInput));
      break;
    case "normalized":
      candidates.push(hashSolution(normalizeAnswer(userInput)));
      break;
    case "numeric": {
      const n = Number(String(userInput).trim().replace(/,/g, ""));
      if (!Number.isNaN(n)) {
        candidates.push(hashSolution(String(n)));
        candidates.push(hashSolution(String(Math.round(n))));
      }
      break;
    }
    case "ordered_tokens": {
      const parts = String(userInput)
        .split(/[,|]/g)
        .map((p) => normalizeAnswer(p))
        .filter(Boolean);
      candidates.push(hashSolution(parts.join("|")));
      break;
    }
    case "regex": {
      const pattern = String(validatorConfig.pattern ?? "");
      try {
        const re = new RegExp(pattern);
        if (!re.test(userInput)) return false;
        candidates.push(hashSolution(String(userInput).trim()));
      } catch {
        return false;
      }
      break;
    }
    default:
      candidates.push(hashSolution(userInput));
  }
  return candidates.includes(solutionHash);
}
