import { ApiFailure } from '../api';

export const errorText = (error: unknown) =>
  error instanceof ApiFailure
    ? error.message
    : 'Не удалось выполнить действие. Попробуйте ещё раз.';
