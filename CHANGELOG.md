# Change Log
All notable changes to the "terminal-polyglot" extension will be documented in this file.

## [0.5.0]
- **Feature**: Execute text inside a codefence (e.g. in markdown) in a terminal for the embedded langauge

## [0.4.3]
- **Bufgix**: Downstream vulnterabilities

## [0.4.2]
- **Feature**: Command to send block of text (allows language specific wrappers around such blocks).

## [0.4.1]
- **Configuration**: Small changes to default settings for bracketed paste mode.

## [0.4.0]
- **Feature**: Settings revised to use VSCode's built-in langauge specific
  scoping.
- **Feature**: Bracketed paste mode can be set per language and per OS.
- **Feature**: Commands to change to the root workspace directory.
- **Bugfix**: Improved path handeling on windows.

## [0.3.10-11]
- **Bufix: correctly send newlines when brackted paste mode is off

## [0.3.10]
- **Bugfix: bracketed paste-mode preferences respected**: turning it off
did not previously work in all cases.

## [0.3.9]
- **Improved "Open Terminal..." command**: if the terminal already exists
the command no longer creates a new identically named terminal.

## [0.3.8]
- **Improved cursor movement following send-text command**: only moves
down a line when the selection is empty.

## [0.3.7]
- **Improved terminal names**: replace most non-alphanumeric characters
with `-` in terminal names.

## [0.3.6]
- **More robust send-text behavior for unix systems**: Sends the appropriate
  [bracketed paste escape sequences](https://cirw.in/blog/bracketed-paste).
  Defaults to false on windows to avoid issues on that platform, use WSL to fix
  the problem. This feature affords `ipython`, in particular, a much more
  ergonomic experience.

## [0.3.5]

- **Better remote host terminal names**: The name sent to `launch` now excludes
  the host suffix in the workspace name. This isn't necessary because different
  remote hosts will have different tmux/screen environments.

## [0.3.4]

- **Fixed developer dependency vulnerability**: upgraded to newer VSCode
setup.
- **Revised README**: to clean up and clarify some language.

## [0.3.3]
- **New command: Open the Nth terminal**: terminal number can be specified interactively or as a command argument.
- **Bugfix: better handling of windows paths**: Applies proper escaping of `\` symbols.

## [0.3.2]
- **Improved default MATLAB command**: adds `-nosplash` and `-nodesktop`

## [0.3.1]
- **Improved terminal session names**: uses "-workspace" rather than " (Workspace)"

## [0.3.0]
- **Persistent terminal sessions**: the wildcard symbol is replaced with the name
  of the workspace and terminal when placed in a `launch` entry. This lets
  you use `screen` or `tmux` to create persistent terminal sessions.
  See README for details.
- **Revised terminal focus**: when calling `cd` commands the terminal no longer
  steals the focus.

## [0.2.4]
- Fixed an poorly named command.

## [<= 0.2.3]
Earlier changed are undocumented.
