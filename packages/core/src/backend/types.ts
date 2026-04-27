export interface BackendRunOptions {
  model: string;
  prompt?: string;
  cwd?: string;
  env?: Record<string, string>;
  omsDir?: string;
  stream?: boolean;
  onOutput?: (chunk: string) => void;
}

export interface BackendRunResult {
  exitCode: number;
  output: string;
}

export interface Backend {
  name: string;
  isAvailable(): Promise<boolean>;
  run(opts: BackendRunOptions): Promise<BackendRunResult>;
}
