const demoDataIncluded = import.meta.env.VITE_DEMO_DATA_ENABLED === 'true';

let runtimeDemoDataEnabled = false;
let runtimeFootballApiEnabled = false;

export function configureRuntimeFeatureFlags(flags: { demoDataEnabled: boolean; footballApiEnabled: boolean }): void {
  runtimeDemoDataEnabled = flags.demoDataEnabled;
  runtimeFootballApiEnabled = flags.footballApiEnabled;
}

export function isDemoDataEnabled(): boolean {
  return demoDataIncluded && runtimeDemoDataEnabled;
}

export function isFootballApiEnabled(): boolean {
  return runtimeFootballApiEnabled;
}
