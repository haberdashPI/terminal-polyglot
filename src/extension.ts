// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path'
import { TextDecoder } from 'util';
import { EIDRM } from 'constants';
import { once } from 'cluster';
import { toEditorSettings } from 'typescript';

interface TermLanguageConfig {
  cd: string;
  run: string;
  launch: string;
  bracketedPasteMode: boolean;
  sendTextBlockCommand: string;
  codeFenceSyntax?: [string, string];
}

function with_editor(fn: (editor: vscode.TextEditor) => void){
  let editor = vscode.window.activeTextEditor;
  if(!editor){
    vscode.window.showErrorMessage("No active text editor.");
  }else{
    fn(editor);
  }
}

function with_file_path(editor: vscode.TextEditor,fn: (path: string) => void) {
    let uri = editor.document.uri;
    if(uri.scheme !== "file"){
      vscode.window.showErrorMessage("Current file is not local to this filesystem");
    }else{
      fn(uri.fsPath);
    }
}

function get_term_numbers_for(languageId: string){
  let numbers = [];
  let pattern = new RegExp("^"+languageId+"-shell-"+"([0-9]+)$");
  for(let term of vscode.window.terminals){
      let result = term.name.match(pattern)
    if(result){ numbers.push(parseInt(result[1])); }
  }
  return numbers.sort();
}

function cycle_term_number(term_name: string, languageId: string, by: number){
  let numbers = get_term_numbers_for(languageId);
  let match = term_name.match(/^.*-shell-([0-9]+)$/);
  if(match){
    let num = parseInt(match[1]);
    let new_num = 0;
    for(var i = 0; i < numbers.length; i++){
      if(numbers[i] === num){
        let j = i+by;

        if(j < 0){
          j += numbers.length;
        }else if(j >= numbers.length){
          j -= numbers.length;
        }
        new_num = numbers[j];
        break;
      }
    }
    term_name = languageId+"-shell-"+new_num;
  }else{
    vscode.window.showErrorMessage("Malformed terminal name "+
      term_name);
  }

  return term_name;
}

function get_term_count_for(languageId: string){
  let count = 0;
  let pattern = new RegExp("^"+languageId+"-shell-"+"([0-9]+)$");
  for(let term of vscode.window.terminals){
      let result = term.name.match(pattern)
    if(result){ count = Math.max(count,parseInt(result[1])); }
  }
  return count;
}

// enclose all terminal text in bracketed paste mode
function send_text(term: vscode.Terminal, text: string, escapeText: boolean){
  escapeText && term.sendText("\x1B[200~",false)
  term.sendText(text,false)
  escapeText && term.sendText("\x1B[201~")
  !escapeText && term.sendText("",true)
}

function create_terminal(context: vscode.ExtensionContext,
  editor: vscode.TextEditor, file: string, name: string): vscode.Terminal {
  let languageId = get_editor_languageId(editor);
  let conf = language_config(editor, languageId)

  let term = vscode.window.createTerminal(name);
  let workspace_name = vscode.workspace.name ? vscode.workspace.name : "";
  workspace_name = workspace_name.replace(/\s+\(Workspace\)/,'-workspace');

  // text in [ ] at the end of the name identifies the remote server of the
  // workspace. We don't need the name we use to disambiguate between different
  // remote spaces, since by necessity tmux or screen will have a different
  // environment in different remote locations
  workspace_name = workspace_name.replace(/ \[.*\]$/,'');

  // replace all remaining non-alpha numeric characters with `-`
  workspace_name = workspace_name.replace(/\W/g,"-")

  let session_name = workspace_name+"-"+name;
  let launch = replace_wildcard(conf.launch, session_name);
  if(launch.length > 0){ send_text(term,launch, conf.bracketedPasteMode); }
  let state: {[key: string]: string;} = context.workspaceState.get('terminal-map') || {};

  state["file:"+file+"|id:"+languageId] = term.name;
  if(!state["lang:"+languageId]){ state["lang:"+languageId] = term.name; }
  context.workspaceState.update('terminal-map',state);

  return term;
}

function find_terminal(context: vscode.ExtensionContext,
  editor: vscode.TextEditor, file: string, name: string): vscode.Terminal {
  for(let term of vscode.window.terminals){
    if(term.name === name){ return term; }
  }
  return create_terminal(context,editor,file,name);
}

function get_terminal(context: vscode.ExtensionContext,
    editor: vscode.TextEditor,file: string): vscode.Terminal {

  let state: {[key: string]: string;} = context.workspaceState.get('terminal-map') || {};

  let languageId = get_editor_languageId(editor);
  let terminal_name = (file ? state["file:"+file+"|id:"+languageId] : undefined) ||
    state["lang:"+languageId];

  if(terminal_name !== undefined){
    return find_terminal(context,editor,file,terminal_name);
  }else{
    let count = get_term_count_for(languageId)+1;
    return create_terminal(context,editor,file,languageId+'-shell-'+count);
  }
}

function def<T>(x: T | undefined,y: T): T {
  if(x) return x;
  else return y;
}

interface PlatformSpecific<T> {
  darwin: T, linux: T, win32: T
}

function platform<T>(x: T | PlatformSpecific<T> | undefined): T | undefined {
  if((x as PlatformSpecific<T>).darwin){
    const platform = process.platform as "win32" | "darwin" | "linux";
    return (x as PlatformSpecific<T>)[platform]
  }else{
    return (x as T | undefined);
  }
}

function language_config(editor: vscode.TextEditor, lang?: string): TermLanguageConfig{
  let config = vscode.workspace.getConfiguration("terminal-polyglot",
    lang ? {languageId: lang, uri: editor.document.uri} : editor.document)

  return {
    cd: def(config?.get<string>("changeDirectoryCommand"), "cd \"%\""),
    run: def(config?.get<string>("runCommand"), "./\%\""),
    launch: def(config?.get<string>("launchCommand"), ""),
    bracketedPasteMode: def(platform(config?.get<boolean>("bracketedPasteMode")), false),
    sendTextBlockCommand: def(config?.get<string>("sendTextBlockCommand"), "%"),
    codeFenceSyntax: def(config?.get<[string,string]>("codeFenceSyntax"), undefined)
  }
}

function replace_wildcard(pattern: string,val: string) {
  // the wildcard pattern is a single '%' with no neighboring '%'
  // this allows us to escape the wildcard character
  let wildcard = /([^%]|^)(%)([^%]|$)/;
  let escaped_wildcard = /%%/;

  return pattern.replace(wildcard,(_,prefix,match,suffix) => {
    return prefix+val+suffix;
  }).replace(escaped_wildcard,'%');
}

function get_code_fence(editor: vscode.TextEditor, stayWithin: boolean, forward: boolean,
                        sel: vscode.Selection = editor.selection,
                        conf: TermLanguageConfig = language_config(editor)): vscode.Range | undefined {
  if(!conf.codeFenceSyntax) return undefined
  let start = new RegExp(conf.codeFenceSyntax[0]);
  let stop = new RegExp(conf.codeFenceSyntax[1]);
  let result = extractFence(editor.document, start, stop, sel.start, sel.end, stayWithin, forward)
  // if the fence contains the current cursor position, we may need to move it further
  if(!stayWithin){
    if(result){
      let startPos = new vscode.Position(result[1], 0)
      let line = editor.document.lineAt(result[2])
      let stopPos = new vscode.Position(line.lineNumber, line.range.end.character);
      let firstRange = new vscode.Range(startPos, stopPos)
      if(firstRange.contains(sel)){
        if(forward && stopPos.line < editor.document.lineCount-1){
          let pos = new vscode.Position(stopPos.line+1, 0)
          result = extractFence(editor.document, start, stop, pos, pos, false, true)
        }else if(!forward && startPos.line > 0){
          let pos = new vscode.Position(startPos.line-1, 0)
          result = extractFence(editor.document, start, stop, pos, pos, false, false)
        }
      }
    }
  }
  if(result){
    let startPos = new vscode.Position(result[1]+1, 0)
    let line = editor.document.lineAt(result[2]-1)
    let stopPos = new vscode.Position(line.lineNumber, line.range.end.character);
    return new vscode.Range(startPos, stopPos)
  }else{
    return undefined
  }
}

function get_editor_languageId(editor: vscode.TextEditor,
                               conf: TermLanguageConfig = language_config(editor)): string {
  if(!conf.codeFenceSyntax){
    return editor.document.languageId
  }else{
    let start = new RegExp(conf.codeFenceSyntax[0]);
    let stop = new RegExp(conf.codeFenceSyntax[1]);
    let sel = editor.selection;
    let result = extractFence(editor.document, start, stop, sel.start, sel.end)
    if(result){
      return result[0];
    }else{
      return editor.document.languageId;
    }
  }
}

function extractFence(doc: vscode.TextDocument, start: RegExp, stop: RegExp,
                      from: vscode.Position, to: vscode.Position, stayWithinBounds: boolean = true,
                      forward: boolean = false): [string, number, number] | undefined {

  let lang = "";
  let line = from.line;
  let text = doc.lineAt(line).text
  while(true){
    let match = start.exec(text)
    if(stop.test(text)){
      if(stayWithinBounds) return undefined
      else forward = false
    }
    else if(match){
      if(match.groups){
        lang = match.groups['lang'];
      }
      break
    }
    if(!forward && line > 0){
      line -= 1;
      text = doc.lineAt(line).text
    }else if(forward && line+1 < doc.lineCount){
      line += 1;
      text = doc.lineAt(line).text
    }else{
      break
    }
  }
  if(!lang) return undefined
  let startLine = line;

  line = stayWithinBounds ? to.line : line;
  text = doc.lineAt(line).text
  while(true){
    if(stop.test(text)){
      return [lang, startLine, line]
    }
    if(stayWithinBounds && start.test(text)){ return undefined }
    if(line+1 < doc.lineCount){
      line += 1;
      text = doc.lineAt(line).text
    }else{
      break
    }
  }
  if(stayWithinBounds){
    return undefined
  }else{
    return [lang, startLine, line]
  }
}

function get_term_languageId(terminal: vscode.Terminal){
  let pattern = /^(.*)-shell-[0-9]+$/;
  let match = terminal.name.match(pattern);
  if(match){ return match[1]; }
  else{ return undefined; }
}

let terminalChangeEvent: vscode.Disposable | undefined = undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // TODO: REMOVE ME
  context.workspaceState.update('terminal-map', {})
  let config = vscode.workspace.getConfiguration("terminal-polyglot")
  if(config.get("language-config")){
    vscode.window.showErrorMessage("The new version of Terminal Polyglot does not use the"+
      " `language-config` setting, please use the new language-specific settings. "+
      "(See the [README.md](https://github.com/haberdashPI/terminal-polyglot/blob/master/README.md))");
  }

  // Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
  let last_editor = vscode.window.activeTextEditor;

  vscode.window.onDidChangeActiveTextEditor(event => {
    last_editor = vscode.window.activeTextEditor || last_editor;
    // TODO: change the last active terminal (without making
    // panel visible if it is hidden)
  });

  // changing to the active terminal also changes the terminal associated with
  // the last edited file, if they're associated with the same language
  terminalChangeEvent = vscode.window.onDidChangeActiveTerminal(
    (terminal: vscode.Terminal | undefined) => {
      if(terminal){
        let state: {[key: string]: string;} =
          context.workspaceState.get('terminal-map') || {};
        if(last_editor){
          let languageId = get_editor_languageId(last_editor);
          let termLangId = get_term_languageId(terminal);
          if(termLangId && termLangId === languageId){
            let name = terminal.name;
            let uri = last_editor.document.uri;
            if(uri){ state["file:"+uri.fsPath+"|id:"+languageId] = name; }
          }
        }
      }
    }
  );

  // TODO: changes to a filename require an update of the terminal name take
  // advantage of the new rename API when it exists
  // https://github.com/Microsoft/vscode/issues/43768

  let command = vscode.commands.registerCommand('terminal-polyglot.next-terminal', () => {
    with_editor(editor => {
      let languageId = get_editor_languageId(editor);
      let terminal = get_terminal(context,editor,editor.document.fileName);

      let term_name = "";
      if(terminal){
        term_name = cycle_term_number(terminal.name,languageId,1);
      }else{
        term_name = languageId+"-shell-1";
      }

      find_terminal(context,editor,editor.document.fileName,term_name).show();
    });
  });


  command = vscode.commands.registerCommand('terminal-polyglot.previous-terminal', () => {
    with_editor(editor => {
      let languageId = get_editor_languageId(editor);
      let terminal = get_terminal(context,editor,editor.document.fileName);

      let term_name = "";
      if(terminal){
        term_name = cycle_term_number(terminal.name,languageId,-1);
      }else{
        term_name = languageId+"-shell-1";
      }

      find_terminal(context,editor,editor.document.fileName,term_name).show();
    });
  });

  // Send commands, respecting the association between files and
  // particular terminals
  function sendTextCommand(useBlock: boolean, range?: vscode.Range){
    with_editor(editor => {
      let terminal = get_terminal(context,editor,editor.document.fileName);
      let text = "";
      let sel = editor.selection;
      if(!range){
        if(sel.isEmpty){
          if(editor.document.lineCount < sel.active.line){
            text = editor.document.lineAt(sel.active.line-1).text;
          }else{
            text = editor.document.lineAt(sel.active.line).text;
          }
        }else{
          text = editor.document.getText(sel);
        }
      }else{
        text = editor.document.getText(range);
      }
      if(terminal){
        let conf = language_config(editor)
        if(useBlock){
          let pattern = conf.sendTextBlockCommand;
          send_text(terminal,replace_wildcard(pattern,text),conf.bracketedPasteMode);
        }else{
          send_text(terminal,text,conf.bracketedPasteMode);
        }
        terminal.show(true);
        let pos;
        if(!range){
          if(sel.isEmpty){
            pos = new vscode.Position(sel.end.line+1,0);
          }else{
            pos = sel.active;
          }

          editor.selection = new vscode.Selection(pos,pos);
        }
      }
    });
  }

  command = vscode.commands.registerCommand('terminal-polyglot.send-text',
    () => sendTextCommand(false));
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.send-block-text',
    () => sendTextCommand(true));
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.new-terminal', () => {
    with_editor(editor => {
      let languageId = get_editor_languageId(editor);

      let count = get_term_count_for(languageId)+1;
      let terminal = create_terminal(context, editor,
        editor.document.fileName, languageId+'-shell-'+count);
      if(terminal){ terminal.show(); }
    })
  });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.open-terminal-N', (args?: {index: Number}) => {
    with_editor(editor => {
      let languageId = get_editor_languageId(editor);

      let index = args?.index;
      if(index === undefined){
        vscode.window.showInputBox({
          prompt: "Enter a number: ",
            validateInput: (str: string) => {
            if(!/[0-9]+/.test(str)){
              return "You must enter a number.";
            }
            return undefined;
          }
        }).then((entry?: string) => {
          if(entry !== undefined){
            index = Number(entry);
            let terminal = find_terminal(context,editor,
              editor.document.fileName, languageId+'-shell-'+index);
            if(terminal){ terminal.show(); }
          }
        });
      }else{
        let terminal = find_terminal(context,editor,
          editor.document.fileName, languageId+'-shell-'+index);
        if(terminal){ terminal.show(); }
      }
    });
  });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.open-terminal', () => {
    with_editor(editor => {
      let terminal = get_terminal(context,editor,editor.document.fileName);
      if(terminal){ terminal.show(); }
    })
  });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.send-fence',
    () => {
      with_editor(editor => {
        let range = get_code_fence(editor, true, true)
        if(range){
          sendTextCommand(true, range)
        }
      })
    });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.select-fence', () => {
    with_editor(editor => {
      let range = get_code_fence(editor, true, false)
      if(range){
        editor.selection = new vscode.Selection(range.start, range.end)
      }
    })
  })
  context.subscriptions.push(command)

  function fences(forward: boolean, select: boolean){
    return () => {
      with_editor(editor => {
        editor.selections = (<vscode.Selection[]>(editor.selections.map(sel => {
          let range = get_code_fence(editor, false, forward, sel)
          if(range){
            return new vscode.Selection(range.start, select ? range.end : range.start)
          }
        }).filter(x => x)))
      })
    }
  }
  command = vscode.commands.registerCommand(`terminal-polyglot.next-fence`, fences(true, false))
  context.subscriptions.push(command)
  command = vscode.commands.registerCommand(`terminal-polyglot.prev-fence`, fences(false, false))
  context.subscriptions.push(command)
  command = vscode.commands.registerCommand(`terminal-polyglot.next-fence-select`, fences(true, true))
  context.subscriptions.push(command)
  command = vscode.commands.registerCommand(`terminal-polyglot.prev-fence-select`, fences(false, true))
  context.subscriptions.push(command)

	// Change directory, as if we were in a bash or DOS terminal
	command = vscode.commands.registerCommand('terminal-polyglot.global_cd', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = path.dirname(file);
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          let cdcmd_ = vscode.workspace.getConfiguration("terminal-polyglot").
            get<string>("changeDirectoryShellCommand");
          let cdcmd = cdcmd_ ? cdcmd_ : "cd %";
          send_text(terminal,replace_wildcard(cdcmd, dir),false);
          terminal.show(true);
        }
      });
    });
  });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.cd', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = path.dirname(file);
        dir = dir.replace("\\","\\\\");
        let conf = language_config(editor)
        let pattern = conf.cd;
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          send_text(terminal,replace_wildcard(pattern,dir),conf.bracketedPasteMode);
          terminal.show(true);
        }
      });
    });
  });

  command = vscode.commands.registerCommand('terminal-polyglot.cd-workspace', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = vscode.workspace.rootPath
        if(dir){
          dir = dir.replace("\\","\\\\");
          let conf = language_config(editor);
          let pattern = conf.cd;
          let terminal = get_terminal(context,editor,file);
          if(terminal){
            send_text(terminal,replace_wildcard(pattern,dir),conf.bracketedPasteMode)
            terminal.show(true);
          }
        }
      });
    })
  });

  command = vscode.commands.registerCommand('terminal-polyglot.global_cd-workspace', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = vscode.workspace.rootPath
        if(dir){
          let terminal = get_terminal(context,editor,file);
          if(terminal){
            let cdcmd_ = vscode.workspace.getConfiguration("terminal-polyglot").
              get<string>("changeDirectoryShellCommand");
            let cdcmd = cdcmd_ ? cdcmd_ : "cd %";
            send_text(terminal,replace_wildcard(cdcmd, dir),false);
            terminal.show(true);
          }
        }
      });
    })
  });

  command = vscode.commands.registerCommand('terminal-polyglot.run', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let conf = language_config(editor);
        let pattern = conf.run;
        file = file.replace("\\","\\\\");
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          send_text(terminal,replace_wildcard(pattern,file),conf.bracketedPasteMode);
          terminal.show();
        }
      });
    });
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
  if(terminalChangeEvent){ terminalChangeEvent.dispose(); }
}
