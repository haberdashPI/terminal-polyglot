// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path'
import { TextDecoder } from 'util';
import { EIDRM } from 'constants';

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

function find_terminal(terminal_name: string){
  for(let term of vscode.window.terminals){
    if(term.name === terminal_name){ return term; }
  }
  vscode.window.createTerminal(terminal_name);
}

function get_terminal(context: vscode.ExtensionContext,
    editor: vscode.TextEditor,file: string) {

  let state: {[key: string]: string;} = context.workspaceState.get('terminal-map') || {};

  let languageId = editor.document.languageId;
  let terminal_name = (file ? state["file:"+file] : undefined) ||
    state["lang:"+languageId];
  let terminal = (terminal_name !== undefined) ? find_terminal(terminal_name) :
    vscode.window.createTerminal();

  return terminal;
}

interface TermLanguageConfig {
  cd: string;
  run: string;
}

function language_config(editor: vscode.TextEditor){
  let config = vscode.workspace.getConfiguration("terminal-run-cd.language-config");

  let l_config: TermLanguageConfig | undefined = config.get(editor.document.languageId);
  if(l_config){
    return l_config;
  }else{
    return {cd: "cd \"%\"", run: "./\"%\""};
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

function get_term_count_for(languageId: string){
  let count = 0;
  let pattern = new RegExp("^"+languageId+"-shell-"+"[0-9]+$");
  for(let term of vscode.window.terminals){
    if(pattern.test(term.name)){ count++; }
  }
  return count;
}

function get_term_languageId(terminal: vscode.Terminal){
  let pattern = /^(.*)-shell-[0-9]+$/;
  let match = terminal.name.match(pattern);
  if(match){ return match[1]; }
  else{ return undefined; }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
  console.log('"terminal-run-cd" is now active!');
  let last_editor = vscode.window.activeTextEditor;

  vscode.window.onDidChangeActiveTextEditor(event => {
    last_editor = vscode.window.activeTextEditor || last_editor;
  });

  // TODO: this approach doesn't work well, instead I need to have
  // a separate terminal open command specific to the extension (fair enough)

  // newly opened terminals get renamed based on the language of the most recent
  // editor, and they're associated with the last editor for future use
  vscode.window.onDidOpenTerminal((terminal: vscode.Terminal) => {
    if(last_editor){
      console.log("Openining terminal, change name?");
      let languageId = last_editor.document.languageId;
      console.log("terminal value "+terminal);
      if(terminal){
        console.log("Found terminal.");
        let count = get_term_count_for(languageId)+1;
        let name = languageId + '-shell-' + count;
        console.log("Changing to name: "+name);
        vscode.commands.executeCommand('workbench.action.terminal.rename',
          languageId + '-shell-' + count).then(result => {
            console.log("name changed to: "+terminal.name);
            console.log("command output: ");
            console.table(result);
          });
        let uri = last_editor.document.uri;
        let state: {[key: string]: string;} =
          context.workspaceState.get('terminal-map') || {};

        if(uri){ state["file:"+uri.fsPath] = name; }
        if(!state["lang:"+languageId]){ state["lang:"+languageId] = name; }

        console.table(state);
        context.workspaceState.update('terminal-map',state);
      }
    }
  });

  // TODO: create a command to cycle through terminals within a given
  // language

  // changing to the active terminal also change the terminal associated with
  // the last edited file, if they're associated with the same language
  vscode.window.onDidChangeActiveTerminal(event => {
    if(!vscode.window.activeTerminal){
      return;
    }else{
      let state: {[key: string]: string;} =
        context.workspaceState.get('terminal-map') || {};
      if(last_editor){
        let languageId = last_editor.document.languageId;
        let termLangId = get_term_languageId(vscode.window.activeTerminal);
        if(termLangId && termLangId === languageId){
          let name = vscode.window.activeTerminal.name;
          let uri = last_editor.document.uri;
          if(uri){ state["file:"+uri.fsPath] = name; }
        }
      }
    }
  });

  // TODO: changes to a filename require an update of the terminal name take
  // advantage of the new rename API when it exists
  // https://github.com/Microsoft/vscode/issues/43768

  // Send commands, respecting the association between files and
  // particular terminals
  let command = vscode.commands.registerCommand('terminal-run-cd.send-text', () => {
    with_editor(editor => {
      let terminal = get_terminal(context,editor,editor.document.fileName);
      let sel = editor.selection;
      let text = "";
      if(sel.isEmpty){
        text = editor.document.lineAt(sel.active).text;
      }else{
        text = editor.document.getText(sel);
      }
      if(terminal){
        terminal.sendText(text);
        terminal.show();
        let pos = new vscode.Position(sel.end.line+1,0);
        editor.selection = new vscode.Selection(pos,pos);
      }
    });
  });
  context.subscriptions.push(command);

	// Change directory, as if we were in a bash or DOS terminal
	command = vscode.commands.registerCommand('terminal-run-cd.global_cd', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = path.dirname(file);
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          terminal.sendText('cd "' + dir + '"');
          terminal.show();
        }
      });
    });
  });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-run-cd.cd', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = path.dirname(file);
        let pattern = language_config(editor).cd;
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          terminal.sendText(replace_wildcard(pattern,dir));
          terminal.show();
        }
      });
    });
  });

  command = vscode.commands.registerCommand('terminal-run-cd.run', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let pattern = language_config(editor).run;
        let terminal = get_terminal(context,editor,file);
        if(terminal){
          terminal.sendText(replace_wildcard(pattern,file));
          terminal.show();
        }
      });
    });
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
