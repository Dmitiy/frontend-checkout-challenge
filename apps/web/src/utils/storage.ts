const prefix = 'checkout:';

export const storage = {
  get: (key: string) => localStorage.getItem(`${prefix}${key}`),
  set: (key: string, value: string) => localStorage.setItem(`${prefix}${key}`, value),
  remove: (key: string) => localStorage.removeItem(`${prefix}${key}`),
};
