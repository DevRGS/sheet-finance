/**
 * Sessão OAuth do Google (ver services/google/googleAuthSession).
 * Persistida no localStorage do navegador; `accessToken` vazio + `expireAt` 0 = sessão expirada
 * (só o email é mantido, para reconectar sem seletor de conta).
 */
export interface GoogleAuthData {
  email: string;
  accessToken: string;
  expireAt: number;
}
