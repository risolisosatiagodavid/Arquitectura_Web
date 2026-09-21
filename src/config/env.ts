export const env = {
  jwtSecret: process.env.JWT_SECRET ?? 'development-secret-change-me',
  databasePath: process.env.DB_PATH ?? 'data/arqweb.sqlite',
};