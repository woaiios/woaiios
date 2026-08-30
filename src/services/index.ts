/**
 * services — 服务层入口（网络/存储边界：可注入依赖，便于单测与替换实现）
 */

export * from './serverConfig';
export { SongBridgeClient, DEFAULT_STYLE, DEFAULT_DURATION_SEC } from './songBridge';
export type { SongParams, StageInfo, SongResult, HealthInfo, SongHandlers } from './songBridge';
