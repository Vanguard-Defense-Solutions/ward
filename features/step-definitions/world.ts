import { World as CucumberWorld, setWorldConstructor } from '@cucumber/cucumber';
import type { LocalEngine } from '../../packages/shared/src/engine/index';
import type { Verdict, WardConfig, ThreatEntry, Signal } from '../../packages/shared/src/types';

export class WardWorld extends CucumberWorld {
  tempDir: string = '';
  engine: LocalEngine | null = null;
  lastVerdict: Verdict | null = null;
  lastOutput: string = '';
  lastExitCode: number = 0;
  config: Partial<WardConfig> = {};
  topPackages: string[] = [];
  threats: ThreatEntry[] = [];
  previousVersions: Map<string, string> = new Map();
  registryExists: Map<string, boolean> = new Map();
  scripts: Map<string, Record<string, string>> = new Map();
  installCounter: number = -1; // -1 = not tracking
  noColor: boolean = false;
  termDumb: boolean = false;
  isOffline: boolean = false;
  formatMode: 'default' | 'clinical' | 'json' | 'verbose' = 'default';
  wardInitialized: boolean = false;
  lockfilePackages: Array<{ name: string; version: string }> = [];
}

setWorldConstructor(WardWorld);
