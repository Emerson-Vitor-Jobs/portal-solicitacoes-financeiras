import type { LogStream } from '../../src/handler/http/logging.js';

export class LogCapture implements LogStream {
  readonly lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }

  get text(): string {
    return this.lines.join('');
  }

  entries(): Record<string, unknown>[] {
    return this.lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  }
}
