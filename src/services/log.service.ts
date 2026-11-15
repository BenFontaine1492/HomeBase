import { error } from '@tauri-apps/plugin-log'
import { describeError } from './database/database-error'

/*
 * Writes frontend messages to the native log file (tauri-plugin-log, see
 * `src-tauri/src/lib.rs`), next to the Rust side's messages. Logging must never
 * break the app, so failures (e.g. running in a plain browser via `npm run dev`)
 * are ignored. Don't log user data such as SQL parameter values.
 */

type Writer = (message: string) => Promise<void>

function write(writer: Writer, message: string): void {
  writer(message).catch(() => {})
}

export function logError(message: string, cause?: unknown): void {
  write(error, cause === undefined ? message : `${message}: ${describeError(cause)}`)
}
