import { registerDecorator, type ValidationOptions } from "class-validator";
import { isLanguageValue } from "./language";

/** "indonesian", "english" or a two-letter ISO 639-1 language code. */
export function IsLanguage(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isLanguage",
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be "indonesian", "english" or a two-letter language code such as ar or es`, ...options },
      validator: { validate: (value: unknown) => isLanguageValue(value) },
    });
}
