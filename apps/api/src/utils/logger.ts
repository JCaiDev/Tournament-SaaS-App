import { ENV } from "../config/env";

export function logInfo(message: string) {
  console.log(message);
}

export function logError(error: unknown) {
  if (ENV.NODE_ENV === "production") {
    console.error("An unexpected error occurred");
  } else {
    console.error(error);
  }
}
