import { logger } from './logger';
import { getConfig, updateConfig, TracingConfig } from './config';
import { EventEmitter } from 'events';

/**
 * Dynamic tracing configuration manager
 * Allows runtime configuration changes from the dashboard
 */
export class TracingConfigManager extends EventEmitter {
  private static instance: TracingConfigManager;
  private currentConfig: TracingConfig;

  private constructor() {
    super();
    this.currentConfig = getConfig().gateway.tracing;
    logger.info('TracingConfigManager initialized with config:', this.currentConfig);
  }

  public static getInstance(): TracingConfigManager {
    if (!TracingConfigManager.instance) {
      TracingConfigManager.instance = new TracingConfigManager();
    }
    return TracingConfigManager.instance;
  }

  /**
   * Get current tracing configuration
   */
  public getConfig(): TracingConfig {
    return { ...this.currentConfig };
  }

  /**
   * Update tracing configuration
   */
  public updateConfig(updates: Partial<TracingConfig>): void {
    const oldConfig = { ...this.currentConfig };
    this.currentConfig = { ...this.currentConfig, ...updates };

    // Update the main config
    updateConfig({
      gateway: {
        ...getConfig().gateway,
        tracing: this.currentConfig,
      },
    });

    // Log configuration changes
    const changes = this.getConfigChanges(oldConfig, this.currentConfig);
    if (changes.length > 0) {
      logger.info('Tracing configuration updated:', changes);
    }

    // Emit change event for listeners
    this.emit('configChanged', this.currentConfig, oldConfig);
  }

  /**
   * Toggle detailed body capture
   */
  public toggleDetailedBodyCapture(): boolean {
    const newValue = !this.currentConfig.detailedBodyCapture;
    this.updateConfig({ detailedBodyCapture: newValue });
    logger.info(`Detailed body capture ${newValue ? 'enabled' : 'disabled'}`);
    return newValue;
  }

  /**
   * Toggle detailed SSE capture
   */
  public toggleDetailedSSECapture(): boolean {
    const newValue = !this.currentConfig.detailedSSECapture;
    this.updateConfig({ detailedSSECapture: newValue });
    logger.info(`Detailed SSE capture ${newValue ? 'enabled' : 'disabled'}`);
    return newValue;
  }

  /**
   * Check if detailed body capture is enabled
   */
  public isDetailedBodyCaptureEnabled(): boolean {
    return this.currentConfig.detailedBodyCapture;
  }

  /**
   * Check if detailed SSE capture is enabled
   */
  public isDetailedSSECaptureEnabled(): boolean {
    return this.currentConfig.detailedSSECapture;
  }

  /**
   * Check if tracing is enabled
   */
  public isTracingEnabled(): boolean {
    return this.currentConfig.enabled;
  }

  /**
   * Check if a path should be excluded from tracing
   */
  public shouldExcludePath(path: string): boolean {
    if (!this.currentConfig.enabled) {
      return true;
    }

    return this.currentConfig.excludePaths.some(excludePath => {
      if (excludePath.endsWith('/')) {
        return path.startsWith(excludePath);
      }
      return path === excludePath || path.startsWith(excludePath + '/');
    });
  }

  /**
   * Get maximum body size for capture
   */
  public getMaxBodySize(): number {
    return this.currentConfig.maxBodySize;
  }

  /**
   * Get maximum response size for capture
   */
  public getMaxResponseSize(): number {
    return this.currentConfig.maxResponseSize;
  }

  /**
   * Get maximum stream size for capture
   */
  public getMaxStreamSize(): number {
    return this.currentConfig.maxStreamSize;
  }

  /**
   * Check if request should have detailed tracing
   */
  public shouldCaptureDetailedBody(request: { url: string; headers: any }): boolean {
    if (!this.isDetailedBodyCaptureEnabled()) {
      return false;
    }

    // Skip detailed capture for large requests unless explicitly enabled
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);
    if (contentLength > this.getMaxBodySize()) {
      return false;
    }

    return true;
  }

  /**
   * Check if SSE response should have detailed tracing
   */
  public shouldCaptureDetailedSSE(response: { headers: any }): boolean {
    if (!this.isDetailedSSECaptureEnabled()) {
      return false;
    }

    const contentType = response.headers['content-type'] || '';
    return contentType.includes('text/event-stream');
  }

  /**
   * Get configuration changes between old and new config
   */
  private getConfigChanges(oldConfig: TracingConfig, newConfig: TracingConfig): string[] {
    const changes: string[] = [];

    if (oldConfig.detailedBodyCapture !== newConfig.detailedBodyCapture) {
      changes.push(`detailedBodyCapture: ${oldConfig.detailedBodyCapture} → ${newConfig.detailedBodyCapture}`);
    }

    if (oldConfig.detailedSSECapture !== newConfig.detailedSSECapture) {
      changes.push(`detailedSSECapture: ${oldConfig.detailedSSECapture} → ${newConfig.detailedSSECapture}`);
    }

    if (oldConfig.enabled !== newConfig.enabled) {
      changes.push(`enabled: ${oldConfig.enabled} → ${newConfig.enabled}`);
    }

    return changes;
  }

  /**
   * Reset to default configuration
   */
  public resetToDefaults(): void {
    const defaultConfig = {
      enabled: true,
      detailedBodyCapture: false,
      detailedSSECapture: false,
      maxBodySize: 100 * 1024,
      maxResponseSize: 100 * 1024,
      maxStreamSize: 1 * 1024 * 1024,
      excludePaths: ['/api/', '/ws/', '/assets/', '/health', '/sse', '/'],
    };

    this.updateConfig(defaultConfig);
    logger.info('Tracing configuration reset to defaults');
  }
}

// Export singleton instance
export const tracingConfig = TracingConfigManager.getInstance();
