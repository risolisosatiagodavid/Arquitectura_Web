export const SESSION_COOKIE_NAME = 'mercado_ya_session';
export const SESSION_DURATION_MS = 60 * 60 * 1000;

export const readSessionCookie = (cookieHeader: string | undefined): string | undefined => {
  const sessionCookie = cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

  return sessionCookie?.slice(SESSION_COOKIE_NAME.length + 1) || undefined;
};
