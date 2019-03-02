# Terminal Run/CD

An extension to send language-specific commands to the terminal (with that language CLI running) to change directory or run a given file.

## Extension Settings

Settings for each language are specified by `terminal-run-cd.language-config`.

The default value is:

```json
"terminal-run-cd.language-config": {
    "python": {"run": "%%run \"%\"", "cd": "%%cd \"%\""},
    "julia": {"run": "include(\"%\")", "cd": "cd(\"%\")"},
    "r": {"run": "source(\"%\")", "cd": "setwd(\"%\")"},
    "matlab": {"run": "run '%'", "cd": "cd '%'" },
    "javascript": {"run": ".load \"%\"", "cd": "process.chdir(\"%\")"}
}
```

## Status

This is still in early stages of development.
