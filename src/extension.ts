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
function send_text(term: vscode.Terminal, text: string){
  escapeText && term.sendText("\x1B[200~")
  term.sendText(text)
  escapeText && term.sendText("\x1B[201~")
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

  let session_name = workspace_name+"-"+name;
  let launch = replace_wildcard(language_config(editor).launch,session_name);
  if(launch.length > 0){ send_text(term,launch); }
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

function language_config(editor: vscode.TextEditor){
  let config = vscode.workspace.getConfiguration("terminal-polyglot.language-config");

  let l_config: TermLanguageConfig | undefined = config.get(editor.document.languageId);
  if(l_config){
    return l_config;
  }else{
    return {cd: "cd \"%\"", run: "./\"%\"", launch: ""};
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

let escapeText: boolean = true;

function updateEscape(event?: vscode.ConfigurationChangeEvent){
    if(!event || event.affectsConfiguration("terminal-polyglot")){
        let config = vscode.workspace.getConfiguration("terminal-polyglot");
        let maybeEscapeText = config.get<boolean>("escape-send-text")
        escapeText = maybeEscapeText === undefined ? true : maybeEscapeText;
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  updateEscape();
  vscode.workspace.onDidChangeConfiguration(updateEscape);

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
  command = vscode.commands.registerCommand('terminal-polyglot.send-text', () => {
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
        send_text(terminal,text);
        terminal.show(true);
        let pos = new vscode.Position(sel.end.line+1,sel.end.line+1);
        editor.selection = new vscode.Selection(pos,pos);
      }
    });
  });
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
            let terminal = create_terminal(context,editor,
              editor.document.fileName, languageId+'-shell-'+index);
            if(terminal){ terminal.show(); }
          }
        });
      }else{
        let terminal = create_terminal(context,editor,
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
        dir = dir.replace("\\","\\\\");
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          send_text(terminal,'cd "' + dir + '"');
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
        let pattern = language_config(editor).cd;
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          send_text(terminal,replace_wildcard(pattern,dir));
          terminal.show(true);
        }
      });
    });
  });

  command = vscode.commands.registerCommand('terminal-polyglot.run', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let pattern = language_config(editor).run;
        file = file.replace("\\","\\\\");
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          send_text(terminal,replace_wildcard(pattern,file));
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
