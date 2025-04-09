export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

export const logger = Logger.getInstance();
