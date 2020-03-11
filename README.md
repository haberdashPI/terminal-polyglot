# Terminal Polyglot

An extension that makes working with multiple programming languages and the
built-in [Visual Studio Code](https://code.visualstudio.com/) terminal a little
more streamlined. Provided are a set of terminal commands that are specific to
each language mode. That way when you send code from one language it gets sent
to a different interactive terminal than code you send from another language.

As an added bonus, the extension allows for persistent terminal sessions using
`tmux` or `screen`. (See below)

You can:

* Open an existing or new terminal specific to the language mode (default key `Ctrl+'`), launching
  an interactive REPL specific to the language, if specified.
* Open a new terminal specific to the language (default key `Ctrl+Shift'`).
* Send lines of code to the language-specific terminal (default key `Ctrl+Shift+Enter`), opening
    the terminal and launching the REPL if necessary.
* Cycle through all terminals for a specific language (command `Terminal Polyglot: Next Terminal`)
* Change directory to file location at the interactive REPL (command `Terminal Polyglot: Change Directory`)
* Run the entire file in the interactive REPL (command `Terminal Polyglot: Run File`)
* Change directory to file location in a shell (command `Terminal Polyglot: Change Shell Directory`)

## Extension Settings

Settings for each language are specified by `terminal-polyglot.language-config`.

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

## Wildcards

When calling `run` or `cd`, The wildcard character `%` is replaced with the
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

When present, the wildcard is replaced with the name of the workspace and
terminal when calling `launch`. This lets you create persistent terminal
sessions.  For example, to use tmux to maintain your terminal state, you could
use the following settings:

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
