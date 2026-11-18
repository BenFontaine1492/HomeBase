import { invoke } from '@tauri-apps/api/core'
import { logError } from '@/infrastructure/log'
import { describeError } from '@/utils/error'

/**
 * Calls a native command (`src-tauri/src/commands.rs`). Commands reject with
 * plain strings (messages for the user); they are logged and turned into `Error`s.
 */
export async function callCommand<T>(command: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    const message = describeError(error)
    logError(`Command ${command} failed: ${message}`)
    throw new Error(message, { cause: error })
  }
}
