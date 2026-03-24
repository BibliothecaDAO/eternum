const FACTORY_V2_ADMIN_SECRET_STORAGE_KEY = "factory-v2-admin-secret";

function resolveLocalStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readFactoryV2AdminSecret() {
  const storage = resolveLocalStorage();

  if (!storage) {
    return "";
  }

  try {
    return storage.getItem(FACTORY_V2_ADMIN_SECRET_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function writeFactoryV2AdminSecret(secret: string) {
  const storage = resolveLocalStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(FACTORY_V2_ADMIN_SECRET_STORAGE_KEY, secret);
    return true;
  } catch {
    return false;
  }
}

export function clearFactoryV2AdminSecret() {
  const storage = resolveLocalStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(FACTORY_V2_ADMIN_SECRET_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
