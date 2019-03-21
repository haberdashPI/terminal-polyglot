# Terminal Polyglot

An extension that makes working with multiple programming languages and the
bulit-in VSCode terminal a little more streamlined. Provided are a set of
terminal commands that are specific to each language mode. That way
when you send code from one language it gets sent to different interactive
terminal then code you send from another language.

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
        "launch": "matlab",
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

## Status

I am using the extension for my everyday work. Please feel free to report
an issue you find with the extension.
