import * as vscode from 'vscode';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;
  private outputChannel: vscode.OutputChannel | null = null;

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

  public setOutputChannel(channel: vscode.OutputChannel): void {
    this.outputChannel = channel;
  }

  public debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formattedMessage = this.formatMessage('DEBUG', message, args);
      console.log(formattedMessage);
      this.logToOutputChannel(formattedMessage);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formattedMessage = this.formatMessage('INFO', message, args);
      console.log(formattedMessage);
      this.logToOutputChannel(formattedMessage);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formattedMessage = this.formatMessage('WARN', message, args);
      console.warn(formattedMessage);
      this.logToOutputChannel(formattedMessage);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formattedMessage = this.formatMessage('ERROR', message, args);
      console.error(formattedMessage);
      this.logToOutputChannel(formattedMessage);
    }
  }

  private formatMessage(level: string, message: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;

    if (args.length === 0) {
      return baseMessage;
    }

    // Try to stringify objects for better logging
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return arg.toString();
        }
      }
      return arg;
    });

    return `${baseMessage} ${formattedArgs.join(' ')}`;
  }

  private logToOutputChannel(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(message);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

export const logger = Logger.getInstance();
