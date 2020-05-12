# Terminal Polyglot

This extension provides a set of commands for sending text to a terminal
specific to the programming language of the current file. It associates each
file with a language-specific terminal instance: any command you issue through
the extension are sent to that terminal.

The extension allows for multiple terminals per language, and persistent
terminal sessions via `tmux` or `screen. If multiple terminals are present for a given a language, text sent from a given file will be sent to the last terminal used with that file.

The commands include:

* Open an existing terminal (or new terminal if none exists) specific to the language mode of the current file (default key `Ctrl+'`).
* Open a new terminal specific to the language (default key `Ctrl+Shift'`).
* Open the Nth language-specific terminal, creating it if it does not exists (command `Terminal Polyglot: Open Terminal...`)
* Send lines of code to the language-specific terminal (default key `Ctrl+Shift+Enter`), opening the terminal and launching the REPL if necessary.
* Cycle through all terminals for a specific language (command `Terminal Polyglot: Next Terminal`)
* Change directory to file location at the interactive REPL (command `Terminal Polyglot: Change Directory`)
* Run the entire file in the interactive REPL (command `Terminal Polyglot: Run File`)
* Change directory to file location in a shell (command `Terminal Polyglot: Change Shell Directory`)

The `Open Terminal...` command can also determine the terminal to open using an `index` argument. For example:

```json
{
    "command": "terminal-polyglot.open-terminal-N",
    "args": { "index": 2 },
    "key": "shift+cmd+2",
    "when": "editorTextFocus"
}
```

## Extension Settings

Settings for each language are specified using `terminal-polyglot.language-config`.

The settings specify how to run files, change directories and launch a REPL.

The default value is:

```json
"terminal-polyglot.language-config": {
    "python": {
        "launch": "python",
        "run": "exec(open(\"%\").read(), globals())",
        "cd": "import os; os.chdir(\"%\")"
    },
    "clojure": {
        "launch": "clojure",
        "run": "(load-file \"%\")",
        "cd": ""
    },
    "julia": {
        "launch": "julia",
        "run": "include(\"%\")",
        "cd": "cd(\"%\")"
    },
    "ruby": {
        "launch": "irb",
        "run": "load '%'",
        "cd": "Dir.chdir('%')"
    },
    "r": {
        "launch": "R",
        "run": "source(\"%\")",
        "cd": "setwd(\"%\")"
    },
    "matlab": {
        "launch": "matlab -nodesktop -nosplash",
        "run": "run '%'",
        "cd": "cd '%'"
    },
    "typescript": {
        "launch": "ts-node",
        "run": ".load \"%\"",
        "cd": "process.chdir(\"%\")"
    },
    "javascript": {
        "launch": "node",
        "run": ".load \"%\"",
        "cd": "process.chdir(\"%\")"
    }
}
```

If you have additional languages you'd like included in the default settings
please file an issue or create a PR.

## Wildcards

When calling `run` or `cd`, the wildcard character `%` is replaced with the
directory or filename as appropriate. You can include `%` characters in the
string sent to the terminal by using it twice. For example, to use `ipython`
instead of `python` you could configure python as follows:

```json
"python": {
    "launch": "ipython",
    "run": "%%run \"%\"",
    "cd": "%%cd \"%\""
}
```

### Persistent terminal sessions

When present, a wildcard in `launch` is replaced with the name of the workspace
and terminal. This lets you create persistent terminal sessions using this name.
For example, to use tmux to maintain your terminal state, you could use the
following settings:

```json
"terminal-polyglot.language-config": {
    "python": {
        "launch": "tmux new-session -A -s '%' python ",
        "run": "exec(open(\"%\").read(), globals())",
        "cd": "import os; os.chdir(\"%\")"
    },
    "clojure": {
        "launch": "tmux new-session -A -s '%' clojure",
        "run": "(load-file \"%\")",
        "cd": ""
    },
    "julia": {
        "launch": "tmux new-session -A -s '%' julia",
        "run": "include(\"%\")",
        "cd": "cd(\"%\")"
    },
    "ruby": {
        "launch": "tmux new-session -A -s '%' irb",
        "run": "load '%'",
        "cd": "Dir.chdir('%')"
    },
    "r": {
        "launch": "tmux new-session -A -s '%' R",
        "run": "source(\"%\")",
        "cd": "setwd(\"%\")"
    },
    "matlab": {
        "launch": "tmux new-session -A -s '%' matlab -nodesktop -nosplas",
        "run": "run '%'",
        "cd": "cd '%'"
    },
    "typescript": {
        "launch": "tmux new-session -A -s '%' ts-node",
        "run": ".load \"%\"",
        "cd": "process.chdir(\"%\")"
    },
    "javascript": {
        "launch": "tmux new-session -A -s '%' node",
        "run": ".load \"%\"",
        "cd": "process.chdir(\"%\")"
    }
}
```

## Status

This should be working well; I use it every day. Please feel free to report
any issues you find with this extension.
