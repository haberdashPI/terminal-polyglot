# Terminal Polyglot

This extension provides a set of commands for sending text to an integrated terminal
specific to the programming language of the current file (or code fence). It associates each
file with a language-specific terminal instance: any command you issue through
the extension is sent to that terminal.

The extension allows for multiple terminals per language, and persistent
terminal sessions via `tmux` or `screen`. If multiple terminals are present for
a given language, text sent from a file will be sent to the last terminal
used for that file.

The commands include:

* Open an existing terminal specific to the language of the current file or code fence (default key `Ctrl+'`). If no terminal exists for that language, a new one is created.
* Open a new terminal specific to the language of the current file (default key `Ctrl+Shift'`). A new [REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop) is launched.
* Cycle through all terminals for a specific language (command `Terminal Polyglot: Next Terminal` and `Termianl Polyglot: Previous Terminal`)
* Open the Nth language-specific terminal, creating it if it does not exist (command `Terminal Polyglot: Open Terminal...`)
* Send lines of code to the language-specific terminal (default key `Ctrl+Shift+Enter`), opening the terminal and launching a REPL for that language if necessary.
* Send a command to change the directory to the current file's location (command `Terminal Polyglot: Change Directory`)
* Send a command to run the entire file (command `Terminal Polyglot: Run File`).
* Change directory to file location in a shell (command `Terminal Polyglot: Change Shell Directory`)
* Send / select code inside a code fence
* Move to / select the next / previous code fence
* Send an arbitrary command to the terminal (see details below)

The `Open Terminal...` command can also determine the terminal to open using an `index` argument. For example:

```json
{
    "command": "terminal-polyglot.open-terminal-N",
    "args": { "index": 2 },
    "key": "shift+cmd+2",
    "when": "editorTextFocus"
}
```

The command `terminal-polyglot.send-command` must be passed the argument `cmd`,
and can be used in a keybinding to send any command you want to the terminal.
It has two available wild cards:

- `%file%`: Which will be replaced with the currently active file
- `%worksapce%`: Which will be replaced with the currently active workspace folder

```json
{
  "command": "terminal-polyglot.send-command",
  "args": { "cmd": "foobar(\"%file%\")" },
  "when": "editorLangId == 'javascript'"
}
```

## Extension Settings

For each language there are at least three settings you probably want to specify.

- `launchCommand`: the command to start a REPL from the shell
- `runCommand`: the command to run a file in the REPL
- `changeDirecetoryCommand`: the command to change directories in the REPL

The run and change direcetory commands need to use a wildcard character, "%", which will be
replaced with an appropriate file or directory. To insert a literal "%" character in the
command, just use "%%".

There are several optional settings:

- `bracketedPasteMode` - defaults to `false`; allows special escape characters
to be sent to the terminal; some REPLs drop or alter text when this mode is not
set to `true` (e.g. `ipython`).
- `sendTextBlockCommand` - defaults to "%"; allows you to wrap code send via the
  `send-text-block` command with extra code. This allows a block sent in this way to differ
  in how it is run or displayed in the REPL.
- `codeFenceSyntax` - some langauges (e.g. markdown) can contain code from another language;
you can tell terminal polyglot to use a terminal for the embedded language by specifying
a regex that parses the relevant code fence syntax. This setting should contain an array with two strings. These represent the regex for the starting and ending of a code fence. The first regex should have a named group called "lang" that serves as the langauge indentifier for this block of code. Any time the selected text is completely contained within a code fence, commands to send that text will be sent to the embedded language.

As an example, here are the default settings.

```json
"[python]": {
  "terminal-polyglot.launchCommand": "ipython",
  "terminal-polyglot.runCommand": "%%run \"%\"",
  "terminal-polyglot.changeDirectoryCommand": "%%cd \"%\"",
  "terminal-polyglot.bracketedPasteMode": true
},
"[clojure]": {
  "terminal-polyglot.launchCommand": "clojure",
  "terminal-polyglot.runCommand": "(load-file \"%\")",
  "terminal-polyglot.changeDirectoryCommand": ""
},
"[julia]": {
  "terminal-polyglot.launchCommand": "julia",
  "terminal-polyglot.runCommand": "include(\"%\")",
  "terminal-polyglot.changeDirectoryCommand": "cd(\"%\")",
  "terminal-polyglot.bracketedPasteMode": true,
  "termianl-polyglot.sendTextBlockCommand": "begin; %; end"
},
"[ruby]": {
  "terminal-polyglot.launchCommand": "irb",
  "terminal-polyglot.runCommand": "load '%'",
  "terminal-polyglot.changeDirectoryCommand": "Dir.chdir('%')"
},
"[r]": {
  "terminal-polyglot.launchCommand": "R",
  "terminal-polyglot.runCommand": "source(\"%\")",
  "terminal-polyglot.changeDirectoryCommand": "setwd(\"%\")"
},
"[matlab]": {
  "terminal-polyglot.launchCommand": "matlab -nodesktop -nosplash",
  "terminal-polyglot.runCommand": "run '%'",
  "terminal-polyglot.changeDirectoryCommand": "cd '%'"
},
"[typescript]": {
  "terminal-polyglot.launchCommand": "ts-node",
  "terminal-polyglot.runCommand": ".load \"%\"",
  "terminal-polyglot.changeDirectoryCommand": "process.chdir(\"%\")",
  "terminal-polyglot.bracketedPasteMode": true
},
"[javascript]": {
  "terminal-polyglot.launchCommand": "node",
  "terminal-polyglot.runCommand": ".load \"%\"",
  "terminal-polyglot.changeDirectoryCommand": "process.chdir(\"%\")",
  "terminal-polyglot.bracketedPasteMode": true
}
"[markdown]": {
  "terminal-polyglot.codeFenceSyntax": [
     "^```(\\{\\.?)?(?<lang>\\w*)?(.*\\})?\\s*$",
     "^```\\s*$"
   ]
},
```

If you have additional languages you'd like included in the default settings
please file an issue or create a PR.

## Platform specific paste mode

Bracketed paste mode can be specified in a platform specific way if necessary.
This is done as follows.

```json
"bracketedPasteMode": {"darwin": true, "linux": true, "win32": false}
```

Windows does not always handle bracketed paste mode well.

## Persistent terminal sessions

When present, a wildcard in `launch` is replaced with the name of the workspace
and terminal. This lets you create persistent terminal sessions using this name.
For example, to use `tmux` to maintain your terminal state, you could use the
following settings:

```json
"[python]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' ipython"
},
"[clojure]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' clojure"
},
"[julia]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' julia"
},
"[ruby]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' irb"
},
"[r]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' R"
},
"[matlab]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' matlab -nodesktop -nosplash"
},
"[typescript]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' ts-node"
},
"[javascript]": {
  "terminal-polyglot.launchCommand": "tmux new-session -A -s '%' node"
}
```

## Status

I use this extension on daily basis, so it should be working well. Please feel free to
report any issues on the github repository.

There is a [known issue](https://github.com/haberdashPI/terminal-polyglot/issues/7) where tab characters are not properly sent to the terminal on windows.
