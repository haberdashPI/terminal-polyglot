// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path'
import { TextDecoder } from 'util';
import { EIDRM } from 'constants';
import { once } from 'cluster';

interface TermLanguageConfig {
  cd: string;
  run: string;
  launch: string;
  bracketedPasteMode: boolean;
  sendTextBlockCommand: string;
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
  let languageId = editor.document.languageId;

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
  let conf = language_config(editor);
  let launch = replace_wildcard(conf.launch,session_name);
  if(launch.length > 0){ send_text(term,launch,conf.bracketedPasteMode); }
  let state: {[key: string]: string;} = context.workspaceState.get('terminal-map') || {};

  state["file:"+file] = term.name;
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

  let languageId = editor.document.languageId;
  let terminal_name = (file ? state["file:"+file] : undefined) ||
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

function language_config(editor: vscode.TextEditor): TermLanguageConfig{
  let config = vscode.workspace.getConfiguration("terminal-polyglot",
    editor.document)

  return {
    cd: def(config?.get<string>("changeDirectoryCommand"), "cd \"%\""),
    run: def(config?.get<string>("runCommand"), "./\%\""),
    launch: def(config?.get<string>("launchCommand"), ""),
    bracketedPasteMode: def(platform(config?.get<boolean>("bracketedPasteMode")), false),
    sendTextBlockCommand: def(config?.get<string>("sendTextBlockCommand"), "%")
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

  let config = vscode.workspace.getConfiguration("terminal-polyglot")
  if(config.get("language-config")){
    vscode.window.showErrorMessage("The new version of Terminal Polyglot does not use the"+
      " `language-config` setting, please use the new language-specific settings. "+
      "(See the [README.md](https://github.com/haberdashPI/terminal-polyglot/blob/master/README.md))");
  }

  // Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
  console.log('"terminal-polyglot" is now active!');
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
          let languageId = last_editor.document.languageId;
          let termLangId = get_term_languageId(terminal);
          if(termLangId && termLangId === languageId){
            let name = terminal.name;
            let uri = last_editor.document.uri;
            if(uri){ state["file:"+uri.fsPath] = name; }
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
      let languageId = editor.document.languageId;
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
      let languageId = editor.document.languageId;
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
  function sendTextCommand(useBlock: boolean){
    with_editor(editor => {
      let terminal = get_terminal(context,editor,editor.document.fileName);
      let sel = editor.selection;
      let text = "";
      if(sel.isEmpty){
        if(editor.document.lineCount < sel.active.line){
          text = editor.document.lineAt(sel.active.line-1).text;
        }else{
          text = editor.document.lineAt(sel.active.line).text;
        }
      }else{
        text = editor.document.getText(sel);
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
        if(sel.isEmpty){
          pos = new vscode.Position(sel.end.line+1,0);
        }else{
          pos = sel.active;
        }

        editor.selection = new vscode.Selection(pos,pos);
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
      let languageId = editor.document.languageId;

      let count = get_term_count_for(languageId)+1;
      let terminal = create_terminal(context,editor,
        editor.document.fileName, languageId+'-shell-'+count);
      if(terminal){ terminal.show(); }
    })
  });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-polyglot.open-terminal-N', (args?: {index: Number}) => {
    with_editor(editor => {
      let languageId = editor.document.languageId;

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
