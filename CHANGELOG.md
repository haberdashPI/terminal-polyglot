# Change Log
All notable changes to the "terminal-polyglot" extension will be documented in this file.


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
