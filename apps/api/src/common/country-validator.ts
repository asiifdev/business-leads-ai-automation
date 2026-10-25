import { registerDecorator, type ValidationOptions } from "class-validator";
import { isCountryCode } from "./country";

/** An ISO 3166-1 alpha-2 country code that names a real country. */
export function IsCountryCode(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isCountryCode",
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a two-letter country code such as ID, EG or SA`, ...options },
      validator: { validate: (value: unknown) => isCountryCode(value) },
    });
}
