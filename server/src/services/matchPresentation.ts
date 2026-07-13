export interface PresentedMatchTeam { _id: unknown; name: string; shortName?: string; logoUrl?: string }

export function presentMatch<T extends Record<string, any>>(match: T) {
  return {
    ...match,
    homeTeam: teamName(match.homeTeamId),
    awayTeam: teamName(match.awayTeamId),
    homeLogo: teamLogo(match.homeTeamId),
    awayLogo: teamLogo(match.awayTeamId),
    homeTeamId: teamId(match.homeTeamId),
    awayTeamId: teamId(match.awayTeamId)
  };
}

export function teamName(value: unknown): string {
  return isTeam(value) ? value.name : 'تیم نامشخص';
}

function teamLogo(value: unknown): string|undefined { return isTeam(value) ? value.logoUrl : undefined; }
function teamId(value: unknown): unknown { return isTeam(value) ? value._id : value; }
function isTeam(value: unknown): value is PresentedMatchTeam { return Boolean(value && typeof value === 'object' && '_id' in value && 'name' in value); }
