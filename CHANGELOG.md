# Change Log
All notable changes to the "terminal-polyglot" extension will be documented in this file.

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
