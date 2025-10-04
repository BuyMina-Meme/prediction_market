/**
 * Settlement Monitoring Service
 *
 * Watches for markets past endTime and triggers settlement
 * after the first Doot oracle update observed post endTime.
 */
export declare function startSettlementMonitor(): Promise<() => void>;
//# sourceMappingURL=settlement-monitor.d.ts.map