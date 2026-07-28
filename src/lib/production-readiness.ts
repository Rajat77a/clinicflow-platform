const DEMO_ONLY_ROUTE_RULES: ReadonlyArray<RegExp> = [
  /^\/app\/clinics\/new\/?$/,
  /^\/app\/downloads(?:\/|$)/,
  /^\/app\/files(?:\/|$)/,
  /^\/app\/followups(?:\/|$)/,
  /^\/app\/notifications(?:\/|$)/,
  /^\/app\/payments(?:\/|$)/,
  /^\/app\/reports(?:\/|$)/,
  /^\/app\/subscriptions(?:\/|$)/,
  /^\/app\/support(?:\/|$)/,
];

export function isProductionReadyPath(pathname: string) {
  return !DEMO_ONLY_ROUTE_RULES.some(rule => rule.test(pathname));
}
