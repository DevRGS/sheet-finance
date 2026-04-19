/**
 * Dados sensíveis de OAuth — mantidos apenas em memória (ver googleAuthSession).
 * Não persistir accessToken em localStorage/sessionStorage.
 */
export interface GoogleAuthData {
  email: string;
  accessToken: string;
  expireAt: number;
}
