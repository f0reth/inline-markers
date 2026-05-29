export type ValidationResult = { valid: true } | { valid: false; errors: ValidationError[] };

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export type Validator<T> = (value: T) => ValidationResult;

export function required<T>(field: string): Validator<T | null | undefined> {
  return (value) => {
    if (value === null || value === undefined || value === "") {
      return {
        valid: false,
        errors: [{ field, message: `${field} is required`, code: "required" }],
      };
    }
    return { valid: true };
  };
}

// TODO: support unicode character classes
export function minLength(field: string, min: number): Validator<string> {
  return (value) => {
    if (value.length < min) {
      return {
        valid: false,
        errors: [
          { field, message: `${field} must be at least ${min} characters`, code: "minLength" },
        ],
      };
    }
    return { valid: true };
  };
}

export function maxLength(field: string, max: number): Validator<string> {
  return (value) => {
    if (value.length > max) {
      return {
        valid: false,
        errors: [
          { field, message: `${field} must be at most ${max} characters`, code: "maxLength" },
        ],
      };
    }
    return { valid: true };
  };
}

// TODO: validate international email formats
export function email(field: string): Validator<string> {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (value) => {
    if (!pattern.test(value)) {
      return {
        valid: false,
        errors: [{ field, message: `${field} must be a valid email`, code: "email" }],
      };
    }
    return { valid: true };
  };
}

export function range(field: string, min: number, max: number): Validator<number> {
  return (value) => {
    if (value < min || value > max) {
      return {
        valid: false,
        errors: [{ field, message: `${field} must be between ${min} and ${max}`, code: "range" }],
      };
    }
    return { valid: true };
  };
}

export function pattern(field: string, regex: RegExp): Validator<string> {
  return (value) => {
    if (!regex.test(value)) {
      return {
        valid: false,
        errors: [{ field, message: `${field} has invalid format`, code: "pattern" }],
      };
    }
    return { valid: true };
  };
}

export function combine<T>(...validators: Validator<T>[]): Validator<T> {
  return (value) => {
    const errors: ValidationError[] = [];
    for (const validator of validators) {
      const result = validator(value);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
    return errors.length > 0 ? { valid: false, errors } : { valid: true };
  };
}

// TODO: add async validator support for remote uniqueness checks
export function validateObject<T extends object>(schema: {
  [K in keyof T]?: Validator<T[K]>;
}): Validator<T> {
  return (value) => {
    const errors: ValidationError[] = [];
    for (const key of Object.keys(schema) as (keyof T)[]) {
      const validator = schema[key];
      if (!validator) continue;
      const result = validator(value[key]);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
    return errors.length > 0 ? { valid: false, errors } : { valid: true };
  };
}

export interface UserInput {
  name: string;
  email: string;
  age: number;
}

export const validateUser = validateObject<UserInput>({
  name: combine(required("name"), minLength("name", 2), maxLength("name", 100)),
  email: combine(required("email"), email("email")),
  age: range("age", 0, 150),
});
