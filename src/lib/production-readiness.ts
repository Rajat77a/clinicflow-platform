const DEMO_ONLY_ROUTE_RULES: ReadonlyArray<RegExp> = [
  /^\/app\/(?:downloads|files|followups|notifications|payments|reports|support)(?:\/|$)/,
];

export function isProductionReadyPath(pathname: string) {
  return !DEMO_ONLY_ROUTE_RULES.some(rule => rule.test(pathname));
}
