// Server-only account configuration. Never import this module from src/ or public/.
// Environment variables can override the repository account without a code change.
export function getTraacsCredentials() {
  return {
    username: process.env.TRAACS_USERNAME ?? 'abdulrahman',
    password: process.env.TRAACS_PASSWORD ?? 'Hold@999',
    companyId: process.env.TRAACS_COMPANY_ID ?? '1',
    costCenterId: process.env.TRAACS_LOGIN_COST_CENTER ?? '',
    sessionSecret: process.env.TRAACS_SESSION_SECRET ?? '82be4ae71f361b411245a95fb59d6756512ed2de574f406e5ab054556742e8b7',
    enabled: process.env.TRAACS_AUTO_LOGIN !== 'false',
  };
}
