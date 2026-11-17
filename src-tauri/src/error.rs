//! The result type of every command: errors are messages the frontend shows as is.

pub(crate) type CommandResult<T> = Result<T, String>;

/// Turns any error into the text the frontend shows.
///
/// Passed by name (`.map_err(error_text)`) instead of `.map_err(|e| e.to_string())`:
/// each closure counts as its own piece of code for the coverage gate, and most
/// database calls can't be made to fail in a test.
pub(crate) fn error_text(error: impl std::fmt::Display) -> String {
    error.to_string()
}
